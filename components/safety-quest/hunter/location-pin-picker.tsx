"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Map, { Marker } from "react-map-gl/mapbox"
import type { MapMouseEvent, MapRef } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { motion, useReducedMotion } from "framer-motion"
import { LocateFixed, MapPin, Search, X } from "lucide-react"

import { Mascot, PrimaryCTA, tokens } from "./theme"

export interface LocationPinPickerProps {
  onConfirm: (pin: { latitude: number; longitude: number }) => void
  initial?: { latitude: number; longitude: number }
}

// 日本（東京）あたりを初期表示の中心にする
const DEFAULT_CENTER = {
  latitude: 35.68,
  longitude: 139.76,
}
const DEFAULT_ZOOM = 14

type Pin = { latitude: number; longitude: number }
type Suggestion = { id: string; label: string; latitude: number; longitude: number }

const C = tokens.color

export function LocationPinPicker({
  onConfirm,
  initial,
}: LocationPinPickerProps) {
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const reduce = useReducedMotion()
  const mapRef = useRef<MapRef | null>(null)

  const initialViewState = useMemo(
    () => ({
      latitude: initial?.latitude ?? DEFAULT_CENTER.latitude,
      longitude: initial?.longitude ?? DEFAULT_CENTER.longitude,
      zoom: DEFAULT_ZOOM,
    }),
    [initial?.latitude, initial?.longitude],
  )

  const [pin, setPin] = useState<Pin | null>(() =>
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : null,
  )
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [locating, setLocating] = useState(false)

  // ピンを置きつつ地図をその地点へ移動
  const moveTo = useCallback((latitude: number, longitude: number, zoom = 16) => {
    setPin({ latitude, longitude })
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom, duration: 800 })
  }, [])

  // 地図をタップ/クリックした地点にピンを置く
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    setSuggestions([])
    setPin({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
  }, [])

  const handleConfirm = useCallback(() => {
    if (!pin) return
    onConfirm({ latitude: pin.latitude, longitude: pin.longitude })
  }, [pin, onConfirm])

  // --- 住所 / 地名の検索（Mapbox Geocoding・デバウンス） ---
  useEffect(() => {
    const q = query.trim()
    if (!mapToken || q.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      // 表示中の地図の中心に近い候補を優先（地域の関連性を上げる）
      const center = mapRef.current?.getCenter()
      const proximity =
        center && Number.isFinite(center.lng) && Number.isFinite(center.lat)
          ? `&proximity=${center.lng},${center.lat}`
          : ""
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?access_token=${mapToken}&country=jp&language=ja&limit=5&types=place,locality,neighborhood,address,poi${proximity}`
      fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const features = Array.isArray(data?.features) ? data.features : []
          const items: Suggestion[] = features
            .map((f: Record<string, unknown>) => {
              const center = f.center as [number, number] | undefined
              return {
                id: String(f.id ?? f.place_name ?? Math.random()),
                label: String(f.place_name ?? f.text ?? ""),
                longitude: Number(center?.[0]),
                latitude: Number(center?.[1]),
              }
            })
            .filter(
              (s: Suggestion) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
            )
          setSuggestions(items)
        })
        .catch(() => {
          // abort / ネットワーク失敗は無視（検索なしで地図タップは使える）
        })
    }, 320)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, mapToken])

  const handleSelectSuggestion = useCallback(
    (s: Suggestion) => {
      setQuery(s.label)
      setSuggestions([])
      moveTo(s.latitude, s.longitude)
    },
    [moveTo],
  )

  // 現在地へ移動（任意・許可が必要）
  const handleLocate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        moveTo(pos.coords.latitude, pos.coords.longitude, 17)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [moveTo])

  // トークンが無い場合は地図を出さずフォールバック表示（throwしない）
  if (!mapToken) {
    return (
      <div
        className="flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed bg-[#FFF8EF] p-6 text-center"
        style={{
          borderColor: `${C.primary}55`,
          boxShadow: tokens.shadow.soft,
        }}
      >
        <Mascot size="md" mood="think" />
        <p className="text-[17px] font-extrabold" style={{ color: C.primaryStrong }}>
          <ruby>
            地図<rt>ちず</rt>
          </ruby>
          を よみこめなかったみたい
        </p>
        <p className="text-[15px] font-medium" style={{ color: C.inkSoft }}>
          もういちど ためしてみてね
        </p>
      </div>
    )
  }

  const pinKey = pin ? `${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}` : ""

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[24px] bg-white"
      style={{
        boxShadow: `0 0 0 4px ${C.primary}, ${tokens.shadow.soft}, ${tokens.shadow.card}`,
      }}
    >
      {/* 地図エリア（flex-1 でモバイルでも大きく見やすく） */}
      <div className="relative w-full flex-1 min-h-[300px]">
        <Map
          ref={mapRef}
          mapboxAccessToken={mapToken}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={initialViewState}
          onClick={handleMapClick}
          cursor="crosshair"
          attributionControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {pin && (
            <Marker latitude={pin.latitude} longitude={pin.longitude} anchor="bottom">
              <motion.div
                key={pinKey}
                role="img"
                aria-label="えらんだ ばしょの ピン"
                className="relative flex flex-col items-center"
                initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0.2 } : { ...tokens.spring }}
              >
                {!reduce && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: C.primary }}
                    initial={{ scale: 0.6, opacity: 0.45 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span
                  className="relative grid h-14 w-14 place-items-center rounded-full text-white"
                  style={{
                    background: tokens.gradient.sky,
                    boxShadow: `0 0 0 4px #fff, ${tokens.shadow.card}`,
                  }}
                >
                  <MapPin className="h-7 w-7" aria-hidden="true" strokeWidth={2.5} />
                </span>
                <span
                  aria-hidden="true"
                  className="-mt-1 h-0 w-0"
                  style={{
                    borderLeft: "8px solid transparent",
                    borderRight: "8px solid transparent",
                    borderTop: `11px solid ${C.primaryStrong}`,
                  }}
                />
              </motion.div>
            </Marker>
          )}
        </Map>

        {/* 検索窓（上部オーバーレイ） */}
        <div className="absolute inset-x-2 top-2 z-20">
          <div
            className="flex items-center gap-2 rounded-full bg-white px-3 py-2.5"
            style={{ boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}` }}
          >
            <Search className="h-5 w-5 shrink-0" style={{ color: C.primary }} aria-hidden="true" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ばしょを さがす（れい: ○○小学校）"
              aria-label="ばしょの なまえで さがす"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:font-medium"
              style={{ color: C.ink }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setSuggestions([])
                }}
                aria-label="けんさくを けす"
                className={`shrink-0 rounded-full p-1 hover:bg-black/5 ${tokens.cls.focus}`}
              >
                <X className="h-4 w-4" style={{ color: C.inkSoft }} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* 検索候補 */}
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="ばしょの こうほ"
              className="mt-1.5 overflow-hidden rounded-[18px] bg-white"
              style={{ boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}` }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => handleSelectSuggestion(s)}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-[#EAF4FF]"
                  >
                    <MapPin
                      className="h-4 w-4 shrink-0"
                      style={{ color: C.accent }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-[14px] font-bold leading-snug"
                      style={{ color: C.ink }}
                    >
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 現在地ボタン（右下） */}
        <button
          type="button"
          onClick={handleLocate}
          aria-label="いまいる ばしょへ いどう"
          className={`absolute bottom-3 right-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-white ${tokens.cls.focus}`}
          style={{ boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}`, color: C.primary }}
        >
          <LocateFixed
            className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
        </button>

        {/* 下部の小さなヒント（候補表示中は隠す） */}
        {suggestions.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-2">
            <span className="rounded-full bg-black/55 px-3 py-1 text-[12px] font-bold text-white">
              {pin ? "べつの ところも タップできるよ" : "ちずを タップして ピンを おいてね"}
            </span>
          </div>
        )}
      </div>

      {/* 決定バー（下部・固定） */}
      <div
        className="flex shrink-0 flex-col gap-2 px-4 py-3"
        style={{ background: C.surfaceWarm }}
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0">
            <Mascot size="sm" mood={pin ? "cheer" : "happy"} />
          </span>
          <p
            className="flex-1 text-[14px] font-bold leading-snug"
            style={{ color: pin ? C.success : C.inkSoft }}
          >
            {pin
              ? "ピンを おいたよ！ いいばしょかな？"
              : "さがす か ちずタップで ばしょを えらんでね"}
          </p>
        </div>
        <PrimaryCTA onClick={handleConfirm} disabled={!pin} className={tokens.cls.ctaBlue}>
          ここにする
        </PrimaryCTA>
      </div>
    </div>
  )
}
