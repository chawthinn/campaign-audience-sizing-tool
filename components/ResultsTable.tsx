import React from 'react'
import { useAudienceStore } from '@/lib/store'
import { Download } from 'lucide-react'

export const ResultsTable: React.FC = () => {
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const setACount = useAudienceStore((state) => state.setACount)
    const setBCount = useAudienceStore((state) => state.setBCount)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)

    if (intersectionCount === 0) {
        return (
            <div className="p-6 bg-white rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Results</h2>
                <p className="text-gray-400 text-sm">Process files to see the intersection summary.</p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow space-y-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Results</h2>
                <p className="text-sm text-gray-500">The Python backend generated the intersected audience and stored the CSV for download.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Set A</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{setACount.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Set B</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{setBCount.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Intersection</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-900">{intersectionCount.toLocaleString()}</div>
                </div>
            </div>

            {downloadUrl && (
                <a
                    href={downloadUrl}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                    <Download className="w-4 h-4" />
                    Download the generated CSV
                </a>
            )}
        </div>
    )
}
