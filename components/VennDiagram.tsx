import React, { useEffect, useState } from 'react'
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
        <div className="bg-white dark:bg-slate-900 rounded-lg smooth-shadow overflow-hidden">
            {/* Tab Header */}
            <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                {TABS.map((tab) => {
                    const isActive = action === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => switchAction(tab.key)}
                            disabled={isProcessing}
                            className={`flex-1 px-4 py-3 text-center border-b-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                                isActive
                                    ? `${tab.activeClass} border-current dark:bg-slate-800`
                                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <div className="text-sm font-semibold">{tab.label}</div>
                        </button>
                    )
                })}
            </div>

            {/* Diagram Body */}
            <div className="p-4">

                {/* Exclusion direction toggle (collapses after results arrive) */}
                {isExclusion && (
                    <DirectionToggle
                        direction={exclusionDirection}
                        onChange={setExclusionDirection}
                        disabled={isProcessing}
                        hasResults={hasResults}
                    />
                )}

                {isProcessing && (
                    <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                            Processing<span className="inline-block animate-pulse">…</span>
                        </div>
                        <div className="indeterminate-track w-full bg-gray-200 rounded-full h-2">
                            <div className={`indeterminate-bar ${progressBarColor}`} />
                        </div>
                    </div>
                )}

                {!isProcessing && (
                    isMerger ? (
                        <MergerView
                            aOnlyCount={aOnlyCount}
                            intersectionCount={intersectionCount}
                            bOnlyCount={bOnlyCount}
                            setACount={setACount}
                            setBCount={setBCount}
                            resultCount={resultCount}
                            preview={!hasResults}
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
                            preview={!hasResults}
                        />
                    ) : (
                        <IntersectionView
                            aOnlyCount={aOnlyCount}
                            intersectionCount={intersectionCount}
                            bOnlyCount={bOnlyCount}
                            setACount={setACount}
                            setBCount={setBCount}
                            resultCount={resultCount}
                            preview={!hasResults}
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
    hasResults?: boolean
}

const DirectionToggle: React.FC<DirectionToggleProps> = ({ direction, onChange, disabled, hasResults }) => {
    const [expanded, setExpanded] = useState(!hasResults)

    // Auto-collapse when results arrive, auto-expand when they're cleared
    useEffect(() => {
        setExpanded(!hasResults)
    }, [hasResults])

    const swap = () => onChange(direction === 'a_minus_b' ? 'b_minus_a' : 'a_minus_b')
    const currentLabel = direction === 'a_minus_b' ? 'Set A − Set B' : 'Set B − Set A'

    // Collapsed pill — visible after analysis to keep the result visible without scrolling
    if (!expanded) {
        return (
            <div className="mb-3 flex items-center justify-between px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Direction:</span>
                    <span className="font-semibold text-orange-700">{currentLabel}</span>
                </div>
                <button
                    onClick={() => setExpanded(true)}
                    disabled={disabled}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
                    title="Change direction"
                >
                    <ArrowLeftRight className="w-3 h-3" />
                    Change
                </button>
            </div>
        )
    }

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
    resultCount?: number
    preview?: boolean
}

const IntersectionView: React.FC<IntersectionViewProps> = ({
    aOnlyCount, intersectionCount, bOnlyCount, setACount, setBCount, preview,
}) => {
    const fmt = (n: number) => preview ? '—' : n.toLocaleString()
    const overlapPct = !preview && setACount > 0 && setBCount > 0
        ? `${((intersectionCount / Math.max(setACount, setBCount)) * 100).toFixed(1)}% overlap`
        : null

    return (
        <div className="flex gap-8">
            <div className="flex-1 flex items-center justify-center">
                <svg width="280" height="260" viewBox="0 0 280 260">
                    {/* Sides muted in preview to emphasize the returned region (the overlap) */}
                    <circle cx="85" cy="130" r="70"
                        fill={preview ? '#e5e7eb' : '#6366f1'}
                        opacity={preview ? 0.45 : 0.3}
                        stroke={preview ? '#9ca3af' : '#6366f1'} strokeWidth="2" />
                    <circle cx="195" cy="130" r="70"
                        fill={preview ? '#e5e7eb' : '#ec4899'}
                        opacity={preview ? 0.45 : 0.3}
                        stroke={preview ? '#9ca3af' : '#ec4899'} strokeWidth="2" />

                    {/* Preview: highlight the overlap (target region) in blue */}
                    {preview && (
                        <>
                            <defs>
                                <clipPath id="intersection-overlap-clip">
                                    <circle cx="85" cy="130" r="70" />
                                </clipPath>
                            </defs>
                            <circle cx="195" cy="130" r="70"
                                fill="#3b82f6" opacity="0.55"
                                stroke="#1d4ed8" strokeWidth="2"
                                clipPath="url(#intersection-overlap-clip)" />
                        </>
                    )}

                    <text x="45" y="135" textAnchor="middle" fontSize="14"
                        fontWeight="bold" fill={preview ? '#9ca3af' : '#1f2937'}>
                        {fmt(aOnlyCount)}
                    </text>
                    <text x="140" y={preview ? 128 : 130} textAnchor="middle"
                        fontSize={preview ? 14 : 16}
                        fontWeight="bold" fill={preview ? '#1e40af' : '#1f2937'}>
                        {preview ? '?' : intersectionCount.toLocaleString()}
                    </text>
                    {preview && (
                        <text x="140" y="143" textAnchor="middle" fontSize="9" fill="#1e3a8a">
                            returned
                        </text>
                    )}
                    <text x="225" y="135" textAnchor="middle" fontSize="14"
                        fontWeight="bold" fill={preview ? '#9ca3af' : '#1f2937'}>
                        {fmt(bOnlyCount)}
                    </text>
                    <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set A</text>
                    <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set B</text>
                    <text x="140" y="225" textAnchor="middle" fontSize="11" fill="#6b7280">
                        {preview ? 'Will return: Users exist in both files' : `Users in both lists: ${intersectionCount.toLocaleString()}`}
                    </text>
                </svg>
            </div>

            <div className="flex-1 space-y-4">
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-sm text-gray-600">Set A (Total)</p>
                    <p className="text-2xl font-bold text-indigo-600">{fmt(setACount)}</p>
                </div>
                <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                    <p className="text-sm text-gray-600">Set B (Total)</p>
                    <p className="text-2xl font-bold text-pink-600">{fmt(setBCount)}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">Intersection</p>
                    <p className="text-2xl font-bold text-blue-700">{fmt(intersectionCount)}</p>
                    {overlapPct && <p className="text-xs text-gray-500 mt-1">{overlapPct}</p>}
                    {preview && <p className="text-xs text-blue-600/80 mt-1">Records in both Set A and Set B</p>}
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Merger view
// ---------------------------------------------------------------------------

interface MergerViewProps extends Omit<IntersectionViewProps, 'resultCount'> {
    resultCount: number
}

const MergerView: React.FC<MergerViewProps> = ({
    aOnlyCount, intersectionCount, bOnlyCount, setACount, setBCount, resultCount, preview,
}) => {
    const fmt = (n: number) => preview ? '—' : n.toLocaleString()

    return (
        <div className="flex gap-8">
            <div className="flex-1 flex items-center justify-center">
                <svg width="280" height="260" viewBox="0 0 280 260">
                    {/* Both circles emphasized — merger returns everything */}
                    <circle cx="85" cy="130" r="70"
                        fill="#8b5cf6" opacity={preview ? 0.55 : 0.45}
                        stroke="#7c3aed" strokeWidth="2" />
                    <circle cx="195" cy="130" r="70"
                        fill="#06b6d4" opacity={preview ? 0.55 : 0.45}
                        stroke="#0891b2" strokeWidth="2" />

                    <text x="45" y="135" textAnchor="middle" fontSize="14"
                        fontWeight="bold" fill={preview ? '#5b21b6' : '#1f2937'}>
                        {preview ? '?' : aOnlyCount.toLocaleString()}
                    </text>
                    <text x="140" y="125" textAnchor="middle" fontSize="13"
                        fontWeight="bold" fill={preview ? '#374151' : '#1f2937'}>
                        {preview ? '?' : intersectionCount.toLocaleString()}
                    </text>
                    <text x="140" y="142" textAnchor="middle" fontSize="9" fill="#6b7280">overlap</text>
                    <text x="225" y="135" textAnchor="middle" fontSize="14"
                        fontWeight="bold" fill={preview ? '#155e75' : '#1f2937'}>
                        {preview ? '?' : bOnlyCount.toLocaleString()}
                    </text>
                    <text x="30" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set A</text>
                    <text x="220" y="40" fontSize="12" fontWeight="bold" fill="#1f2937">Set B</text>
                    <text x="140" y="225" textAnchor="middle" fontSize="11" fill="#6b7280">
                        {preview ? 'Will return: Total unique users combined' : `Total unique users: ${resultCount.toLocaleString()}`}
                    </text>
                </svg>
            </div>

            <div className="flex-1 space-y-3">
                <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                    <p className="text-sm text-gray-600">Set A (Total)</p>
                    <p className="text-xl font-bold text-violet-600">{fmt(setACount)}</p>
                </div>
                <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                    <p className="text-sm text-gray-600">Set B (Total)</p>
                    <p className="text-xl font-bold text-cyan-600">{fmt(setBCount)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600">Merger (Union)</p>
                    <p className="text-xl font-bold text-purple-700">{fmt(resultCount)}</p>
                    <p className="text-xs text-purple-600/80 mt-1">All unique records</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Overlap</p>
                    <p className="text-xl font-bold text-gray-700">{fmt(intersectionCount)}</p>
                    <p className="text-xs text-gray-500 mt-1">In both sets</p>
                </div>
            </div>
        </div>
    )
}

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
