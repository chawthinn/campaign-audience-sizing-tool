export function getBackendBaseUrl() {
    return process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? ''
}

export function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const baseUrl = getBackendBaseUrl()

    if (baseUrl) {
        return `${baseUrl}${normalizedPath}`
    }

    return `/api${normalizedPath}`
}

export function resolveDownloadUrl(url?: string | null) {
    if (!url) {
        return ''
    }

    if (/^https?:\/\//i.test(url)) {
        return url
    }

    const baseUrl = getBackendBaseUrl()

    if (baseUrl && url.startsWith('/')) {
        return `${baseUrl}${url}`
    }

    return url
}