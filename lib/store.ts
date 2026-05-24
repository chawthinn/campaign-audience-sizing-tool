import { create } from 'zustand'

export type AudienceAction = 'intersection' | 'merger' | 'exclusion'
export type ExclusionDirection = 'a_minus_b' | 'b_minus_a'

export interface AudienceState {
    // Operation mode
    action: AudienceAction
    switchAction: (action: AudienceAction) => void
    exclusionDirection: ExclusionDirection
    setExclusionDirection: (direction: ExclusionDirection) => void

    // File state
    fileA: File | null
    fileB: File | null
    setFileA: (file: File | null) => void
    setFileB: (file: File | null) => void

    // Results state
    resultCount: number        // main result count (intersection or union)
    intersectionCount: number  // always the inner-join overlap count
    setACount: number
    setBCount: number
    intersectionData: Array<Record<string, any>>
    headers: string[]
    downloadUrl: string
    processingElapsedSeconds: number
    columnDataTypes: Record<string, string>
    setResults: (counts: {
        resultCount: number
        intersectionCount: number
        setACount: number
        setBCount: number
        intersectionData: Array<Record<string, any>>
        headers: string[]
        columnDataTypes?: Record<string, string>
    }) => void
    setDownloadUrl: (url: string) => void
    setProcessingElapsedSeconds: (seconds: number) => void

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

const EMPTY_RESULTS = {
    resultCount: 0,
    intersectionCount: 0,
    setACount: 0,
    setBCount: 0,
    intersectionData: [],
    headers: [],
    downloadUrl: '',
    processingElapsedSeconds: 0,
    columnDataTypes: {},
}

export const useAudienceStore = create<AudienceState>((set) => ({
    // Operation mode
    action: 'intersection',
    switchAction: (action) => set({ action, ...EMPTY_RESULTS }),
    exclusionDirection: 'a_minus_b',
    setExclusionDirection: (direction) => set({ exclusionDirection: direction, ...EMPTY_RESULTS }),

    // Initial file state
    fileA: null,
    fileB: null,
    setFileA: (file) => set({ fileA: file }),
    setFileB: (file) => set({ fileB: file }),

    // Initial results state
    ...EMPTY_RESULTS,
    setResults: (counts) => set({
        resultCount: counts.resultCount,
        intersectionCount: counts.intersectionCount,
        setACount: counts.setACount,
        setBCount: counts.setBCount,
        intersectionData: counts.intersectionData,
        headers: counts.headers,
        columnDataTypes: counts.columnDataTypes || {},
    }),
    setDownloadUrl: (url) => set({ downloadUrl: url }),
    setProcessingElapsedSeconds: (seconds) => set({ processingElapsedSeconds: seconds }),

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
            ...EMPTY_RESULTS,
            isProcessing: false,
            progress: 0,
            searchQuery: '',
            sortColumn: null,
            sortDirection: 'asc',
            exportColumns: [],
            currentPage: 1,
        }),
}))
