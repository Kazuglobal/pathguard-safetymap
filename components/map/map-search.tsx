"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { Search, Loader2, MapPin, School } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import mapboxgl from "mapbox-gl"
import { isInsideBox, looksLikeSchoolName, matchesSchoolCategory, schoolsInViewFirst, type LngLatBox } from "@/lib/school-search"
import { getMapboxToken } from "@/lib/mapbox-config"

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

interface RankedResult extends SearchResult {
  /** 表示範囲の中の学校 */
  isSchoolInView: boolean
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

interface GeocodingFeatureProperties {
  category?: string
}

interface GeocodingFeature {
  id?: string
  place_name?: string
  text?: string
  center?: number[]
  place_type?: string[]
  properties?: GeocodingFeatureProperties
}

interface GeocodingResponse {
  features?: GeocodingFeature[]
}

function isSchool(result: SearchResult): boolean {
  return result.feature_type === "poi" && matchesSchoolCategory(result.poi_category)
}

/** 並べ替えでは、カテゴリの付いていない学校の POI も名前で拾う */
function isSchoolLike(result: SearchResult): boolean {
  return isSchool(result) || (result.feature_type === "poi" && looksLikeSchoolName(result.place_name))
}

/** いま地図に見えている範囲(取れなければ null) */
function getMapView(map: mapboxgl.Map | null): LngLatBox | null {
  if (!map || typeof map.getBounds !== "function") return null
  try {
    const bounds = map.getBounds()
    if (!bounds) return null
    const view = { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }
    return Object.values(view).every(Number.isFinite) ? view : null
  } catch {
    return null
  }
}

/** 表示範囲の中の学校を先に並べ、その学校に「地図の中」の印を付ける(UIUX改装 項目49) */
function rankForView(results: SearchResult[], map: mapboxgl.Map | null): RankedResult[] {
  const view = getMapView(map)
  return schoolsInViewFirst(results, view, isSchoolLike).map((result) => ({
    ...result,
    isSchoolInView: view !== null && isSchoolLike(result) && isInsideBox(result.center, view),
  }))
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

function toGeocodingResult(feature: GeocodingFeature): SearchResult | null {
  const coordinates = feature?.center

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null
  }

  const placeType = Array.isArray(feature.place_type) ? feature.place_type[0] : undefined

  return {
    id: String(feature?.id ?? `${coordinates[0]},${coordinates[1]}`),
    place_name: feature.place_name ?? feature.text ?? "",
    center: [coordinates[0], coordinates[1]],
    feature_type: typeof placeType === "string" ? placeType : undefined,
    poi_category: toStringArray(feature.properties?.category),
  }
}

function getAccessToken(): string {
  const token =
    mapboxgl.accessToken ||
    getMapboxToken() ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ""
  return token.trim()
}

async function fetchSearchBoxResults(query: string, map: mapboxgl.Map | null): Promise<SearchResult[]> {
  const accessToken = getAccessToken()
  const params = new URLSearchParams({
    q: query,
    access_token: accessToken,
    country: "JP",
    language: "ja",
    auto_complete: "true",
    limit: "8",
    types: "address,street,neighborhood,locality,place,district,postcode,region,poi,category",
  })

  if (map && typeof map.getCenter === "function") {
    try {
      const center = map.getCenter()
      if (center && Number.isFinite(center.lng) && Number.isFinite(center.lat)) {
        params.set("proximity", `${center.lng},${center.lat}`)
      }
    } catch {
      // ignore
    }
  }

  const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Search Box request failed: ${response.status}`)
  }

  const data: SearchBoxResponse = await response.json()
  if (!Array.isArray(data.features)) {
    return []
  }

  return data.features
    .map(toSearchResult)
    .filter((result: SearchResult | null): result is SearchResult => result !== null)
}

async function fetchGeocodingResults(query: string, map: mapboxgl.Map | null): Promise<SearchResult[]> {
  const accessToken = getAccessToken()
  const params = new URLSearchParams({
    access_token: accessToken,
    country: "JP",
    language: "ja",
    autocomplete: "true",
    limit: "8",
    types: "address,place,locality,neighborhood,district,region,postcode",
  })

  if (map && typeof map.getCenter === "function") {
    try {
      const center = map.getCenter()
      if (center && Number.isFinite(center.lng) && Number.isFinite(center.lat)) {
        params.set("proximity", `${center.lng},${center.lat}`)
      }
    } catch {
      // ignore
    }
  }

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${response.status}`)
  }

  const data: GeocodingResponse = await response.json()
  if (!Array.isArray(data.features)) {
    return []
  }

  return data.features
    .map(toGeocodingResult)
    .filter((result: SearchResult | null): result is SearchResult => result !== null)
}

