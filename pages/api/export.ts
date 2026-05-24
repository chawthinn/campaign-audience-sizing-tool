import type { NextApiRequest, NextApiResponse } from 'next'
import { sessions } from './sessions'

interface ExportRequest {
    sessionId: string
    search?: string
    sortColumn?: string
    sortDirection?: 'asc' | 'desc'
    columns?: string[]
}

export const config = {
    api: {
        responseLimit: '500mb',
    },
}

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { sessionId, search, sortColumn, sortDirection = 'asc', columns } = req.body as ExportRequest

        console.log('[Export] Received sessionId:', sessionId)
        console.log('[Export] Available sessions:', Object.keys(sessions))

        if (!sessionId) {
            return res.status(400).json({ error: 'Missing sessionId' })
        }

        if (!sessions[sessionId]) {
            return res.status(400).json({ error: `Invalid session: ${sessionId}` })
        }

        // Create a copy to avoid mutating the stored session data
        let intersectionData = [...sessions[sessionId].intersectionData]
        const { headers } = sessions[sessionId]

        // Apply search filter (only if search has actual content)
        if (search && search.trim()) {
            const query = search.toLowerCase().trim()
            intersectionData = intersectionData.filter((row) =>
                headers.some((header) =>
                    row[header]?.toString().toLowerCase().includes(query)
                )
            )
        }

        // Apply sorting
        if (sortColumn && headers.includes(sortColumn)) {
            intersectionData.sort((a, b) => {
                const aVal = a[sortColumn]
                const bVal = b[sortColumn]

                if (aVal == null && bVal == null) return 0
                if (aVal == null) return sortDirection === 'asc' ? 1 : -1
                if (bVal == null) return sortDirection === 'asc' ? -1 : 1

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
                }

                const aStr = aVal.toString().toLowerCase()
                const bStr = bVal.toString().toLowerCase()
                const cmp = aStr.localeCompare(bStr)
                return sortDirection === 'asc' ? cmp : -cmp
            })
        }

        // Select columns to export
        const columnsToExport = columns && columns.length > 0 ? columns : headers

        // Build CSV with proper formatting
        const csvLines: string[] = []

        // Header row
        const headerValues = columnsToExport.map((col) => `"${col.replace(/"/g, '""')}"`)
        csvLines.push(headerValues.join(','))

        // Data rows
        intersectionData.forEach((row) => {
            const values = columnsToExport.map((col) => {
                const value = row[col]

                if (value === null || value === undefined) return ''

                // Handle numbers (check if integer)
                const numValue = Number(value)
                if (!isNaN(numValue) && Number.isInteger(numValue)) {
                    return numValue.toString()
                }

                // Quote and escape strings
                return `"${String(value).replace(/"/g, '""')}"`
            })

            csvLines.push(values.join(','))
        })

        const csv = csvLines.join('\n')

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="audience_intersection.csv"')

        return res.status(200).send(csv)
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Export failed',
        })
    }
}
