import React from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download } from 'lucide-react'

export const FilterPanel: React.FC = () => {
    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)
    const resultCount = useAudienceStore((state) => state.resultCount)
    const [exporting, setExporting] = React.useState(false)

    const isMerger = action === 'merger'
    const isExclusion = action === 'exclusion'
    const directionLabel = exclusionDirection === 'a_minus_b' ? 'A − B' : 'B − A'
    const label = isMerger
        ? 'Merger (Union)'
        : isExclusion
            ? `Exclusion (${directionLabel})`
            : 'Intersection'

    const handleExport = async () => {
        if (!downloadUrl) {
            alert('No download available. Process files first.')
            return
        }

        setExporting(true)
        try {
            const downloadLink = globalThis.document.createElement('a')
            downloadLink.href = downloadUrl
            downloadLink.target = '_blank'
            downloadLink.rel = 'noreferrer'
            globalThis.document.body.appendChild(downloadLink)
            downloadLink.click()
            downloadLink.remove()
        } catch (error) {
            console.error('Export error:', error)
            alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setExporting(false)
        }
    }

    if (resultCount === 0) {
        return (
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Export</h3>
                <p className="text-gray-400 text-sm">No data available. Upload and process both CSV files first.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${
                isExclusion
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : isMerger
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
                <p className="font-semibold">
                    {resultCount.toLocaleString()} records — {label}
                </p>
                <p className="text-xs mt-1 opacity-80">
                    File ready for download.
                </p>
            </div>

            <button
                onClick={handleExport}
                disabled={exporting || !downloadUrl}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                {exporting ? 'Opening...' : `Download CSV (${resultCount.toLocaleString()} records)`}
            </button>
        </div>
    )
}
