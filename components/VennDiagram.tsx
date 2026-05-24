import React from 'react'
import { useAudienceStore, type ExclusionDirection } from '@/lib/store'
import { ArrowLeftRight } from 'lucide-react'

const TABS = [
    {
        key: 'intersection' as const,
        label: 'Audience Intersection',
        activeClass: 'border-blue-600 text-blue-700 bg-blue-50',
    },
    {
        key: 'merger' as const,
        label: 'Audience Merger',
        activeClass: 'border-purple-600 text-purple-700 bg-purple-50',
    },
    {
        key: 'exclusion' as const,
        label: 'Audience Exclusion',
        activeClass: 'border-orange-600 text-orange-700 bg-orange-50',
    },
]

export const VennDiagram: React.FC = () => {
    const action = useAudienceStore((state) => state.action)
    const switchAction = useAudienceStore((state) => state.switchAction)
    const exclusionDirection = useAudienceStore((state) => state.exclusionDirection)
    const setExclusionDirection = useAudienceStore((state) => state.setExclusionDirection)
    const intersectionCount = useAudienceStore((state) => state.intersectionCount)
    const resultCount = useAudienceStore((state) => state.resultCount)
    const setACount = useAudienceStore((state) => state.setACount)
    const setBCount = useAudienceStore((state) => state.setBCount)
    const isProcessing = useAudienceStore((state) => state.isProcessing)
    const progress = useAudienceStore((state) => state.progress)

    const aOnlyCount = Math.max(0, setACount - intersectionCount)
    const bOnlyCount = Math.max(0, setBCount - intersectionCount)

    const hasResults = setACount > 0 || setBCount > 0
    const isMerger = action === 'merger'
    const isExclusion = action === 'exclusion'

    const progressBarColor =
        isMerger ? 'bg-purple-500' :
        isExclusion ? 'bg-orange-500' :
        'bg-blue-500'

    return (
        <div className="bg-white rounded-lg smooth-shadow overflow-hidden">
            {/* Tab Header */}
            <div className="flex border-b border-gray-200 bg-gray-50">
                {TABS.map((tab) => {
                    const isActive = action === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => switchAction(tab.key)}
                            disabled={isProcessing}
                            className={`flex-1 px-6 py-4 text-center border-b-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                                isActive
                                    ? `${tab.activeClass} border-current`
                                    : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-700'
                            }`}
                        >
                            <div className="text-sm font-semibold">{tab.label}</div>
                        </button>
                    )
                })}
            </div>

            {/* Diagram Body */}
            <div className="p-6">

                {/* Exclusion direction toggle (always visible on exclusion tab) */}
                {isExclusion && (
                    <DirectionToggle
                        direction={exclusionDirection}
                        onChange={setExclusionDirection}
                        disabled={isProcessing}
                    />
                )}

                {isProcessing && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Processing...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${progressBarColor}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {!hasResults && !isProcessing && (
                    isExclusion ? (
                        <ExclusionView
                            direction={exclusionDirection}
                            aOnlyCount={0}
                            intersectionCount={0}
                            bOnlyCount={0}
                            setACount={0}
                            setBCount={0}
                            resultCount={0}
                            preview
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <p>Upload both files to see the diagram</p>
                        </div>
                    )
                )}

                {hasResults && !isProcessing && (
                    isMerger ? (
                        <MergerView
                            aOnlyCount={aOnlyCount}
                            intersectionCount={intersectionCount}
                            bOnlyCount={bOnlyCount}
                            setACount={setACount}
                            setBCount={setBCount}
                            resultCount={resultCount}
                        />
                    ) : isExclusion ? (
                        <ExclusionView
                            direction={exclusionDirection}
                            aOnlyCount={aOnlyCount}
                            intersectionCount={intersectionCount}
                            bOnlyCount={bOnlyCount}
                            setACount={setACount}
                            setBCount={setBCount}
                            resultCount={resultCount}
                        />
                    ) : (
                        <IntersectionView
                            aOnlyCount={aOnlyCount}
                            intersectionCount={intersectionCount}
                            bOnlyCount={bOnlyCount}
                            setACount={setACount}
                            setBCount={setBCount}
                        />
                    )
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Direction toggle for Exclusion mode
// ---------------------------------------------------------------------------

interface DirectionToggleProps {
    direction: ExclusionDirection
    onChange: (direction: ExclusionDirection) => void
    disabled?: boolean
}

const DirectionToggle: React.FC<DirectionToggleProps> = ({ direction, onChange, disabled }) => {
    const swap = () => onChange(direction === 'a_minus_b' ? 'b_minus_a' : 'a_minus_b')
    const options: { value: ExclusionDirection; label: string; sub: string }[] = [
        { value: 'a_minus_b', label: 'Set A − Set B', sub: 'records in A, excluding those in B' },
        { value: 'b_minus_a', label: 'Set B − Set A', sub: 'records in B, excluding those in A' },
    ]

    return (
        <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Direction</span>
                <button
                    onClick={swap}
                    disabled={disabled}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
                    title="Swap direction"
                >
                    <ArrowLeftRight className="w-3 h-3" />
                    Swap
                </button>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {options.map((opt) => {
                    const isActive = direction === opt.value
                    return (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            disabled={disabled}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition disabled:cursor-not-allowed ${
                                isActive
                                    ? 'bg-white text-orange-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <div className="font-semibold">{opt.label}</div>
                            <div className={`text-[10px] mt-0.5 ${isActive ? 'text-orange-500' : 'text-gray-400'}`}>
                                {opt.sub}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Intersection view
// ---------------------------------------------------------------------------

interface IntersectionViewProps {
    aOnlyCount: number
    intersectionCount: number
    bOnlyCount: number
    setACount: number
    setBCount: number
}

const IntersectionView: React.FC<IntersectionViewProps> = ({
    aOnlyCount, intersectionCount, bOnlyCount, setACount, setBCount,
}) => (
    <div className="flex gap-8">
        <div className="flex-1 flex items-center justify-center">
            <svg width="280" height="260" viewBox="0 0 280 260">
                <circle cx="85" cy="130" r="70" fill="#6366f1" opacity="0.3" stroke="#6366f1" strokeWidth="2" />
                <circle cx="195" cy="130" r="70" fill="#ec4899" opacity="0.3" stroke="#ec4899" strokeWidth="2" />
                <text x="45" y="135" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1f2937">
                    {aOnlyCount.toLocaleString()}
                </text>
                <text x="140" y="130" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1f2937">
                    {intersectionCount.toLocaleString()}
                </text>
                <text x="225" y="135" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1f2937">
                    {bOnlyCount.toLocaleString()}
                </text>
                <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set A</text>
                <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set B</text>
            </svg>
        </div>

        <div className="flex-1 space-y-4">
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-gray-600">Set A (Total)</p>
                <p className="text-2xl font-bold text-indigo-600">{setACount.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                <p className="text-sm text-gray-600">Set B (Total)</p>
                <p className="text-2xl font-bold text-pink-600">{setBCount.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600">Intersection</p>
                <p className="text-2xl font-bold text-purple-600">{intersectionCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                    {((intersectionCount / Math.max(setACount, setBCount)) * 100).toFixed(1)}% overlap
                </p>
            </div>
        </div>
    </div>
)

// ---------------------------------------------------------------------------
// Merger view
// ---------------------------------------------------------------------------

interface MergerViewProps extends IntersectionViewProps {
    resultCount: number
}

const MergerView: React.FC<MergerViewProps> = ({
    aOnlyCount, intersectionCount, bOnlyCount, setACount, setBCount, resultCount,
}) => (
    <div className="flex gap-8">
        <div className="flex-1 flex items-center justify-center">
            <svg width="280" height="260" viewBox="0 0 280 260">
                <circle cx="85" cy="130" r="70" fill="#8b5cf6" opacity="0.45" stroke="#7c3aed" strokeWidth="2" />
                <circle cx="195" cy="130" r="70" fill="#06b6d4" opacity="0.45" stroke="#0891b2" strokeWidth="2" />
                <text x="45" y="135" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1f2937">
                    {aOnlyCount.toLocaleString()}
                </text>
                <text x="140" y="125" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1f2937">
                    {intersectionCount.toLocaleString()}
                </text>
                <text x="140" y="142" textAnchor="middle" fontSize="9" fill="#6b7280">overlap</text>
                <text x="225" y="135" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1f2937">
                    {bOnlyCount.toLocaleString()}
                </text>
                <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set A</text>
                <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set B</text>
                <text x="140" y="225" textAnchor="middle" fontSize="11" fill="#6b7280">
                    Union: {resultCount.toLocaleString()}
                </text>
            </svg>
        </div>

        <div className="flex-1 space-y-3">
            <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-sm text-gray-600">Set A (Total)</p>
                <p className="text-xl font-bold text-violet-600">{setACount.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <p className="text-sm text-gray-600">Set B (Total)</p>
                <p className="text-xl font-bold text-cyan-600">{setBCount.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-gray-600">Merger (Union)</p>
                <p className="text-xl font-bold text-emerald-700">{resultCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">All unique records</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">Overlap</p>
                <p className="text-xl font-bold text-gray-700">{intersectionCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">In both sets</p>
            </div>
        </div>
    </div>
)

// ---------------------------------------------------------------------------
// Exclusion view
// ---------------------------------------------------------------------------

interface ExclusionViewProps extends IntersectionViewProps {
    direction: ExclusionDirection
    resultCount: number
    preview?: boolean
}

const ExclusionView: React.FC<ExclusionViewProps> = ({
    direction, aOnlyCount, intersectionCount, bOnlyCount, setACount, setBCount, resultCount, preview,
}) => {
    const isAMinusB = direction === 'a_minus_b'

    // Highlighted vs muted colors per side
    const aFill = isAMinusB ? '#f97316' : '#e5e7eb'   // orange : gray
    const aStroke = isAMinusB ? '#ea580c' : '#9ca3af'
    const aOpacity = isAMinusB ? 0.55 : 0.4
    const bFill = isAMinusB ? '#e5e7eb' : '#f97316'
    const bStroke = isAMinusB ? '#9ca3af' : '#ea580c'
    const bOpacity = isAMinusB ? 0.4 : 0.55

    const shownInA = isAMinusB ? (preview ? '?' : aOnlyCount.toLocaleString()) : (preview ? '' : aOnlyCount.toLocaleString())
    const shownInB = isAMinusB ? (preview ? '' : bOnlyCount.toLocaleString()) : (preview ? '?' : bOnlyCount.toLocaleString())

    const directionLabel = isAMinusB ? 'A − B' : 'B − A'
    const directionDescription = isAMinusB
        ? 'Records in Set A, excluding any that appear in Set B'
        : 'Records in Set B, excluding any that appear in Set A'

    return (
        <div className="flex gap-8">
            <div className="flex-1 flex items-center justify-center">
                <svg width="280" height="260" viewBox="0 0 280 260">
                    {/* Circle A */}
                    <circle cx="85" cy="130" r="70" fill={aFill} opacity={aOpacity} stroke={aStroke} strokeWidth="2" />
                    {/* Circle B */}
                    <circle cx="195" cy="130" r="70" fill={bFill} opacity={bOpacity} stroke={bStroke} strokeWidth="2" />

                    {/* Overlap "excluded" overlay: dark hash-like fill over intersection region */}
                    <defs>
                        <pattern id="excluded-hash" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="6" stroke="#6b7280" strokeWidth="1.5" />
                        </pattern>
                        <clipPath id="circleA-clip">
                            <circle cx="85" cy="130" r="70" />
                        </clipPath>
                    </defs>
                    <circle cx="195" cy="130" r="70" fill="url(#excluded-hash)" opacity="0.55" clipPath="url(#circleA-clip)" />

                    {/* A region count */}
                    <text x="45" y="135" textAnchor="middle" fontSize={isAMinusB ? 16 : 12}
                          fontWeight="bold" fill={isAMinusB ? '#9a3412' : '#6b7280'}>
                        {shownInA}
                    </text>

                    {/* Overlap label */}
                    <text x="140" y="128" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">
                        excluded
                    </text>
                    <text x="140" y="142" textAnchor="middle" fontSize="9" fill="#6b7280">
                        {preview ? '—' : intersectionCount.toLocaleString()}
                    </text>

                    {/* B region count */}
                    <text x="225" y="135" textAnchor="middle" fontSize={!isAMinusB ? 16 : 12}
                          fontWeight="bold" fill={!isAMinusB ? '#9a3412' : '#6b7280'}>
                        {shownInB}
                    </text>

                    {/* Set labels */}
                    <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set A</text>
                    <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set B</text>

                    {/* Result footer */}
                    <text x="140" y="225" textAnchor="middle" fontSize="11" fill="#6b7280">
                        {preview ? `Will return: ${directionLabel}` : `Result (${directionLabel}): ${resultCount.toLocaleString()}`}
                    </text>
                </svg>
            </div>

            <div className="flex-1 space-y-3">
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                    <p className="text-xs uppercase tracking-wide text-orange-700">{directionLabel}</p>
                    <p className="text-2xl font-bold text-orange-700 mt-1">
                        {preview ? '—' : resultCount.toLocaleString()}
                    </p>
                    <p className="text-xs text-orange-600/80 mt-1">{directionDescription}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600">Set A (Total)</p>
                    <p className="text-xl font-bold text-slate-800">
                        {preview ? '—' : setACount.toLocaleString()}
                    </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600">Set B (Total)</p>
                    <p className="text-xl font-bold text-slate-800">
                        {preview ? '—' : setBCount.toLocaleString()}
                    </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Overlap (excluded)</p>
                    <p className="text-xl font-bold text-gray-700">
                        {preview ? '—' : intersectionCount.toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    )
}
