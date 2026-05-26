import React, { useEffect, useState } from 'react'
import { Eye, Activity } from 'lucide-react'
import { buildApiUrl } from '@/lib/backend'

interface Stats {
    visits: number
    runs: number
}

const VISIT_FLAG = 'cast-last-visit-date'
const REFRESH_EVENT = 'cast-stats-bump'

function todayKey(): string {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Dispatched by the page after a successful analyze to trigger a stats refetch. */
export function bumpStats() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(REFRESH_EVENT))
    }
}

export const StatsBar: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null)

    useEffect(() => {
        let cancelled = false

        const fetchStats = (path: string, method: 'GET' | 'POST') =>
            fetch(buildApiUrl(path), { method })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (cancelled || !data) return
                    if (typeof data.visits === 'number' && typeof data.runs === 'number') {
                        setStats({ visits: data.visits, runs: data.runs })
                    }
                })
                .catch(() => { /* stats are best-effort; ignore */ })

        // Increment at most once per browser per calendar day (handles multiple tabs)
        const today = todayKey()
        const lastVisit = typeof window !== 'undefined' ? localStorage.getItem(VISIT_FLAG) : null
        if (lastVisit === today) {
            fetchStats('/stats', 'GET')
        } else {
            if (typeof window !== 'undefined') localStorage.setItem(VISIT_FLAG, today)
            fetchStats('/stats/visit', 'POST')
        }

        const onBump = () => fetchStats('/stats', 'GET')
        window.addEventListener(REFRESH_EVENT, onBump)
        return () => {
            cancelled = true
            window.removeEventListener(REFRESH_EVENT, onBump)
        }
    }, [])

    const visits = stats?.visits ?? null
    const runs = stats?.runs ?? null

    return (
        <div className="border-t border-gray-100 dark:border-slate-800/60 py-3">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-5 text-xs text-gray-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="font-medium text-gray-500 dark:text-slate-400">
                        {visits === null ? '—' : visits.toLocaleString()}
                    </span> visits
                </span>
                <span className="text-gray-300 dark:text-slate-700">·</span>
                <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="font-medium text-gray-500 dark:text-slate-400">
                        {runs === null ? '—' : runs.toLocaleString()}
                    </span> analyses run
                </span>
            </div>
        </div>
    )
}
