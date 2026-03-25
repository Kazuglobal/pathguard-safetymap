"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { Search, Loader2, MapPin, School } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import mapboxgl from "mapbox-gl"

interface MapSearchProps {
  map: mapboxgl.Map | null
  onSelectLocation?: (coordinates: [number, number]) => void
  className?: string
  inputClassName?: string
  dismissResultsSignal?: number
}

interface SearchResult {
  id: string
  place_name: string
  center: [number, number]
  feature_type?: string
  poi_category: string[]
}

interface SearchBoxFeatureProperties {
  full_address?: string
  name?: string
  mapbox_id?: string
  feature_type?: string
  poi_category?: string[] | string
}

interface SearchBoxFeature {
  id?: string
  geometry?: {
    coordinates?: number[]
  }
  properties?: SearchBoxFeatureProperties
}

interface SearchBoxResponse {
  features?: SearchBoxFeature[]
}

const SCHOOL_CATEGORIES = ["school", "university", "college", "kindergarten"]

function isSchool(result: SearchResult): boolean {
  return result.feature_type === "poi" && result.poi_category.some((category) => SCHOOL_CATEGORIES.includes(category))
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
  }

  if (typeof value === "string" && value.length > 0) {
    return [value.toLowerCase()]
  }

  return []
}

function toSearchResult(feature: SearchBoxFeature): SearchResult | null {
  const properties = feature?.properties ?? {}
  const coordinates = feature?.geometry?.coordinates

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null
  }

  return {
    id: String(feature?.id ?? properties?.mapbox_id ?? properties?.name ?? `${coordinates[0]},${coordinates[1]}`),
    place_name: properties.full_address ?? properties.name ?? "",
    center: [coordinates[0], coordinates[1]],
    feature_type: typeof properties.feature_type === "string" ? properties.feature_type : undefined,
    poi_category: toStringArray(properties.poi_category),
  }
}

export default function MapSearch({
  map,
  onSelectLocation,
  className,
  inputClassName,
  dismissResultsSignal,
}: MapSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    setShowResults(false)
  }, [dismissResultsSignal])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!query.trim()) return

    setIsSearching(true)
    setShowResults(true)

    try {
      const accessToken = mapboxgl.accessToken || ""
      const params = new URLSearchParams({
        q: query,
        access_token: accessToken,
        country: "jp",
        language: "ja",
        auto_complete: "true",
        limit: "8",
        types: "address,street,neighborhood,locality,place,district,postcode,region,poi,category",
      })

      if (map) {
        const center = map.getCenter()
        params.set("proximity", `${center.lng},${center.lat}`)
      }

      const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`

      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`Search request failed: ${response.status}`)
      }
      const data: SearchBoxResponse = await response.json()

      if (Array.isArray(data.features)) {
        setResults(
          data.features
            .map(toSearchResult)
            .filter((result: SearchResult | null): result is SearchResult => result !== null),
        )
      } else {
        setResults([])
      }
    } catch (error) {
      console.error("住所検索エラー:", error)
      setResults([])
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
    <div
      ref={searchRef}
      data-testid="map-search-root"
      className={`relative w-full max-w-none ${className ?? ""}`.trim()}
    >
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="学校・施設・住所を検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`pr-10 bg-white ${inputClassName ?? ""}`.trim()}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-0 top-0 h-full"
          disabled={isSearching}
          aria-label="search"
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
                {isSchool(result) ? (
                  <School className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-blue-600" />
                ) : (
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                )}
                <span className="text-sm">{result.place_name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
