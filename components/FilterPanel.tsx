import React from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download, Check } from 'lucide-react'

export const FilterPanel: React.FC = () => {
    const sessionId = useAudienceStore((state) => state.sessionId)
    const headers = useAudienceStore((state) => state.headers)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const searchQuery = useAudienceStore((state) => state.searchQuery)
    const sortColumn = useAudienceStore((state) => state.sortColumn)
    const sortDirection = useAudienceStore((state) => state.sortDirection)
    const exportColumns = useAudienceStore((state) => state.exportColumns)
    const columnDataTypes = useAudienceStore((state) => state.columnDataTypes)
    const setExportColumns = useAudienceStore((state) => state.setExportColumns)
    const [exporting, setExporting] = React.useState(false)

    const handleExport = async () => {
        console.log('Export clicked. SessionId:', sessionId)
        
        if (!sessionId) {
            alert('No session ID. Did you process files?')
            return
        }

        setExporting(true)
        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    search: searchQuery || undefined,
                    sortColumn: sortColumn || undefined,
                    sortDirection,
                    columns: exportColumns.length > 0 ? exportColumns : undefined,
                }),
            })

            console.log('Export response status:', response.status)
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const blob = await response.blob()
            console.log('Export blob size:', blob.size)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'audience_intersection.csv'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            alert('Export successful!')
        } catch (error) {
            console.error('Export error:', error)
            alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setExporting(false)
        }
    }

    const toggleColumn = (col: string) => {
        if (exportColumns.includes(col)) {
            setExportColumns(exportColumns.filter((c) => c !== col))
        } else {
            setExportColumns([...exportColumns, col])
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
                {searchQuery && (
                    <p className="text-xs text-blue-600 mt-1">
                        Filtered by search query
                    </p>
                )}
                {sortColumn && (
                    <p className="text-xs text-blue-600 mt-1">
                        Sorted by {sortColumn}
                    </p>
                )}
            </div>

            {/* Select Columns for Export */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    Columns to Export ({exportColumns.length === 0 ? 'All' : exportColumns.length})
                </label>
                <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-2 max-h-40 overflow-y-auto">
                    {headers.map((header) => (
                        <button
                            key={header}
                            onClick={() => toggleColumn(header)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition text-left ${
                                exportColumns.includes(header) || exportColumns.length === 0
                                    ? 'bg-blue-100 text-blue-900'
                                    : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <Check
                                className={`w-4 h-4 flex-shrink-0 ${
                                    exportColumns.includes(header) || exportColumns.length === 0
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                }`}
                            />
                            <span className="flex-1">{header}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-300 rounded flex-shrink-0">
                                {columnDataTypes[header] || 'Unknown'}
                            </span>
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500">
                    {exportColumns.length === 0
                        ? 'All columns will be exported'
                        : `${exportColumns.length} column${exportColumns.length === 1 ? '' : 's'} selected`}
                </p>
            </div>

            {/* Export Button */}
            <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : `Export as CSV (${intersectionCount.toLocaleString()} records)`}
            </button>
        </div>
    )
}
