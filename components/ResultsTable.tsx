import React from 'react'
import { useAudienceStore } from '@/lib/store'

export const ResultsTable: React.FC = () => {
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)

    if (intersectionCount === 0) {
        return (
            <div className="p-6 bg-white rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Results</h2>
                <p className="text-gray-400 text-sm">No results yet. Upload and process both CSV files.</p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Results</h2>
            <p className="text-sm text-gray-700">Intersection count: <span className="font-semibold">{intersectionCount.toLocaleString()}</span></p>
            <p className="text-xs text-gray-500 mt-2">Use the Action & Export panel to export the results as CSV.</p>
        </div>
    )
}
