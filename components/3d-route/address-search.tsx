"use client"
import { useState, useRef, useCallback } from 'react'
import { Search, X, MapPin, Loader2 } from 'lucide-react'

export interface GeoResult {
  name: string
  lon: number
  lat: number
}

interface Props {
  onSelect: (result: GeoResult) => void
}

export default function AddressSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/mapbox/geocode?query=${encodeURIComponent(q)}&language=ja&country=jp&limit=5`
      )
      if (!res.ok) throw new Error('Search failed')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json()
      const parsed: GeoResult[] = (Array.isArray(data) ? data : []).map((f) => ({
        name: f.place_name_ja ?? f.place_name ?? f.text ?? '不明',
        lon: f.center?.[0] ?? 0,
        lat: f.center?.[1] ?? 0,
      }))
      setResults(parsed)
      setShowDropdown(parsed.length > 0)
    } catch {
      setResults([])
      setShowDropdown(false)
    } finally {
      setIsLoading(false)
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

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
          {results.map((r, i) => (
            <li key={i} className="border-b border-white/5 last:border-b-0">
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
