import Papa from 'papaparse'

export interface ProcessingResult {
    intersectionCount: number
    setACount: number
    setBCount: number
    intersectionData: Array<Record<string, any>>
    headers: string[]
    error?: string
}

/**
 * Process two CSV files and find intersection based on first column
 * Handles large files (3M+ rows) using streaming approach
 */
export async function processCSVIntersection(
    fileA: File,
    fileB: File,
    onProgress?: (progress: number) => void
): Promise<ProcessingResult> {
    try {
        // Step 1: Parse first file and collect IDs
        const idsA = new Set<string>()
        const dataA: Array<Record<string, any>> = []
        const headersA: string[] = []

        await new Promise<void>((resolve, reject) => {
            Papa.parse(fileA, {
                header: true,
                skipEmptyLines: true,
                chunk: (results) => {
                    if (results.data && Array.isArray(results.data)) {
                        results.data.forEach((row: any) => {
                            if (row && Object.keys(row).length > 0) {
                                const firstKey = Object.keys(row)[0]
                                const id = row[firstKey]?.toString().trim()
                                if (id) {
                                    idsA.add(id)
                                    dataA.push(row)
                                }
                            }
                        })
                    }
                    if (results.meta?.fields) {
                        headersA.push(...results.meta.fields.filter((h) => !headersA.includes(h)))
                    }
                },
                error: reject,
                complete: resolve,
            })
        })

        if (onProgress) onProgress(50)

        // Step 2: Parse second file and find intersections
        const idsBSet = new Set<string>()
        const intersectionData: Array<Record<string, any>> = []
        const headersB: string[] = []

        await new Promise<void>((resolve, reject) => {
            Papa.parse(fileB, {
                header: true,
                skipEmptyLines: true,
                chunk: (results) => {
                    if (results.data && Array.isArray(results.data)) {
                        results.data.forEach((row: any) => {
                            if (row && Object.keys(row).length > 0) {
                                const firstKey = Object.keys(row)[0]
                                const id = row[firstKey]?.toString().trim()
                                if (id) {
                                    idsBSet.add(id)
                                    if (idsA.has(id)) {
                                        intersectionData.push(row)
                                    }
                                }
                            }
                        })
                    }
                    if (results.meta?.fields) {
                        headersB.push(...results.meta.fields.filter((h) => !headersB.includes(h)))
                    }
                },
                error: reject,
                complete: resolve,
            })
        })

        if (onProgress) onProgress(100)

        return {
            intersectionCount: intersectionData.length,
            setACount: idsA.size,
            setBCount: idsBSet.size,
            intersectionData: intersectionData, // Return ALL intersection data
            headers: headersB,
        }
    } catch (error) {
        return {
            intersectionCount: 0,
            setACount: 0,
            setBCount: 0,
            intersectionData: [],
            headers: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

/**
 * Filter intersection data by column value
 */
export function filterByColumn(
    data: Array<Record<string, any>>,
    columnName: string,
    value: string
): Array<Record<string, any>> {
    return data.filter((row) => row[columnName]?.toString() === value)
}

/**
 * Get unique values for a column
 */
export function getColumnValues(
    data: Array<Record<string, any>>,
    columnName: string
): { value: string; count: number }[] {
    const valueCounts: Record<string, number> = {}

    data.forEach((row) => {
        const value = row[columnName]?.toString() || 'Unknown'
        valueCounts[value] = (valueCounts[value] || 0) + 1
    })

    return Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
}

/**
 * Detect data type for a column by sampling values
 */
export function detectColumnDataType(
    data: Array<Record<string, any>>,
    columnName: string
): string {
    if (data.length === 0) return 'Unknown'

    let intCount = 0
    let floatCount = 0
    let boolCount = 0
    let dateCount = 0
    let nonEmptyCount = 0

    for (let i = 0; i < Math.min(100, data.length); i++) {
        const value = data[i][columnName]
        if (value === null || value === undefined || value === '') continue

        nonEmptyCount++
        const str = String(value).trim().toLowerCase()

        // Check boolean
        if (str === 'true' || str === 'false' || str === 'yes' || str === 'no') {
            boolCount++
            continue
        }

        // Check date patterns
        if (
            /^\d{4}-\d{2}-\d{2}/.test(str) ||
            /^\d{2}\/\d{2}\/\d{4}/.test(str)
        ) {
            dateCount++
            continue
        }

        // Check number
        const num = Number(value)
        if (!isNaN(num)) {
            if (Number.isInteger(num)) {
                intCount++
            } else {
                floatCount++
            }
            continue
        }
    }

    if (nonEmptyCount === 0) return 'Empty'

    // Determine type based on majority
    const majorityThreshold = nonEmptyCount * 0.7

    if (dateCount > majorityThreshold) return 'Date'
    if (boolCount > majorityThreshold) return 'Boolean'
    if (intCount > majorityThreshold) return 'Integer'
    if (floatCount > majorityThreshold) return 'Float'

    return 'String'
}

/**
 * Get all column names with their detected data types
 */
export function getColumnDataTypes(
    data: Array<Record<string, any>>,
    headers: string[]
): Record<string, string> {
    const types: Record<string, string> = {}
    headers.forEach((header) => {
        types[header] = detectColumnDataType(data, header)
    })
    return types
}

/**
 * Export data as CSV with proper data type handling and column selection
 */
export function exportAsCSV(
    data: Array<Record<string, any>>,
    headers: string[],
    selectedColumns: string[],
    filename: string
): void {
    // Use selected columns, or all headers if none selected
    const columnsToExport = selectedColumns.length > 0 ? selectedColumns : headers

    const csv = [
        columnsToExport.join(','),
        ...data.map((row) =>
            columnsToExport.map((col) => {
                const value = row[col]

                // Handle null/undefined
                if (value === null || value === undefined) return ''

                // Check if it's a number that looks like an integer
                const numValue = Number(value)
                if (!isNaN(numValue) && Number.isInteger(numValue)) {
                    // It's an integer, don't wrap in quotes
                    return numValue.toString()
                }

                // For strings or floats, wrap in quotes and escape quotes
                return `"${String(value).replace(/"/g, '""')}"`
            }).join(',')
        ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
}
