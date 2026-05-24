import React, { useEffect, useMemo, useState } from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download, CheckSquare, Square } from 'lucide-react'

export const FilterPanel: React.FC = () => {
    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)
    const resultCount = useAudienceStore((state) => state.resultCount)
    const headers = useAudienceStore((state) => state.headers)

    const [selected, setSelected] = useState<string[]>([])
    const [exporting, setExporting] = useState(false)

    // Initialize / reset selection whenever the result headers change
    useEffect(() => {
        setSelected(headers)
    }, [headers])

    const isMerger = action === 'merger'
    const isExclusion = action === 'exclusion'
    const directionLabel = exclusionDirection === 'a_minus_b' ? 'A − B' : 'B − A'
    const label = isMerger
        ? 'Merger (Union)'
        : isExclusion
            ? `Exclusion (${directionLabel})`
            : 'Intersection'

    const allSelected = selected.length === headers.length && headers.length > 0
    const noneSelected = selected.length === 0
    const isSubset = !allSelected && !noneSelected

    const toggleColumn = (col: string) => {
        setSelected((prev) =>
            prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
        )
    }

    const selectAll = () => setSelected(headers)
    const selectNone = () => setSelected([])

    const finalUrl = useMemo(() => {
        if (!downloadUrl) return ''
        if (!isSubset) return downloadUrl
        const cols = selected
            // Keep the original header order so the CSV reads naturally
            .slice()
            .sort((a, b) => headers.indexOf(a) - headers.indexOf(b))
            .map(encodeURIComponent)
            .join(',')
        const sep = downloadUrl.includes('?') ? '&' : '?'
        return `${downloadUrl}${sep}columns=${cols}`
    }, [downloadUrl, isSubset, selected, headers])

    const handleExport = async () => {
        if (!finalUrl) {
            alert('No download available. Process files first.')
            return
        }
        if (noneSelected) {
            alert('Pick at least one column to export.')
            return
        }
        setExporting(true)
        try {
            const link = globalThis.document.createElement('a')
            link.href = finalUrl
            link.target = '_blank'
            link.rel = 'noreferrer'
            globalThis.document.body.appendChild(link)
            link.click()
            link.remove()
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

            {headers.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Columns to export <span className="text-gray-400 font-normal">({selected.length}/{headers.length})</span>
                        </h4>
                        <div className="flex gap-2 text-xs">
                            <button
                                onClick={selectAll}
                                disabled={allSelected}
                                className="text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
                            >
                                Select all
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                onClick={selectNone}
                                disabled={noneSelected}
                                className="text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
                            >
                                None
                            </button>
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-0.5 bg-gray-50">
                        {headers.map((col) => {
                            const checked = selected.includes(col)
                            return (
                                <label
                                    key={col}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white cursor-pointer text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleColumn(col)}
                                        className="sr-only"
                                    />
                                    {checked
                                        ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                        : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                    <span className="font-mono text-xs text-gray-700 truncate">{col}</span>
                                </label>
                            )
                        })}
                    </div>
                </div>
            )}

            <button
                onClick={handleExport}
                disabled={exporting || !downloadUrl || noneSelected}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                {exporting
                    ? 'Opening…'
                    : `Download CSV (${resultCount.toLocaleString()} rows × ${selected.length} cols)`}
            </button>
        </div>
    )
}
