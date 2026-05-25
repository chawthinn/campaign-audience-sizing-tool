// Tiny theme helper: persists the user's choice in localStorage and applies
// the `dark` class to <html> so Tailwind's dark: variants kick in.

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'cast-theme'

export function applyTheme(theme: Theme) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (theme === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }
}

export function readStoredTheme(): Theme {
    if (typeof window === 'undefined') return 'light'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    // Fall back to OS preference on first visit
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
}

export function useTheme(): [Theme, (theme: Theme) => void, () => void] {
    const [theme, setThemeState] = useState<Theme>('light')

    useEffect(() => {
        const initial = readStoredTheme()
        setThemeState(initial)
        applyTheme(initial)
    }, [])

    const setTheme = (next: Theme) => {
        setThemeState(next)
        applyTheme(next)
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, next)
        }
    }

    const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    return [theme, setTheme, toggle]
}
