import React, { useEffect, useMemo, useState } from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download, CheckSquare, Square, Shuffle } from 'lucide-react'

type SplitPreset = 'none' | '50-50' | '80-20' | '70-30' | 'custom'

const SPLIT_PRESETS: Array<{ value: SplitPreset; label: string }> = [
    { value: 'none', label: 'None' },
    { value: '50-50', label: '50/50' },
    { value: '80-20', label: '80/20' },
    { value: '70-30', label: '70/30' },
    { value: 'custom', label: 'Custom' },
]

export const FilterPanel: React.FC = () => {
    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)
    const resultCount = useAudienceStore((state) => state.resultCount)
    const headers = useAudienceStore((state) => state.headers)

    const [selected, setSelected] = useState<string[]>([])
    const [exporting, setExporting] = useState(false)
    const [splitPreset, setSplitPreset] = useState<SplitPreset>('none')
    const [customA, setCustomA] = useState(60)

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

    const splitParam = useMemo(() => {
        switch (splitPreset) {
            case '50-50': return '50,50'
            case '80-20': return '80,20'
            case '70-30': return '70,30'
            case 'custom': return `${customA},${100 - customA}`
            default: return ''
        }
    }, [splitPreset, customA])
    const isSplit = splitParam !== ''

    // Compute the file list shown in the Export Summary box
    const exportPackage = useMemo(() => {
        if (!isSplit) {
            return {
                files: [{
                    name: `${action}_results.csv`,
                    count: resultCount,
                    note: '',
                }],
                isZip: false,
            }
        }
        const parts = splitParam.split(',').map(Number)
        const counts = parts.map((pct) => Math.floor(resultCount * pct / 100))
        // Last group absorbs the rounding remainder (matches backend logic)
        const used = counts.reduce((a, b) => a + b, 0)
        if (counts.length > 0) {
            counts[counts.length - 1] += resultCount - used
        }
        const names = splitParam === '50,50'
            ? ['segment_a.csv', 'segment_b.csv']
            : splitParam === '80,20'
                ? ['target_group.csv', 'control_group.csv']
                : parts.map((_, i) => `segment_${String.fromCharCode(97 + i)}.csv`)
        const isEven = parts.every((p) => p === parts[0])
        const files = parts.map((pct, i) => ({
            name: names[i],
            count: counts[i],
            note: isEven ? `Randomized ${pct}%` : `${pct}%`,
        }))
        return { files, isZip: true }
    }, [isSplit, splitParam, resultCount, action])

    const finalUrl = useMemo(() => {
        if (!downloadUrl) return ''
        const params: string[] = []
        if (isSubset) {
            const cols = selected
                .slice()
                .sort((a, b) => headers.indexOf(a) - headers.indexOf(b))
                .map(encodeURIComponent)
                .join(',')
            params.push(`columns=${cols}`)
        }
        if (splitParam) {
            params.push(`split=${splitParam}`)
        }
        if (params.length === 0) return downloadUrl
        const sep = downloadUrl.includes('?') ? '&' : '?'
        return `${downloadUrl}${sep}${params.join('&')}`
    }, [downloadUrl, isSubset, selected, headers, splitParam])

    const handleExport = async () => {
        if (!finalUrl) { alert('No download available. Process files first.'); return }
        if (noneSelected) { alert('Pick at least one column to export.'); return }
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
        <div className="space-y-3">
            <div className={`p-2.5 rounded-lg border text-sm ${
                isExclusion
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : isMerger
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
                <p className="font-semibold">
                    {resultCount.toLocaleString()} records — {label}
                </p>
            </div>

            {/* Columns selector */}
            {headers.length > 0 && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Columns <span className="text-gray-400 font-normal">({selected.length}/{headers.length})</span>
                        </h4>
                        <div className="flex gap-2 text-xs">
                            <button
                                onClick={selectAll}
                                disabled={allSelected}
                                className="text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
                            >
                                All
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
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-1.5 space-y-0.5 bg-gray-50">
                        {headers.map((col) => {
                            const checked = selected.includes(col)
                            return (
                                <label
                                    key={col}
                                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-sm"
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

            {/* Random split */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-700">
                        Random split <span className="text-gray-400 font-normal">(optional)</span>
                    </h4>
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {SPLIT_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => setSplitPreset(preset.value)}
                            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition ${
                                splitPreset === preset.value
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
                {splitPreset === 'custom' && (
                    <div className="flex items-center gap-2 px-1 pt-0.5">
                        <span className="text-xs font-medium text-gray-600 w-10">A: {customA}%</span>
                        <input
                            type="range"
                            min={1}
                            max={99}
                            value={customA}
                            onChange={(e) => setCustomA(Number(e.target.value))}
                            className="flex-1 h-1.5 accent-blue-600"
                        />
                        <span className="text-xs font-medium text-gray-600 w-10 text-right">B: {100 - customA}%</span>
                    </div>
                )}
            </div>

            {/* Export Package Details */}
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-3 space-y-1.5">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Export Package Details
                </p>
                <ul className="space-y-1">
                    {exportPackage.files.map((f) => (
                        <li key={f.name} className="text-sm text-gray-700 leading-snug">
                            <span className="mr-1">📄</span>
                            <span className="font-mono font-semibold text-gray-900">{f.name}</span>
                            <span className="text-gray-600"> — {f.count.toLocaleString()} unique records</span>
                            {f.note && <span className="text-gray-500"> ({f.note})</span>}
                        </li>
                    ))}
                </ul>
                {exportPackage.isZip && headers.length > 0 && (
                    <p className="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
                        Both files include {selected.length} selected column{selected.length === 1 ? '' : 's'}
                        {selected.length <= 5 && <> ({selected.join(', ')})</>}.
                    </p>
                )}
            </div>

            <button
                onClick={handleExport}
                disabled={exporting || !downloadUrl || noneSelected}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4" />
                {exporting ? 'Opening…' : 'Download Audience'}
            </button>
        </div>
    )
}
