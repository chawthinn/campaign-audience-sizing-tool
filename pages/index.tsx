import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { FileUpload } from '@/components/FileUpload'
import { VennDiagram } from '@/components/VennDiagram'
import { FilterPanel } from '@/components/FilterPanel'
import { ResultsTable } from '@/components/ResultsTable'
import { ResultsPreview } from '@/components/ResultsPreview'
import { useAudienceStore } from '@/lib/store'
import { buildApiUrl, resolveDownloadUrl } from '@/lib/backend'
import { RefreshCw, Settings } from 'lucide-react'

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

export default function Home() {
    const [showFilterModal, setShowFilterModal] = useState(false)
    const processingStartRef = useRef<number | null>(null)
    const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null)

    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const fileA = useAudienceStore((state) => state.fileA)
    const fileB = useAudienceStore((state) => state.fileB)
    const fileAKey = useAudienceStore((state) => state.fileAKey)
    const fileBKey = useAudienceStore((state) => state.fileBKey)
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
            const formData = new FormData()
            formData.append('fileA', fileA)
            formData.append('fileB', fileB)
            formData.append('action', action)
            formData.append('key_a', fileAKey)
            formData.append('key_b', fileBKey)
            if (action === 'exclusion') {
                formData.append('direction', exclusionDirection)
            }

            const response = await fetch(buildApiUrl('/process'), {
                method: 'POST',
                body: formData,
            })

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
                <title>Campaign Audience Sizing Tool</title>
                <meta name="description" content="Real-time audience intersection and merger analysis" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-white border-b border-gray-200 smooth-shadow">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    🎯 Campaign Audience Sizing Tool
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    Audience intersection &amp; merger analysis for marketing campaigns
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                disabled={isProcessing}
                                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reset all data"
                            >
                                <RefreshCw className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">

                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        {/* Left Column: Upload */}
                        <div className="lg:col-span-1">
                            <FileUpload onFileSelect={handleFileSelect} />

                            <button
                                onClick={handleProcess}
                                disabled={!fileA || !fileB || !fileAKey || !fileBKey || isProcessing}
                                className={`w-full mt-4 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition smooth-shadow hover-lift ${buttonCfg.className}`}
                            >
                                {isProcessing ? 'Processing...' : buttonLabel}
                            </button>

                            {processingElapsedSeconds > 0 && (
                                <p className="mt-2 text-sm font-medium text-gray-600 text-center">
                                    {isProcessing
                                        ? `Elapsed: ${processingElapsedSeconds.toFixed(1)}s`
                                        : `Completed in ${processingElapsedSeconds.toFixed(1)}s`}
                                </p>
                            )}
                        </div>

                        {/* Right Side: Diagram + Filter Button */}
                        <div className="lg:col-span-2">
                            <div className="space-y-4">
                                <VennDiagram />

                                {resultCount > 0 && (
                                    <button
                                        onClick={() => setShowFilterModal(true)}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Export Audience
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Results Table + Preview */}
                    <div className="grid grid-cols-1 gap-6">
                        <ResultsTable />
                        <ResultsPreview />
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-12 border-t border-gray-200 bg-white py-6">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                        Built for marketing teams to estimate eligible audience counts from large datasets
                    </div>
                </footer>

                {/* Filter Modal */}
                {showFilterModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto smooth-shadow">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900">Export Audience</h2>
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
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
