import React, { useRef, useState } from 'react'
import { Upload, X, Database } from 'lucide-react'
import { useAudienceStore } from '@/lib/store'

export interface FileUploadProps {
    onFileSelect: (fileA: File | null, fileB: File | null) => void
}

const DUMMY_FILES = [
    { name: 'eligible_base_users.csv', path: '/dummy_data/eligible_base_users.csv' },
    { name: 'targeting_list.csv', path: '/dummy_data/targeting_list.csv' },
]

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const fileA = useAudienceStore((state) => state.fileA)
    const fileB = useAudienceStore((state) => state.fileB)
    const setFileA = useAudienceStore((state) => state.setFileA)
    const setFileB = useAudienceStore((state) => state.setFileB)
    const isProcessing = useAudienceStore((state) => state.isProcessing)

    const [useDummyData, setUseDummyData] = useState(false)
    const [dragOverA, setDragOverA] = useState(false)
    const [dragOverB, setDragOverB] = useState(false)

    const refA = useRef<HTMLInputElement>(null)
    const refB = useRef<HTMLInputElement>(null)

    const validateFile = (file: File | undefined): boolean => {
        if (!file) return false
        if (!file.name.endsWith('.csv')) {
            alert('Please select a CSV file (.csv)')
            return false
        }
        return true
    }

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        isSetA: boolean
    ) => {
        const file = e.target.files?.[0]
        if (!validateFile(file)) return

        if (isSetA) {
            setFileA(file)
        } else {
            setFileB(file)
        }

        onFileSelect(isSetA ? file : fileA, isSetA ? fileB : file)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()

        if (isSetA) setDragOverA(false)
        else setDragOverB(false)

        const file = e.dataTransfer.files?.[0]
        if (!validateFile(file)) return

        if (isSetA) {
            setFileA(file)
        } else {
            setFileB(file)
        }

        onFileSelect(isSetA ? file : fileA, isSetA ? fileB : file)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSetA) setDragOverA(true)
        else setDragOverB(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, isSetA: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSetA) setDragOverA(false)
        else setDragOverB(false)
    }

    const loadDummyFile = async (path: string, isSetA: boolean) => {
        try {
            const response = await fetch(path)
            const blob = await response.blob()
            const filename = path.split('/').pop() || 'file.csv'
            const file = new File([blob], filename, { type: 'text/csv' })

            if (isSetA) {
                setFileA(file)
            } else {
                setFileB(file)
            }

            onFileSelect(isSetA ? file : fileA, isSetA ? fileB : file)
        } catch (error) {
            alert('Error loading dummy file: ' + (error instanceof Error ? error.message : 'Unknown'))
        }
    }

    return (
        <div className="space-y-4 p-6 bg-white rounded-lg smooth-shadow">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Upload CSV Files</h2>
                <button
                    onClick={() => {
                        setUseDummyData(!useDummyData)
                        setFileA(null)
                        setFileB(null)
                        refA.current && (refA.current.value = '')
                        refB.current && (refB.current.value = '')
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
                // DUMMY DATA MODE
                <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    {/* File A Dropdown */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set A (First Audience)
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        loadDummyFile(e.target.value, true)
                                    }
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">
                                    {fileA ? `✓ ${fileA.name}` : 'Select file...'}
                                </option>
                                {DUMMY_FILES.map((file) => (
                                    <option key={file.path} value={file.path}>
                                        {file.name}
                                    </option>
                                ))}
                            </select>
                            {fileA && (
                                <button
                                    onClick={() => setFileA(null)}
                                    className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                                    title="Remove"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* File B Dropdown */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set B (Second Audience)
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        loadDummyFile(e.target.value, false)
                                    }
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">
                                    {fileB ? `✓ ${fileB.name}` : 'Select file...'}
                                </option>
                                {DUMMY_FILES.map((file) => (
                                    <option key={file.path} value={file.path}>
                                        {file.name}
                                    </option>
                                ))}
                            </select>
                            {fileB && (
                                <button
                                    onClick={() => setFileB(null)}
                                    className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                                    title="Remove"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // FILE UPLOAD MODE
                <div className="space-y-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    {/* File A Upload */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Set A (First Audience)
                        </label>
                        {fileA ? (
                            <div className="flex items-center justify-between px-4 py-3 bg-green-100 border border-green-300 rounded-lg">
                                <span className="text-sm font-medium text-green-800">✓ {fileA.name}</span>
                                <button
                                    onClick={() => {
                                        setFileA(null)
                                        if (refA.current) refA.current.value = ''
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`relative border-2 border-dashed rounded-lg p-6 transition cursor-pointer ${dragOverA
                                        ? 'border-green-500 bg-green-100'
                                        : 'border-gray-300 bg-white hover:border-green-500'
                                    }`}
                                onClick={() => refA.current?.click()}
                                onDrop={(e) => handleDrop(e, true)}
                                onDragOver={(e) => handleDragOver(e, true)}
                                onDragLeave={(e) => handleDragLeave(e, true)}
                            >
                                <input
                                    ref={refA}
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => handleFileChange(e, true)}
                                    className="hidden"
                                    disabled={isProcessing}
                                />
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm text-gray-600">Click or drag CSV</span>
                                </div>
                            </div>
                        )}
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
                                    onClick={() => {
                                        setFileB(null)
                                        if (refB.current) refB.current.value = ''
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`relative border-2 border-dashed rounded-lg p-6 transition cursor-pointer ${dragOverB
                                        ? 'border-green-500 bg-green-100'
                                        : 'border-gray-300 bg-white hover:border-green-500'
                                    }`}
                                onClick={() => refB.current?.click()}
                                onDrop={(e) => handleDrop(e, false)}
                                onDragOver={(e) => handleDragOver(e, false)}
                                onDragLeave={(e) => handleDragLeave(e, false)}
                            >
                                <input
                                    ref={refB}
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => handleFileChange(e, false)}
                                    className="hidden"
                                    disabled={isProcessing}
                                />
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm text-gray-600">Click or drag CSV</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {fileA && fileB && (
                <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded text-sm text-green-800 font-medium flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    Both files ready for processing
                </div>
            )}
        </div>
    )
}
