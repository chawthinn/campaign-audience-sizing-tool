import React from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download } from 'lucide-react'

export const ResultsTable: React.FC = () => {
    const action = useAudienceStore((state) => state.action)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const resultCount = useAudienceStore((state) => state.resultCount)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const setACount = useAudienceStore((state) => state.setACount)
    const setBCount = useAudienceStore((state) => state.setBCount)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)

    const isMerger = action === 'merger'
    const isExclusion = action === 'exclusion'
    const directionLabel = exclusionDirection === 'a_minus_b' ? 'A − B' : 'B − A'

    const resultLabel = isMerger
        ? 'Merger (Union)'
        : isExclusion
            ? `Exclusion (${directionLabel})`
            : 'Intersection'

    const placeholderLabel = isMerger
        ? 'merger'
        : isExclusion
            ? 'exclusion'
            : 'intersection'

    if (resultCount === 0) {
        return (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Results</h2>
                <p className="text-gray-400 dark:text-slate-500 text-sm">
                    Process files to see the {placeholderLabel} summary.
                </p>
            </div>
        )
    }

    const fourCol = isMerger || isExclusion

    return (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-lg smooth-shadow space-y-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Results</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Your audience list is ready. Download the complete file below.
                </p>
            </div>

            <div className={`grid gap-3 ${fourCol ? 'grid-cols-1 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Set A</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{setACount.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Set B</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{setBCount.toLocaleString()}</div>
                </div>
                {isMerger && (
                    <>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                            <div className="text-xs uppercase tracking-wide text-emerald-700">Merger (Union)</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-900">{resultCount.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                            <div className="text-xs uppercase tracking-wide text-purple-700">Overlap</div>
                            <div className="mt-1 text-2xl font-bold text-purple-900">{intersectionCount.toLocaleString()}</div>
                        </div>
                    </>
                )}
                {isExclusion && (
                    <>
                        <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                            <div className="text-xs uppercase tracking-wide text-orange-700">
                                Exclusion ({directionLabel})
                            </div>
                            <div className="mt-1 text-2xl font-bold text-orange-900">{resultCount.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-slate-400">Overlap (excluded)</div>
                            <div className="mt-1 text-2xl font-bold text-gray-800 dark:text-slate-100">{intersectionCount.toLocaleString()}</div>
                        </div>
                    </>
                )}
                {!isMerger && !isExclusion && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                        <div className="text-xs uppercase tracking-wide text-emerald-700">Intersection</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-900">{resultCount.toLocaleString()}</div>
                    </div>
                )}
            </div>

            {downloadUrl && (
                <a
                    href={downloadUrl}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                    <Download className="w-4 h-4" />
                    Download {resultLabel} CSV ({resultCount.toLocaleString()} records)
                </a>
            )}
        </div>
    )
}
