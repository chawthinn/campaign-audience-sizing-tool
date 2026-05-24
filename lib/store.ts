import { create } from 'zustand'

export interface AudienceState {
    // File state
    fileA: File | null
    fileB: File | null
    setFileA: (file: File | null) => void
    setFileB: (file: File | null) => void

    // Session state
    sessionId: string | null
    setSessionId: (id: string | null) => void

    // Results state
    intersectionCount: number
    setACount: number
    setBCount: number
    intersectionData: Array<Record<string, any>>
    headers: string[]
    columnDataTypes: Record<string, string>
    setResults: (counts: {
        intersectionCount: number
        setACount: number
        setBCount: number
        intersectionData: Array<Record<string, any>>
        headers: string[]
        columnDataTypes?: Record<string, string>
    }) => void

    // Processing state
    isProcessing: boolean
    progress: number
    setProcessing: (processing: boolean, progress?: number) => void

    // Search and sort state
    searchQuery: string
    sortColumn: string | null
    sortDirection: 'asc' | 'desc'
    exportColumns: string[]
    setSearchQuery: (query: string) => void
    setSortColumn: (column: string | null, direction?: 'asc' | 'desc') => void
    setExportColumns: (columns: string[]) => void

    // Pagination state
    currentPage: number
    pageSize: number
    setCurrentPage: (page: number) => void
    setPageSize: (size: number) => void

    // Reset
    reset: () => void
}

export const useAudienceStore = create<AudienceState>((set) => ({
    // Initial file state
    fileA: null,
    fileB: null,
    setFileA: (file) => set({ fileA: file }),
    setFileB: (file) => set({ fileB: file }),

    // Initial session state
    sessionId: null,
    setSessionId: (id) => set({ sessionId: id }),

    // Initial results state
    intersectionCount: 0,
    setACount: 0,
    setBCount: 0,
    intersectionData: [],
    headers: [],
    columnDataTypes: {},
    setResults: (counts) => set({
        intersectionCount: counts.intersectionCount,
        setACount: counts.setACount,
        setBCount: counts.setBCount,
        intersectionData: counts.intersectionData,
        headers: counts.headers,
        columnDataTypes: counts.columnDataTypes || {},
    }),

    // Initial processing state
    isProcessing: false,
    progress: 0,
    setProcessing: (processing, progress = 0) => set({ isProcessing: processing, progress }),

    // Initial search and sort state
    searchQuery: '',
    sortColumn: null,
    sortDirection: 'asc',
    exportColumns: [],
    setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
    setSortColumn: (column, direction = 'asc') => set({ sortColumn: column, sortDirection: direction, currentPage: 1 }),
    setExportColumns: (columns) => set({ exportColumns: columns }),

    // Initial pagination state
    currentPage: 1,
    pageSize: 20,
    setCurrentPage: (page) => set({ currentPage: page }),
    setPageSize: (size) => set({ pageSize: size }),

    // Reset function
    reset: () =>
        set({
            fileA: null,
            fileB: null,
            sessionId: null,
            intersectionCount: 0,
            setACount: 0,
            setBCount: 0,
            intersectionData: [],
            headers: [],
            columnDataTypes: {},
            isProcessing: false,
            progress: 0,
            searchQuery: '',
            sortColumn: null,
            sortDirection: 'asc',
            exportColumns: [],
            currentPage: 1,
        }),
}))
