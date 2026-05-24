import React from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download } from 'lucide-react'

export const FilterPanel: React.FC = () => {
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const [exporting, setExporting] = React.useState(false)

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

    if (intersectionCount === 0) {
        return (
            <div className="p-6 bg-white rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900">Export</h2>
                <p className="text-gray-400 text-sm mt-4">
                    No data available. Process files first.
                </p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Export</h2>

            {/* Data Summary */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                <p className="font-semibold">
                    {intersectionCount.toLocaleString()} records
                </p>
                <p className="text-xs text-blue-600 mt-1">
                    Download is ready from the Python backend.
                </p>
            </div>

            {/* Export Button */}
            <button
                onClick={handleExport}
                disabled={exporting || !downloadUrl}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                {exporting ? 'Opening...' : `Download CSV (${intersectionCount.toLocaleString()} records)`}
            </button>
        </div>
    )
}
