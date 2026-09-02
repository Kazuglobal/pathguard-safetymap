export async function toggleReportInteraction(
  reportId: string,
  kind: 'like' | 'bookmark',
): Promise<{ active: boolean; count: number }> {
  const response = await fetch(
    `/api/reports/${encodeURIComponent(reportId)}/interactions/${kind}`,
    { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } },
  )
  const body = await response.json().catch(() => null) as {
    active?: boolean
    count?: number
    error?: string
  } | null
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
  if (typeof body?.active !== 'boolean' || typeof body.count !== 'number') {
    throw new Error('Invalid interaction response')
  }
  return { active: body.active, count: body.count }
}

export interface ReportInteractionSnapshot {
  reportId: string
  liked: boolean
  likeCount: number
  saved: boolean
  saveCount: number
}

export async function fetchReportInteractions(
  reportIds: readonly string[],
): Promise<ReportInteractionSnapshot[]> {
  const query = new URLSearchParams()
  for (const reportId of reportIds) query.append('id', reportId)
  const response = await fetch(`/api/report-interactions?${query.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 401) return []
  const body = await response.json().catch(() => null) as {
    interactions?: ReportInteractionSnapshot[]
    error?: string
  } | null
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
  return Array.isArray(body?.interactions) ? body.interactions : []
}
