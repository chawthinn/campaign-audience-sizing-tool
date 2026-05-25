import React, { useEffect, useRef, useState } from 'react'
import { Upload, X, Database, Key } from 'lucide-react'
import Papa from 'papaparse'
import { useAudienceStore } from '@/lib/store'
import { buildApiUrl } from '@/lib/backend'

export interface FileUploadProps {
    onFileSelect: (fileA: File | null, fileB: File | null) => void
}

interface DummyFile {
    name: string
    gcsPath: string
    sizeBytes: number
    headers: string[]
}

// Read just the first row of a CSV file (no full-file load)
async function readCsvHeaders(file: File): Promise<string[]> {
    const slice = file.slice(0, 16 * 1024) // 16KB is enough for any header row
    const text = await slice.text()
    const parsed = Papa.parse<string[]>(text, { header: false, preview: 1, skipEmptyLines: true })
    const row = parsed.data[0] ?? []
    return row.map((h) => String(h ?? '').trim()).filter((h) => h.length > 0)
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const fileA = useAudienceStore((state) => state.fileA)
    const fileB = useAudienceStore((state) => state.fileB)
    const setFileA = useAudienceStore((state) => state.setFileA)
    const setFileB = useAudienceStore((state) => state.setFileB)
    const fileAHeaders = useAudienceStore((state) => state.fileAHeaders)
    const fileBHeaders = useAudienceStore((state) => state.fileBHeaders)
    const fileAKey = useAudienceStore((state) => state.fileAKey)
    const fileBKey = useAudienceStore((state) => state.fileBKey)
    const setFileAHeaders = useAudienceStore((state) => state.setFileAHeaders)
    const setFileBHeaders = useAudienceStore((state) => state.setFileBHeaders)
    const setFileAKey = useAudienceStore((state) => state.setFileAKey)
    const setFileBKey = useAudienceStore((state) => state.setFileBKey)
    const setFileAGcsPath = useAudienceStore((state) => state.setFileAGcsPath)
    const setFileBGcsPath = useAudienceStore((state) => state.setFileBGcsPath)
    const fileAGcsPath = useAudienceStore((state) => state.fileAGcsPath)
    const fileBGcsPath = useAudienceStore((state) => state.fileBGcsPath)
    const isProcessing = useAudienceStore((state) => state.isProcessing)

    const [dummyFiles, setDummyFiles] = useState<DummyFile[]>([])
    const [dummyError, setDummyError] = useState<string | null>(null)

    const [useDummyData, setUseDummyData] = useState(false)
    const [dragOverA, setDragOverA] = useState(false)
    const [dragOverB, setDragOverB] = useState(false)
    const [headerError, setHeaderError] = useState<{ a?: string; b?: string }>({})

    const refA = useRef<HTMLInputElement>(null)
    const refB = useRef<HTMLInputElement>(null)

    // Re-read headers when file changes
    useEffect(() => {
        if (!fileA) return undefined
        // If this is a GCS-resident dummy, headers were already set by selectDummyFile.
        if (fileAGcsPath) return undefined
        let cancelled = false
        readCsvHeaders(fileA)
            .then((headers) => {
                if (cancelled) return
                if (headers.length === 0) {
                    setHeaderError((prev) => ({ ...prev, a: 'No columns detected in this CSV' }))
                    setFileAHeaders([])
                } else {
                    setHeaderError((prev) => ({ ...prev, a: undefined }))
                    setFileAHeaders(headers)
                }
            })
            .catch((err) => {
                if (cancelled) return
                setHeaderError((prev) => ({ ...prev, a: err instanceof Error ? err.message : 'Could not read CSV' }))
                setFileAHeaders([])
            })
        return () => { cancelled = true }
    }, [fileA, setFileAHeaders])

    useEffect(() => {
        if (!fileB) return undefined
        if (fileBGcsPath) return undefined
        let cancelled = false
        readCsvHeaders(fileB)
            .then((headers) => {
                if (cancelled) return
                if (headers.length === 0) {
                    setHeaderError((prev) => ({ ...prev, b: 'No columns detected in this CSV' }))
                    setFileBHeaders([])
                } else {
                    setHeaderError((prev) => ({ ...prev, b: undefined }))
                    setFileBHeaders(headers)
                }
            })
            .catch((err) => {
                if (cancelled) return
                setHeaderError((prev) => ({ ...prev, b: err instanceof Error ? err.message : 'Could not read CSV' }))
                setFileBHeaders([])
            })
        return () => { cancelled = true }
    }, [fileB, setFileBHeaders])

    // Smart suggestion: if both files have a column with the same name, prefer it as the key
    useEffect(() => {
        if (fileAHeaders.length === 0 || fileBHeaders.length === 0) return
        const lowerA = fileAHeaders.map((h) => h.toLowerCase())
        const lowerB = fileBHeaders.map((h) => h.toLowerCase())
        const shared = lowerA.find((h) => lowerB.includes(h))
        if (!shared) return
        const matchA = fileAHeaders[lowerA.indexOf(shared)]
        const matchB = fileBHeaders[lowerB.indexOf(shared)]
        // Only apply suggestion if the current selection is still the default (first column)
        if (fileAKey === fileAHeaders[0] && matchA !== fileAKey) setFileAKey(matchA)
        if (fileBKey === fileBHeaders[0] && matchB !== fileBKey) setFileBKey(matchB)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileAHeaders, fileBHeaders])

    const validateFile = (file: File | undefined): boolean => {
        if (!file) return false
        if (!file.name.endsWith('.csv')) {
            alert('Please select a CSV file (.csv)')
            return false
        }
        return true
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isSetA: boolean) => {
        const file = e.target.files?.[0]
        if (!validateFile(file)) return
        if (isSetA) setFileA(file!)
        else setFileB(file!)
        onFileSelect(isSetA ? file! : fileA, isSetA ? fileB : file!)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSetA) setDragOverA(false); else setDragOverB(false)
        const file = e.dataTransfer.files?.[0]
        if (!validateFile(file)) return
        if (isSetA) setFileA(file!)
        else setFileB(file!)
        onFileSelect(isSetA ? file! : fileA, isSetA ? fileB : file!)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSetA) setDragOverA(true); else setDragOverB(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSetA) setDragOverA(false); else setDragOverB(false)
    }

    // Fetch the list of available dummy CSVs from the backend (which lists what's in GCS)
    useEffect(() => {
        if (!useDummyData) return undefined
        let cancelled = false
        fetch(buildApiUrl('/dummy-files'))
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return
                if (!data.available) {
                    setDummyError('Dummy files are only available when the backend has GCS configured.')
                    setDummyFiles([])
                } else {
                    setDummyError(null)
                    setDummyFiles(data.files || [])
                }
            })
            .catch((err) => {
                if (cancelled) return
                setDummyError(err instanceof Error ? err.message : 'Failed to fetch dummy list')
            })
        return () => { cancelled = true }
    }, [useDummyData])

    // Pick a dummy: skip the download/re-upload — set headers + GCS path directly in the store.
    // /process-gcs will read from the GCS path we hand it.
    const selectDummyFile = (gcsPath: string, isSetA: boolean) => {
        const dummy = dummyFiles.find((d) => d.gcsPath === gcsPath)
        if (!dummy) return
        // A synthetic File placeholder so existing "is a file selected?" checks pass.
        const placeholder = new File([''], dummy.name, { type: 'text/csv' })
        if (isSetA) {
            setFileA(placeholder)
            setFileAHeaders(dummy.headers)
            setFileAGcsPath(dummy.gcsPath)
        } else {
            setFileB(placeholder)
            setFileBHeaders(dummy.headers)
            setFileBGcsPath(dummy.gcsPath)
        }
        onFileSelect(isSetA ? placeholder : fileA, isSetA ? fileB : placeholder)
    }

    const renderKeyPicker = (
        isSetA: boolean,
        headers: string[],
        selected: string,
        onChange: (key: string) => void,
        error?: string,
    ) => {
        if (error) {
            return (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    {error}
                </div>
            )
        }
        if (headers.length === 0) {
            return (
                <div className="mt-2 text-xs text-gray-400 italic">Reading column headers…</div>
            )
        }
        return (
            <div className="mt-2">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                    <Key className="w-3 h-3" />
                    Primary key (join column)
                </label>
                <select
                    value={selected}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isProcessing}
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                    {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                    ))}
                </select>
            </div>
        )
    }

    return (
        <div className="space-y-3 p-4 bg-white rounded-lg smooth-shadow">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-gray-900">Upload CSV Files</h2>
                <button
                    onClick={() => {
                        setUseDummyData(!useDummyData)
                        setFileA(null)
                        setFileB(null)
                        if (refA.current) refA.current.value = ''
                        if (refB.current) refB.current.value = ''
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium transition flex items-center gap-1 ${useDummyData
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    <Database className="w-4 h-4" />
                    {useDummyData ? 'Using Dummy' : 'Use Dummy'}
                </button>
            </div>

            {useDummyData ? (
                <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3 pb-5">
                    {/* File A Dropdown */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set A (First Audience)
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => { if (e.target.value) selectDummyFile(e.target.value, true) }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">{fileA ? `✓ ${fileA.name}` : 'Select file...'}</option>
                                {dummyFiles.map((file) => (
                                    <option key={file.gcsPath} value={file.gcsPath}>{file.name}</option>
                                ))}
                            </select>
                            {fileA && (
                                <button onClick={() => setFileA(null)} className="px-2 py-2 text-red-600 hover:bg-red-50 rounded" title="Remove">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        {fileA && renderKeyPicker(true, fileAHeaders, fileAKey, setFileAKey, headerError.a)}
                    </div>

                    {/* File B Dropdown */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set B (Second Audience)
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => { if (e.target.value) selectDummyFile(e.target.value, false) }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">{fileB ? `✓ ${fileB.name}` : 'Select file...'}</option>
                                {dummyFiles.map((file) => (
                                    <option key={file.gcsPath} value={file.gcsPath}>{file.name}</option>
                                ))}
                            </select>
                            {fileB && (
                                <button onClick={() => setFileB(null)} className="px-2 py-2 text-red-600 hover:bg-red-50 rounded" title="Remove">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        {fileB && renderKeyPicker(false, fileBHeaders, fileBKey, setFileBKey, headerError.b)}
                    </div>
                </div>
            ) : (
                <div className="space-y-3 bg-green-50 border border-green-200 rounded-lg p-3 pb-5">
                    {/* File A Upload */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set A (First Audience)
                        </label>
                        {fileA ? (
                            <div className="flex items-center justify-between px-4 py-3 bg-green-100 border border-green-300 rounded-lg">
                                <span className="text-sm font-medium text-green-800">✓ {fileA.name}</span>
                                <button
                                    onClick={() => { setFileA(null); if (refA.current) refA.current.value = '' }}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`relative border-2 border-dashed rounded-lg p-4 transition cursor-pointer ${dragOverA
                                    ? 'border-green-500 bg-green-100'
                                    : 'border-gray-300 bg-white hover:border-green-500'
                                    }`}
                                onClick={() => refA.current?.click()}
                                onDrop={(e) => handleDrop(e, true)}
                                onDragOver={(e) => handleDragOver(e, true)}
                                onDragLeave={(e) => handleDragLeave(e, true)}
                            >
                                <input ref={refA} type="file" accept=".csv" onChange={(e) => handleFileChange(e, true)} className="hidden" disabled={isProcessing} />
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm text-gray-600">Click or drag CSV</span>
                                </div>
                            </div>
                        )}
                        {fileA && renderKeyPicker(true, fileAHeaders, fileAKey, setFileAKey, headerError.a)}
                    </div>

                    {/* File B Upload */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set B (Second Audience)
                        </label>
                        {fileB ? (
                            <div className="flex items-center justify-between px-4 py-3 bg-green-100 border border-green-300 rounded-lg">
                                <span className="text-sm font-medium text-green-800">✓ {fileB.name}</span>
                                <button
                                    onClick={() => { setFileB(null); if (refB.current) refB.current.value = '' }}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`relative border-2 border-dashed rounded-lg p-4 transition cursor-pointer ${dragOverB
                                    ? 'border-green-500 bg-green-100'
                                    : 'border-gray-300 bg-white hover:border-green-500'
                                    }`}
                                onClick={() => refB.current?.click()}
                                onDrop={(e) => handleDrop(e, false)}
                                onDragOver={(e) => handleDragOver(e, false)}
                                onDragLeave={(e) => handleDragLeave(e, false)}
                            >
                                <input ref={refB} type="file" accept=".csv" onChange={(e) => handleFileChange(e, false)} className="hidden" disabled={isProcessing} />
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm text-gray-600">Click or drag CSV</span>
                                </div>
                            </div>
                        )}
                        {fileB && renderKeyPicker(false, fileBHeaders, fileBKey, setFileBKey, headerError.b)}
                    </div>
                </div>
            )}

        </div>
    )
}
