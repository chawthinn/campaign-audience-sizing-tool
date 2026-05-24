import React, { useEffect } from 'react'
import { useAudienceStore } from '@/lib/store'
import { Search, ArrowUp, ArrowDown } from 'lucide-react'

export const ResultsTable: React.FC = () => {
    const sessionId = useAudienceStore((state) => state.sessionId)
    const headers = useAudienceStore((state) => state.headers)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const searchQuery = useAudienceStore((state) => state.searchQuery)
    const sortColumn = useAudienceStore((state) => state.sortColumn)
    const sortDirection = useAudienceStore((state) => state.sortDirection)
    const setSearchQuery = useAudienceStore((state) => state.setSearchQuery)
    const setSortColumn = useAudienceStore((state) => state.setSortColumn)

    const [displayData, setDisplayData] = React.useState<Array<Record<string, any>>>([])
    const [loading, setLoading] = React.useState(false)

    // Fetch data from backend whenever search/sort changes
    useEffect(() => {
        if (!sessionId || headers.length === 0) {
            setDisplayData([])
            return
        }

        setLoading(true)
        fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                search: searchQuery || undefined,
                sortColumn: sortColumn || undefined,
                sortDirection,
                offset: 0,
                limit: 1000,
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                console.log('Query response:', data)
                if (data.success) {
                    setDisplayData(data.data)
                } else {
                    console.error('Query error:', data.error)
                }
            })
            .catch((error) => console.error('Query failed:', error))
            .finally(() => setLoading(false))
    }, [sessionId, searchQuery, sortColumn, sortDirection, headers])

    const visibleHeaders = headers

    if (intersectionCount === 0) {
        return (
            <div className="p-6 bg-white rounded-lg smooth-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Preview Results</h2>
                <p className="text-gray-400 text-sm">
                    Process files to see results
                </p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow space-y-4">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Preview Results</h2>
                <p className="text-xs text-gray-500">
                    Showing {displayData.length.toLocaleString()} of {intersectionCount.toLocaleString()} records {searchQuery && '(filtered)'}
                </p>
            </div>

            {/* Search Box */}
            <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search across all columns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
            </div>

            {/* Scrollable Table Container - Excel-like */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '600px' }}>
                    <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead className="sticky top-0 bg-gray-100 border-b border-gray-300 z-10">
                            <tr>
                                {/* Row Number Column */}
                                <th className="w-12 px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 bg-gray-100">
                                    #
                                </th>
                                {visibleHeaders.map((header) => (
                                    <th
                                        key={header}
                                        onClick={() => {
                                            if (sortColumn === header) {
                                                setSortColumn(header, sortDirection === 'asc' ? 'desc' : 'asc')
                                            } else {
                                                setSortColumn(header, 'asc')
                                            }
                                        }}
                                        className="px-4 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition border-r border-gray-300 whitespace-nowrap"
                                    >
                                        <div className="flex items-center gap-2">
                                            {header}
                                            {sortColumn === header && (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                )
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={visibleHeaders.length + 1} className="px-4 py-8 text-center text-gray-400">
                                        Loading...
                                    </td>
                                </tr>
                            ) : displayData.length > 0 ? (
                                displayData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        className={`border-b border-gray-200 hover:bg-blue-50 transition ${
                                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        }`}
                                    >
                                        {/* Row Number */}
                                        <td className="w-12 px-3 py-2 text-center text-gray-500 text-xs border-r border-gray-300 font-medium">
                                            {idx + 1}
                                        </td>
                                        {visibleHeaders.map((header) => (
                                            <td
                                                key={header}
                                                className="px-4 py-2 text-gray-700 border-r border-gray-300 max-w-xs"
                                            >
                                                <span className="truncate block" title={row[header]}>
                                                    {row[header] || '-'}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleHeaders.length + 1} className="px-4 py-8 text-center text-gray-400">
                                        No records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stats Footer */}
            <div className="flex justify-between items-center text-xs text-gray-600 px-2">
                <span>
                    Total: <span className="font-semibold">{intersectionCount.toLocaleString()}</span> records
                </span>
                {headers.length > visibleHeaders.length && (
                    <span className="text-gray-500">
                        Scroll right to see more columns →
                    </span>
                )}
            </div>
        </div>
    )
}
