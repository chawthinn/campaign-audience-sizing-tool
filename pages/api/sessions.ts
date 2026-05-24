// Shared session storage for all API routes
export const sessions: Record<
  string,
  {
    intersectionData: Array<Record<string, any>>
    headers: string[]
    setACount: number
    setBCount: number
  }
> = {}
