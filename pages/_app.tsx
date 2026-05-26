import React from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/globals.css'

// Inline script that runs BEFORE React hydrates, so dark mode applies on first paint
// (avoids the white flash when the user has dark mode selected).
const themeInitScript = `
(function() {
    try {
        var stored = localStorage.getItem('cast-theme');
        // Default to light; only switch to dark if the user explicitly chose it.
        if (stored === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
})();
`

function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </Head>
            <Component {...pageProps} />
            <Analytics />
        </>
    )
}

export default App
