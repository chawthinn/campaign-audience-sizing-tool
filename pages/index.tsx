import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { FileUpload } from '@/components/FileUpload'
import { VennDiagram } from '@/components/VennDiagram'
import { FilterPanel } from '@/components/FilterPanel'
import { ResultsTable } from '@/components/ResultsTable'
import { ResultsPreview } from '@/components/ResultsPreview'
import { useAudienceStore } from '@/lib/store'
import { buildApiUrl, resolveDownloadUrl } from '@/lib/backend'
import { useTheme } from '@/lib/theme'
import { RefreshCw, Settings, Moon, Sun } from 'lucide-react'

const BUTTON_CONFIG = {
    intersection: {
        label: 'Analyze Intersection',
        className: 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400',
    },
    merger: {
        label: 'Analyze Merger',
        className: 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400',
    },
    exclusion: {
        label: 'Analyze Exclusion',
        className: 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400',
    },
} as const

// Ask the backend for a signed PUT URL, then upload the file straight to GCS.
// Returns the GCS object path (`uploads/<id>/<name>`) for the caller to pass to /process-gcs.
async function uploadFileToGcs(file: File, suggestedName: string): Promise<string> {
    const contentType = file.type || 'text/csv'

    const urlResp = await fetch(buildApiUrl('/upload-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: suggestedName, contentType }),
    })
    if (!urlResp.ok) {
        let detail = `HTTP ${urlResp.status}`
        try {
            const body = await urlResp.json()
            if (body?.detail) detail = body.detail
        } catch { }
        throw new Error(`Could not get upload URL: ${detail}`)
    }
    const { uploadUrl, gcsPath, contentType: signedContentType } = await urlResp.json()

    const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': signedContentType || contentType },
        body: file,
    })
    if (!putResp.ok) {
        throw new Error(`Upload to storage failed: HTTP ${putResp.status}`)
    }

    return gcsPath as string
}

