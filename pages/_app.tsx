import React from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import '@/styles/globals.css'

// Inline script that runs BEFORE React hydrates, so dark mode applies on first paint
// (avoids the white flash when the user has dark mode selected).
const themeInitScript = `
(function() {
    try {
        var stored = localStorage.getItem('cast-theme');
        var theme = stored;
        if (theme !== 'dark' && theme !== 'light') {
            theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        }
        if (theme === 'dark') document.documentElement.classList.add('dark');
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
        </>
    )
}

export default App
