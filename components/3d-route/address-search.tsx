"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, MapPin, Loader2 } from 'lucide-react'

export interface GeoResult {
  name: string
  lon: number
  lat: number
}

interface Props {
  onSelect: (result: GeoResult) => void
}

interface RawGeocodeFeature {
  place_name_ja?: string
  place_name?: string
  text?: string
  center?: unknown
}

function isValidCoordinate(lon: number, lat: number) {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

function parseFeature(feature: unknown): GeoResult | null {
  if (!feature || typeof feature !== 'object') return null
  const f = feature as RawGeocodeFeature
  if (!Array.isArray(f.center) || f.center.length < 2) return null

  const lon = Number(f.center[0])
  const lat = Number(f.center[1])
  if (!isValidCoordinate(lon, lat)) return null

  const name = f.place_name_ja ?? f.place_name ?? f.text ?? '不明'
  return { name, lon, lat }
}

export default function AddressSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      abortRef.current?.abort()
      setResults([])
      setShowDropdown(false)
      setIsLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    try {
      const res = await fetch(
        `/api/mapbox/geocode?query=${encodeURIComponent(q)}&language=ja&country=jp&limit=5`,
        { signal: controller.signal }
      )
      if (!res.ok) throw new Error('Search failed')
      const data: unknown = await res.json()
      const parsed: GeoResult[] = Array.isArray(data)
        ? data.map(parseFeature).filter((f): f is GeoResult => f !== null)
        : []

      if (requestId !== requestIdRef.current) return

      setResults(parsed)
      setShowDropdown(parsed.length > 0)
    } catch {
      if (controller.signal.aborted) return
      if (requestId !== requestIdRef.current) return

      setResults([])
      setShowDropdown(false)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 350)
  }

  const handleSelect = (result: GeoResult) => {
    setQuery(result.name)
    setShowDropdown(false)
    onSelect(result)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    abortRef.current?.abort()
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="relative w-full">
      <div className="flex items-center bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2.5 gap-2 focus-within:border-blue-500/50 transition-colors">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="住所・場所を検索..."
          className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none min-w-0"
        />
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 text-slate-400 shrink-0 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="text-slate-500 hover:text-white shrink-0 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
          {results.map((r) => (
            <li
              key={`${r.name}-${r.lon.toFixed(6)}-${r.lat.toFixed(6)}`}
              className="border-b border-white/5 last:border-b-0"
            >
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/10 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-white text-xs leading-snug">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