export default function Home() {
    const [showFilterModal, setShowFilterModal] = useState(false)
    const [theme, , toggleTheme] = useTheme()
    const processingStartRef = useRef<number | null>(null)
    const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null)

    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const fileA = useAudienceStore((state) => state.fileA)
    const fileB = useAudienceStore((state) => state.fileB)
    const fileAKey = useAudienceStore((state) => state.fileAKey)
    const fileBKey = useAudienceStore((state) => state.fileBKey)
    const fileAGcsPath = useAudienceStore((state) => state.fileAGcsPath)
    const fileBGcsPath = useAudienceStore((state) => state.fileBGcsPath)
    const isProcessing = useAudienceStore((state) => state.isProcessing)
    const setProcessing = useAudienceStore((state) => state.setProcessing)
    const setResults = useAudienceStore((state) => state.setResults)
    const setDownloadUrl = useAudienceStore((state) => state.setDownloadUrl)
    const processingElapsedSeconds = useAudienceStore((state) => state.processingElapsedSeconds)
    const setProcessingElapsedSeconds = useAudienceStore((state) => state.setProcessingElapsedSeconds)
    const reset = useAudienceStore((state) => state.reset)
    const resultCount = useAudienceStore((state) => state.resultCount)

    const buttonCfg = BUTTON_CONFIG[action]
    const buttonLabel = action === 'exclusion'
        ? `${buttonCfg.label} (${exclusionDirection === 'a_minus_b' ? 'A − B' : 'B − A'})`
        : buttonCfg.label

    const handleProcess = async () => {
        if (!fileA || !fileB) {
            alert('Please upload both files')
            return
        }
        if (!fileAKey || !fileBKey) {
            alert('Please pick a primary key (join column) for both files')
            return
        }

        processingStartRef.current = performance.now()
        setProcessingElapsedSeconds(0)
        setProcessing(true, 0)
        try {
            // Pick the upload path:
            //   - If both files are already in GCS (dummies), skip upload entirely.
            //   - Else if either is > 25 MB, upload to GCS via signed URL (avoids Cloud Run's 32 MB body cap).
            //   - Else use the multipart /process endpoint.
            const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024 // 25 MB
            const bothInGcs = !!fileAGcsPath && !!fileBGcsPath
            const useGcsUpload = bothInGcs
                || fileA.size > LARGE_FILE_THRESHOLD
                || fileB.size > LARGE_FILE_THRESHOLD

            let response: Response

            if (useGcsUpload) {
                // Re-use pre-existing GCS paths (dummies) when present; only upload what's actually local.
                const [gcsPathA, gcsPathB] = await Promise.all([
                    fileAGcsPath || uploadFileToGcs(fileA, 'fileA.csv'),
                    fileBGcsPath || uploadFileToGcs(fileB, 'fileB.csv'),
                ])

                response = await fetch(buildApiUrl('/process-gcs'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        gcsPathA,
                        gcsPathB,
                        action,
                        keyA: fileAKey,
                        keyB: fileBKey,
                        direction: action === 'exclusion' ? exclusionDirection : undefined,
                    }),
                })
            } else {
                const formData = new FormData()
                formData.append('fileA', fileA)
                formData.append('fileB', fileB)
                formData.append('action', action)
                formData.append('key_a', fileAKey)
                formData.append('key_b', fileBKey)
                if (action === 'exclusion') {
                    formData.append('direction', exclusionDirection)
                }
                response = await fetch(buildApiUrl('/process'), {
                    method: 'POST',
                    body: formData,
                })
            }

            if (!response.ok) {
                let detail = `HTTP ${response.status}`
                try {
                    const errorBody = await response.json()
                    if (errorBody?.detail) detail = errorBody.detail
                } catch {
                    // ignore — body wasn't JSON
                }
                throw new Error(detail)
            }

            const result = await response.json()

            if (!result.success) {
                alert('Error processing files: ' + result.error)
                setProcessing(false, 0)
                return
            }

            setResults({
                resultCount: result.resultCount,
                intersectionCount: result.intersectionCount,
                setACount: result.setACount,
                setBCount: result.setBCount,
                intersectionData: [],
                headers: result.headers,
                jobId: result.jobId,
            })
            setDownloadUrl(resolveDownloadUrl(result.downloadUrl))
            if (processingStartRef.current !== null) {
                setProcessingElapsedSeconds((performance.now() - processingStartRef.current) / 1000)
            }
            setProcessing(false, 100)
        } catch (error) {
            processingStartRef.current = null
            alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
            setProcessingElapsedSeconds(0)
            setProcessing(false, 0)
        }
    }

    useEffect(() => {
        const clearTimer = () => {
            if (timerRef.current !== null) {
                globalThis.clearInterval(timerRef.current)
                timerRef.current = null
            }
        }

        if (isProcessing) {
            const updateElapsed = () => {
                if (processingStartRef.current !== null) {
                    setProcessingElapsedSeconds((performance.now() - processingStartRef.current) / 1000)
                }
            }

            updateElapsed()
            timerRef.current = globalThis.setInterval(updateElapsed, 200)
        } else {
            clearTimer()
            processingStartRef.current = null
        }

        return clearTimer
    }, [isProcessing, setProcessingElapsedSeconds])

    const handleFileSelect = () => {
        setDownloadUrl('')
    }

    return (
        <>
            <Head>
                <title>Marketing Audience Segmentation Tool</title>
                <meta name="description" content="High-performance web app for marketing teams to intersect, merge, and exclude multi-million-row audience files in seconds." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />

                {/* Open Graph (LinkedIn, Facebook, Slack, Discord previews) */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://campaign-audience-sizing-tool.vercel.app/" />
                <meta property="og:site_name" content="Marketing Audience Segmentation Tool" />
                <meta property="og:title" content="Marketing Audience Segmentation Tool" />
                <meta property="og:description" content="Process multi-gigabyte audience files instantly. Intersection, merger, exclusion + A/B split exports. Built with Polars + FastAPI on Google Cloud Run." />
                <meta property="og:image" content="https://campaign-audience-sizing-tool.vercel.app/og-thumbnail.png" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:image:alt" content="Marketing Audience Segmentation Tool dashboard preview" />

                {/* Twitter / X card */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Marketing Audience Segmentation Tool" />
                <meta name="twitter:description" content="Process multi-gigabyte audience files instantly. Intersection, merger, exclusion + A/B split exports." />
                <meta name="twitter:image" content="https://campaign-audience-sizing-tool.vercel.app/og-thumbnail.png" />
            </Head>

            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 smooth-shadow">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                                    🎯 Marketing Audience Segmentation Tool
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    Process multi-gigabyte datasets without Excel row limits. Instantly export optimized target lists.
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                                    aria-label="Toggle theme"
                                >
                                    {theme === 'dark'
                                        ? <Sun className="w-5 h-5 text-amber-400" />
                                        : <Moon className="w-5 h-5 text-slate-600" />}
                                </button>
                                <button
                                    onClick={reset}
                                    disabled={isProcessing}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Reset all data"
                                >
                                    <RefreshCw className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">

                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        {/* Left Column: Upload */}
                        <div className="lg:col-span-1 flex flex-col">
                            <FileUpload onFileSelect={handleFileSelect} />

                            {/* Flex spacer pushes button to align with Export on the right */}
                            <div className="flex-grow min-h-4" />

                            <button
                                onClick={handleProcess}
                                disabled={!fileA || !fileB || !fileAKey || !fileBKey || isProcessing}
                                className={`w-full disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition smooth-shadow hover-lift ${buttonCfg.className}`}
                            >
                                {isProcessing ? 'Processing...' : buttonLabel}
                            </button>

                            {processingElapsedSeconds > 0 && (
                                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-slate-300 text-center">
                                    {isProcessing
                                        ? `Elapsed: ${processingElapsedSeconds.toFixed(1)}s`
                                        : `Completed in ${processingElapsedSeconds.toFixed(1)}s`}
                                </p>
                            )}
                        </div>

                        {/* Right Side: Diagram + Filter Button */}
                        <div className="lg:col-span-2 flex flex-col">
                            <VennDiagram />

                            {resultCount > 0 && (
                                <button
                                    onClick={() => setShowFilterModal(true)}
                                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Export Audience
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Results Table + Preview */}
                    <div className="grid grid-cols-1 gap-6">
                        <ResultsTable />
                        <ResultsPreview />
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 mt-8">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-2 items-center justify-between text-sm text-gray-500 dark:text-slate-400">
                        {/* Left Side */}
                        <span>
                            Built by <span className="font-semibold text-gray-700 dark:text-slate-200">Chaw Thinn</span> · 2026
                        </span>

                        {/* Right Side */}
                        <p className="text-zinc-600 dark:text-zinc-400 text-center sm:text-right">
                            Check out my full portfolio and other projects at{" "}
                            <a
                                href="https://chawthinn.github.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
                            >
                                chawthinn.github.io
                            </a>
                        </p>
                    </div>
                </footer>

                {/* Filter Modal */}
                {showFilterModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto smooth-shadow">
                            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Export Audience</h2>
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="p-6">
                                <FilterPanel />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
