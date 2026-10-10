export type Participant = 'all' | 'bicycle' | 'pedestrian'
export interface AccidentQuery {
  prefecture: string; municipality: string; participant: Participant
  from?: number; to?: number; time: 'all' | 'morning' | 'afternoon' | 'evening'
  severity: 'all' | 'fatal'; kind: 'all' | 'intersection' | 'road'
  version: string; offset: number; limit: number
}
export function parseAccidentQuery(p: URLSearchParams): AccidentQuery {
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = p.get(key) ?? fallback
    if (!values.includes(value as T)) throw new Error(`Invalid ${key}`)
    return value as T
  }
  const number = (key: string, fallback: number | undefined, min: number, max: number) => {
    const value = p.get(key)
    if (value === null || value === '') return fallback
    if (!/^\d+$/.test(value)) throw new Error(`Invalid ${key}`)
    const n = Number(value)
    if (n < min || n > max) throw new Error(`Invalid ${key}`)
    return n
  }
  const code = (key: string, pattern: RegExp) => {
    const value = p.get(key) ?? ''
    if (value && !pattern.test(value)) throw new Error(`Invalid ${key}`)
    return value
  }
  const q: AccidentQuery = {
    prefecture: code('prefecture', /^\d{2}$/), municipality: code('municipality', /^\d{5}$/),
    participant: choice('participant', ['all', 'bicycle', 'pedestrian'], 'all'),
    from: number('from', undefined, 2018, 2100), to: number('to', undefined, 2018, 2100),
    time: choice('time', ['all', 'morning', 'afternoon', 'evening'], 'all'),
    severity: choice('severity', ['all', 'fatal'], 'all'), kind: choice('kind', ['all', 'intersection', 'road'], 'all'),
    version: code('version', /^[a-zA-Z0-9_-]{1,64}$/),
    offset: number('offset', 0, 0, 10000)!, limit: number('limit', 10, 1, 20)!,
  }
  if (q.municipality && !q.prefecture) throw new Error('A prefecture is required')
  if (q.from && q.to && q.from > q.to) throw new Error('Invalid year range')
  if (q.offset && !q.version) throw new Error('A version is required for pagination')
  return q
}
export interface RankedLocation {
  id: string; name: string; kind: 'intersection' | 'road'; latitude: number; longitude: number
  count: number; rank: number; prefecture: string; municipality: string
}
export interface SnapshotMetadata {
  version: string; updatedAt: string; years: number[]; method: string
  sources: Array<{ name: string; url: string; license: string; retrievedAt: string }>
}
export interface RankingsResponse {
  status: 'ready' | 'preparing' | 'unavailable'
  metadata: SnapshotMetadata | null; items: RankedLocation[]; nextOffset: number | null
  quality: { assigned: number; uncertain: number; excluded: number }
}
