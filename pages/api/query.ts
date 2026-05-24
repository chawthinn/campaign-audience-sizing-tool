import type { NextApiRequest, NextApiResponse } from 'next'
import { sessions } from './sessions'

interface QueryRequest {
  sessionId: string
  search?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

interface QueryResponse {
  success: boolean
  data: Array<Record<string, any>>
  total: number
  headers: string[]
  error?: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<QueryResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: [],
      total: 0,
      headers: [],
      error: 'Method not allowed',
    })
  }

  try {
    const { sessionId, search, sortColumn, sortDirection = 'asc', offset = 0, limit = 100 } = req.body as QueryRequest

    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({
        success: false,
        data: [],
        total: 0,
        headers: [],
        error: 'Invalid session',
      })
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

    // Apply pagination
    const total = intersectionData.length
    const paginatedData = intersectionData.slice(offset, offset + limit)

    res.status(200).json({
      success: true,
      data: paginatedData,
      total,
      headers,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      total: 0,
      headers: [],
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
}
