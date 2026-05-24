import React from 'react'
import { useAudienceStore } from '@/lib/store'

export const VennDiagram: React.FC = () => {
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const setACount = useAudienceStore((state) => state.setACount)
    const setBCount = useAudienceStore((state) => state.setBCount)
    const isProcessing = useAudienceStore((state) => state.isProcessing)
    const progress = useAudienceStore((state) => state.progress)

    const aOnlyCount = Math.max(0, setACount - intersectionCount)
    const bOnlyCount = Math.max(0, setBCount - intersectionCount)

    const hasResults = setACount > 0 && setBCount > 0

    return (
        <div className="p-6 bg-white rounded-lg smooth-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Audience Intersection</h2>

            {isProcessing && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Processing...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {!hasResults && !isProcessing && (
                <div className="flex items-center justify-center h-64 text-gray-400">
                    <p>Upload both files to see the Venn diagram</p>
                </div>
            )}

            {hasResults && !isProcessing && (
                <div className="flex gap-8">
                    {/* SVG Venn Diagram */}
                    <div className="flex-1 flex items-center justify-center">
                        <svg width="280" height="260" viewBox="0 0 280 260">
                            {/* Circle A */}
                            <circle
                                cx="85"
                                cy="130"
                                r="70"
                                fill="#6366f1"
                                opacity="0.3"
                                stroke="#6366f1"
                                strokeWidth="2"
                            />
                            {/* Circle B */}
                            <circle
                                cx="195"
                                cy="130"
                                r="70"
                                fill="#ec4899"
                                opacity="0.3"
                                stroke="#ec4899"
                                strokeWidth="2"
                            />

                            {/* Text - A Only */}
                            <text
                                x="45"
                                y="135"
                                textAnchor="middle"
                                fontSize="14"
                                fontWeight="bold"
                                fill="#1f2937"
                            >
                                {aOnlyCount.toLocaleString()}
                            </text>

                            {/* Text - Intersection */}
                            <text
                                x="140"
                                y="130"
                                textAnchor="middle"
                                fontSize="16"
                                fontWeight="bold"
                                fill="#1f2937"
                            >
                                {intersectionCount.toLocaleString()}
                            </text>

                            {/* Text - B Only */}
                            <text
                                x="225"
                                y="135"
                                textAnchor="middle"
                                fontSize="14"
                                fontWeight="bold"
                                fill="#1f2937"
                            >
                                {bOnlyCount.toLocaleString()}
                            </text>

                            {/* Labels */}
                            <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">
                                Set A
                            </text>
                            <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">
                                Set B
                            </text>
                        </svg>
                    </div>

                    {/* Statistics */}
                    <div className="flex-1 space-y-4">
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                            <p className="text-sm text-gray-600">Set A (Total)</p>
                            <p className="text-2xl font-bold text-indigo-600">
                                {setACount.toLocaleString()}
                            </p>
                        </div>

                        <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                            <p className="text-sm text-gray-600">Set B (Total)</p>
                            <p className="text-2xl font-bold text-pink-600">
                                {setBCount.toLocaleString()}
                            </p>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-sm text-gray-600">Intersection</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {intersectionCount.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                {((intersectionCount / Math.max(setACount, setBCount)) * 100).toFixed(1)}% overlap
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
