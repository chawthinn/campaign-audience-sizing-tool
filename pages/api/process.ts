import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import Papa from 'papaparse'
import { sessions } from './sessions'

export const config = {
    api: {
        bodyParser: false,
    },
}

interface ProcessResult {
    success: boolean
    intersectionCount: number
    setACount: number
    setBCount: number
    headers: string[]
    sessionId: string
    message?: string
    error?: string
}

async function parseCSV(filePath: string): Promise<{
    data: Array<Record<string, any>>
    headers: string[]
}> {
    return new Promise((resolve, reject) => {
        const data: Array<Record<string, any>> = []
        let headers: string[] = []

        Papa.parse(fs.createReadStream(filePath), {
            header: true,
            skipEmptyLines: true,
            chunk: (results) => {
                if (results.data && Array.isArray(results.data)) {
                    results.data.forEach((row: any) => {
                        if (row && Object.keys(row).length > 0) {
                            data.push(row)
                        }
                    })
                }
                if (results.meta?.fields) {
                    headers = results.meta.fields
                }
            },
            error: (error) => {
                reject(error)
            },
            complete: () => {
                resolve({ data, headers })
            },
        })
    })
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ProcessResult>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            intersectionCount: 0,
            setACount: 0,
            setBCount: 0,
            headers: [],
            sessionId: '',
            error: 'Method not allowed',
        })
    }

    const form = formidable({
        multiples: true,
        maxFileSize: 500 * 1024 * 1024, // 500MB
    })

    try {
        const [fields, files] = await form.parse(req)

        const fileA = Array.isArray(files.fileA) ? files.fileA[0] : files.fileA
        const fileB = Array.isArray(files.fileB) ? files.fileB[0] : files.fileB

        if (!fileA || !fileB) {
            return res.status(400).json({
                success: false,
                intersectionCount: 0,
                setACount: 0,
                setBCount: 0,
                headers: [],
                sessionId: '',
                error: 'Both files required',
            })
        }

        // Parse both files
        const { data: dataA, headers: headersA } = await parseCSV(fileA.filepath)
        const { data: dataB, headers: headersB } = await parseCSV(fileB.filepath)

        // Get first column as ID
        const firstColA = headersA[0]
        const firstColB = headersB[0]

        // Create set of IDs from file A
        const idsA = new Set(dataA.map((row) => row[firstColA]?.toString().trim()))

        // Find intersection
        const intersectionData = dataB.filter((row) =>
            idsA.has(row[firstColB]?.toString().trim())
        )

        // Generate session ID
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Store in memory
        sessions[sessionId] = {
            intersectionData,
            headers: headersB,
            setACount: dataA.length,
            setBCount: dataB.length,
        }

        // Clean up uploaded files
        try {
            fs.unlinkSync(fileA.filepath)
            fs.unlinkSync(fileB.filepath)
        } catch (e) {
            // File already deleted
        }

        res.status(200).json({
            success: true,
            intersectionCount: intersectionData.length,
            setACount: dataA.length,
            setBCount: dataB.length,
            headers: headersB,
            sessionId,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            intersectionCount: 0,
            setACount: 0,
            setBCount: 0,
            headers: [],
            sessionId: '',
            error: error instanceof Error ? error.message : 'Processing failed',
        })
    }
}

export { sessions }

