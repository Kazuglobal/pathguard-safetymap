"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search, Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import mapboxgl from "mapbox-gl"

interface MapSearchProps {
  map: mapboxgl.Map | null
  onSelectLocation?: (coordinates: [number, number]) => void
}

interface SearchResult {
  id: string
  place_name: string
  center: [number, number]
}

export default function MapSearch({ map, onSelectLocation }: MapSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // 検索結果の外側をクリックし

  // 検索結果の外側をクリックしたら結果を閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!query.trim()) return

    setIsSearching(true)
    setShowResults(true)

    try {
      const accessToken = mapboxgl.accessToken
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query,
      )}.json?access_token=${accessToken}&country=jp&language=ja`

      const response = await fetch(endpoint)
      const data = await response.json()

      if (data.features) {
        setResults(
          data.features.map((feature: any) => ({
            id: feature.id,
            place_name: feature.place_name,
            center: feature.center,
          })),
        )
      }
    } catch (error) {
      console.error("住所検索エラー:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    if (!map) return

    // 地図を選択した場所に移動
    map.flyTo({
      center: result.center,
      zoom: 15,
      essential: true,
    })

    // 選択した場所にマーカーを表示（オプション）
    if (onSelectLocation) {
      onSelectLocation(result.center)
    }

    setShowResults(false)
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-[200px] sm:max-w-md">
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="住所や場所を検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-10 bg-white"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-0 top-0 h-full"
          disabled={isSearching}
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {showResults && results.length > 0 && (
        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-auto">
          <ul className="py-1">
            {results.map((result) => (
              <li
                key={result.id}
                className="px-3 py-2 hover:bg-muted cursor-pointer flex items-start"
                onClick={() => handleResultClick(result)}
              >
                <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-sm">{result.place_name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
