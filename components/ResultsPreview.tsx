import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudienceStore } from '@/lib/store'
import { buildApiUrl } from '@/lib/backend'
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react'

type SortDirection = 'asc' | 'desc'

interface PreviewResponse {
    rows: Array<Record<string, unknown>>
    headers: string[]
    totalRows: number
    page: number
    pageSize: number
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const SEARCH_DEBOUNCE_MS = 350

function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(id)
    }, [value, delay])
    return debounced
}

export const ResultsPreview: React.FC = () => {
    const jobId = useAudienceStore((state) => state.jobId)
    const headers = useAudienceStore((state) => state.headers)
    const resultCount = useAudienceStore((state) => state.resultCount)

    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [globalSearch, setGlobalSearch] = useState('')
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
    const [totalRows, setTotalRows] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const debouncedSearch = useDebounced(globalSearch, SEARCH_DEBOUNCE_MS)
    const debouncedFilters = useDebounced(columnFilters, SEARCH_DEBOUNCE_MS)

    const abortRef = useRef<AbortController | null>(null)

    // Reset page when filters/search/sort/jobId change
    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, debouncedFilters, sortColumn, sortDirection, jobId])

    // Reset everything when jobId changes (new analysis)
    useEffect(() => {
        setGlobalSearch('')
        setColumnFilters({})
        setSortColumn(null)
        setSortDirection('asc')
    }, [jobId])

    const fetchPreview = useCallback(async () => {
        if (!jobId) return

        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        const params = new URLSearchParams({
            page: String(page),
            page_size: String(pageSize),
        })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (sortColumn) {
            params.set('sort_column', sortColumn)
            params.set('sort_direction', sortDirection)
        }
        const activeFilters = Object.fromEntries(
            Object.entries(debouncedFilters).filter(([, v]) => v.trim() !== '')
        )
        if (Object.keys(activeFilters).length > 0) {
            params.set('filters', JSON.stringify(activeFilters))
        }

        setLoading(true)
        setError(null)
        try {
            const response = await fetch(
                buildApiUrl(`/preview/${jobId}?${params.toString()}`),
                { signal: controller.signal },
            )
            if (!response.ok) {
                let detail = `HTTP ${response.status}`
                try {
                    const body = await response.json()
                    if (body?.detail) detail = body.detail
                } catch {}
                throw new Error(detail)
            }
            const data: PreviewResponse = await response.json()
            if (controller.signal.aborted) return
            setRows(data.rows)
            setTotalRows(data.totalRows)
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return
            setError(err instanceof Error ? err.message : 'Failed to load preview')
            setRows([])
            setTotalRows(0)
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false)
            }
        }
    }, [jobId, page, pageSize, debouncedSearch, debouncedFilters, sortColumn, sortDirection])

    useEffect(() => {
        fetchPreview()
        return () => abortRef.current?.abort()
    }, [fetchPreview])

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
    const endRow = Math.min(page * pageSize, totalRows)
    const isFiltered = debouncedSearch !== '' || Object.values(debouncedFilters).some((v) => v.trim() !== '')

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    const updateFilter = (column: string, value: string) => {
        setColumnFilters((prev) => ({ ...prev, [column]: value }))
    }

    const clearAllFilters = () => {
        setGlobalSearch('')
        setColumnFilters({})
    }

    const displayHeaders = useMemo(() => (rows[0] ? Object.keys(rows[0]) : headers), [rows, headers])

    if (!jobId || resultCount === 0) {
        return null
    }

    return (
        <div className="bg-white rounded-lg smooth-shadow overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">Data Preview</h3>
                        <span className="text-xs text-gray-500">
                            Showing {startRow.toLocaleString()}–{endRow.toLocaleString()} of {totalRows.toLocaleString()}
                            {isFiltered && totalRows !== resultCount && (
                                <> (filtered from {resultCount.toLocaleString()})</>
                            )}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                        Search, sort, and filter across all {resultCount.toLocaleString()} records — click any column header to sort.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            placeholder="Search all columns…"
                            className="pl-7 pr-8 py-1.5 text-sm border border-gray-300 rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {globalSearch && (
                            <button
                                onClick={() => setGlobalSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                title="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    {isFiltered && (
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                            Clear all
                        </button>
                    )}
                    {loading && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="relative overflow-auto max-h-[600px] border-t border-gray-200">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-100">
                        <tr>
                            {displayHeaders.map((col) => {
                                const isSorted = sortColumn === col
                                return (
                                    <th
                                        key={col}
                                        onClick={() => handleSort(col)}
                                        className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>{col}</span>
                                            {isSorted && (
                                                sortDirection === 'asc'
                                                    ? <ArrowUp className="w-3 h-3" />
                                                    : <ArrowDown className="w-3 h-3" />
                                            )}
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>
                        <tr>
                            {displayHeaders.map((col) => (
                                <th
                                    key={`filter-${col}`}
                                    className="px-2 py-1 border-b border-r border-gray-300 bg-gray-50"
                                >
                                    <input
                                        type="text"
                                        value={columnFilters[col] ?? ''}
                                        onChange={(e) => updateFilter(col, e.target.value)}
                                        placeholder="Filter…"
                                        className="w-full px-2 py-1 text-xs font-normal border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && !loading && (
                            <tr>
                                <td
                                    colSpan={displayHeaders.length}
                                    className="px-3 py-10 text-center text-gray-400 text-sm"
                                >
                                    {error ? `Error: ${error}` : 'No matching rows'}
                                </td>
                            </tr>
                        )}
                        {rows.map((row, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className={rowIdx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}
                            >
                                {displayHeaders.map((col) => {
                                    const val = row[col]
                                    const display = val === null || val === undefined || val === ''
                                        ? '—'
                                        : String(val)
                                    return (
                                        <td
                                            key={col}
                                            className="px-3 py-1.5 border-b border-r border-gray-200 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis text-gray-800"
                                            title={display}
                                        >
                                            {display}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-gray-200 bg-gray-50 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                    <span>Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {PAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-gray-600 px-2">
                        Page <input
                            type="number"
                            value={page}
                            onChange={(e) => {
                                const v = Number(e.target.value)
                                if (!Number.isNaN(v) && v >= 1 && v <= totalPages) setPage(v)
                            }}
                            className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm"
                            min={1}
                            max={totalPages}
                        /> of {totalPages.toLocaleString()}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
