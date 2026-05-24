import React, { useState } from 'react'
import Head from 'next/head'
import { FileUpload } from '@/components/FileUpload'
import { VennDiagram } from '@/components/VennDiagram'
import { FilterPanel } from '@/components/FilterPanel'
import { ResultsTable } from '@/components/ResultsTable'
import { useAudienceStore } from '@/lib/store'
import { RefreshCw, Settings } from 'lucide-react'

export default function Home() {
    const [showFilterModal, setShowFilterModal] = useState(false)
    const fileA = useAudienceStore((state) => state.fileA)
    const fileB = useAudienceStore((state) => state.fileB)
    const isProcessing = useAudienceStore((state) => state.isProcessing)
    const setProcessing = useAudienceStore((state) => state.setProcessing)
    const setResults = useAudienceStore((state) => state.setResults)
    const setSessionId = useAudienceStore((state) => state.setSessionId)
    const reset = useAudienceStore((state) => state.reset)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)

    const handleProcess = async () => {
        if (!fileA || !fileB) {
            alert('Please upload both files')
            return
        }

        setProcessing(true, 0)
        try {
            const formData = new FormData()
            formData.append('fileA', fileA)
            formData.append('fileB', fileB)

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error('Server error')
            }

            const result = await response.json()

            if (!result.success) {
                alert('Error processing files: ' + result.error)
                setProcessing(false, 0)
                return
            }

            console.log('[Process] Got sessionId:', result.sessionId)
            setSessionId(result.sessionId)
            setResults({
                intersectionCount: result.intersectionCount,
                setACount: result.setACount,
                setBCount: result.setBCount,
                intersectionData: [],
                headers: result.headers,
            })
            setProcessing(false, 100)
        } catch (error) {
            alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
            setProcessing(false, 0)
        }
    }

    const handleFileSelect = () => {
        // No need to reset - files are already in the store
    }

    return (
        <>
            <Head>
                <title>Campaign Audience Sizing Tool</title>
                <meta name="description" content="Real-time audience intersection analysis" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-white border-b border-gray-200 smooth-shadow">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    🎯 Campaign Audience Sizing Tool
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Real-time audience intersection analysis for marketing campaigns
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
                <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Grid Layout: Left 1 col (Upload), Right 2 cols (Intersection + Button) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Left Column: Upload (1 col) */}
                        <div className="lg:col-span-1">
                            <FileUpload onFileSelect={() => { }} />

                            {/* Process Button */}
                            <button
                                onClick={handleProcess}
                                disabled={!fileA || !fileB || isProcessing}
                                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition smooth-shadow hover-lift"
                            >
                                {isProcessing ? 'Processing...' : 'Analyze Intersection'}
                            </button>
                        </div>

                        {/* Right Side: Venn Diagram + Filter Button (2 cols) */}
                        <div className="lg:col-span-2">
                            <div className="space-y-4">
                                <VennDiagram />

                                {/* Filter Button */}
                                {intersectionCount > 0 && (
                                    <button
                                        onClick={() => setShowFilterModal(true)}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Filters & Export
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Results Table */}
                    <div className="grid grid-cols-1 gap-6">
                        <ResultsTable />
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-12 border-t border-gray-200 bg-white py-6">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-600">
                        <p>
                            Built for marketing teams to estimate eligible audience counts from large datasets
                        </p>
                    </div>
                </footer>

                {/* Filter Modal */}
                {showFilterModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto smooth-shadow">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900">Filters & Export</h2>
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Content */}
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