/** 取れなかったときは null(0件の [] と見分ける) */
async function fetchInternalGeocodingResults(query: string): Promise<SearchResult[] | null> {
  try {
    const res = await fetch(
      `/api/mapbox/geocode?query=${encodeURIComponent(query)}&language=ja&country=jp&limit=8`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data
      .map((item: any): SearchResult | null => {
        if (!item || !Array.isArray(item.center) || item.center.length < 2) return null
        return {
          id: String(item.id ?? `${item.center[0]},${item.center[1]}`),
          place_name: item.place_name_ja ?? item.place_name ?? item.text ?? "",
          center: [item.center[0], item.center[1]],
          feature_type: Array.isArray(item.place_type) ? item.place_type[0] : undefined,
          poi_category: toStringArray(item.properties?.category),
        }
      })
      .filter((r): r is SearchResult => r !== null)
  } catch {
    return null
  }
}

/**
 * 3つの検索を順に試す。どれも取れなかったときは failed=true(通信の失敗を「見つからない」と言わないため)
 */
async function executeSearch(query: string, map: mapboxgl.Map | null): Promise<{ results: SearchResult[]; failed: boolean }> {
  let nextResults: SearchResult[] = []
  let failures = 0

  try {
    nextResults = await fetchSearchBoxResults(query, map)
  } catch (error) {
    failures += 1
    console.warn("Search Box 検索エラー:", error)
  }

  if (nextResults.length === 0) {
    try {
      nextResults = await fetchGeocodingResults(query, map)
    } catch (error) {
      failures += 1
      console.warn("Geocoding 検索エラー:", error)
    }
  }

  if (nextResults.length === 0) {
    const internal = await fetchInternalGeocodingResults(query)
    if (internal === null) failures += 1
    else nextResults = internal
  }

  return { results: nextResults, failed: nextResults.length === 0 && failures === 3 }
}

export default function MapSearch({
  map,
  onSelectLocation,
  className,
  inputClassName,
  dismissResultsSignal,
}: MapSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RankedResult[]>([])
  // 探し終えて候補が0件だったときの言葉(案内を出す。UIUX改装 項目49)
  const [emptyQuery, setEmptyQuery] = useState<string | null>(null)
  // 通信の失敗などで、どの検索も取れなかった(入れ方のせいにしない)
  const [searchFailed, setSearchFailed] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)
  const skipNextSearchRef = useRef(false)

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

  // 入力時の予測検索（デバウンス 300ms）
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

    const trimmed = query.trim()
    setEmptyQuery(null)
    if (trimmed.length < 1) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      setResults([])
      setShowResults(false)
      setIsSearching(false)
      return
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    const requestId = ++searchRequestIdRef.current
    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { results: found, failed } = await executeSearch(trimmed, map)
        const nextResults = rankForView(found, map)
        if (requestId !== searchRequestIdRef.current) return
        setResults(nextResults)
        setSearchFailed(failed)
        setEmptyQuery(nextResults.length === 0 ? trimmed : null)
        setShowResults(true)
      } catch (error) {
        console.error("住所予測検索エラー:", error)
        if (requestId === searchRequestIdRef.current) {
          setResults([])
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query, map])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const trimmed = query.trim()
    if (!trimmed) return

    // もし既に予測候補が表示されている場合は先頭候補に移動
    if (results.length > 0) {
      handleResultClick(results[0])
      return
    }

    const requestId = ++searchRequestIdRef.current
    setIsSearching(true)
    setShowResults(true)

    try {
      const { results: found, failed } = await executeSearch(trimmed, map)
      const nextResults = rankForView(found, map)
      if (requestId !== searchRequestIdRef.current) return

      setResults(nextResults)
      setSearchFailed(failed)
      setEmptyQuery(nextResults.length === 0 ? trimmed : null)
      setShowResults(true)

      // 検索実行時に候補があれば先頭地点へ移動する
      if (nextResults.length > 0 && map) {
        map.flyTo({
          center: nextResults[0].center,
          zoom: 15,
          essential: true,
        })
      }
    } catch (error) {
      console.error("住所検索エラー:", error)
      if (requestId === searchRequestIdRef.current) {
        setResults([])
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false)
      }
    }
  }

  const handleResultClick = (result: SearchResult) => {
    skipNextSearchRef.current = true
    setQuery(result.place_name)
    setShowResults(false)

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
          aria-label="検索する"
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
                {isSchoolLike(result) ? (
                  <School className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-blue-600" />
                ) : (
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                )}
                <span className="text-sm">
                  {result.place_name}
                  {result.isSchoolInView && (
                    <span className="ml-1.5 inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">地図の中</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showResults && results.length === 0 && emptyQuery && !isSearching && (
        <Card role="status" className="absolute z-10 mt-1 w-full p-3 text-sm leading-relaxed" data-testid="map-search-empty">
          {searchFailed
            ? "検索できませんでした。通信状態を確認して、もう一度お試しください。"
            : `「${emptyQuery}」に当てはまる場所が見つかりませんでした。学校は「〇〇小学校」、住所は「〇〇市〇〇町」のように入れてみてください。`}
        </Card>
      )}
    </div>
  )
}
