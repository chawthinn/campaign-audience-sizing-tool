import React from 'react'
import { useAudienceStore } from '@/lib/store'

export const FilterPanel: React.FC = () => {
    const sessionId = useAudienceStore((state) => state.sessionId)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const downloadUrl = useAudienceStore((state) => state.downloadUrl)
    const [exporting, setExporting] = React.useState(false)
    const [action, setAction] = React.useState<'intersection'>('intersection')

    const handleExport = async () => {
        if (!downloadUrl) {
            alert('No downloadable CSV available. Please process files first.')
            return
        }

        setExporting(true)
        try {
            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = downloadUrl.split('/').pop() || 'audience_intersection.csv'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            alert('Export started')
        } catch (err) {
            console.error(err)
            alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown'))
        } finally {
            setExporting(false)
        }
    }

    if (intersectionCount === 0) {
        return (
            <div className="p-6 bg-white rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900">Action & Export</h2>
                <p className="text-gray-400 text-sm mt-4">No data available. Upload and process both CSV files first.</p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Action & Export</h2>

            <div>
                <label className="block text-sm font-medium text-gray-700">Choose action</label>
                <div className="mt-2">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="action"
                            value="intersection"
                            checked={action === 'intersection'}
                            onChange={() => setAction('intersection')}
                            className="mr-2"
                        />
                        Intersection (current)
                    </label>
                </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                <p className="font-semibold">{intersectionCount.toLocaleString()} records</p>
                <p className="text-xs text-blue-600 mt-1">Current action: {action}</p>
            </div>

            <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {exporting ? 'Exporting...' : `Export as CSV (${intersectionCount.toLocaleString()} records)`}
            </button>
        </div>
    )
}
