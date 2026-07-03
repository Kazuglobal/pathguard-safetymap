"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Map, { Marker } from "react-map-gl/mapbox"
import type { MapMouseEvent, MapRef } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { motion, useReducedMotion } from "framer-motion"
import {
  Building2,
  LocateFixed,
  MapPin,
  Satellite,
  Map as MapIcon,
  Search,
  X,
} from "lucide-react"

import { BottomBar, Mascot, PrimaryCTA, tokens } from "./theme"

export interface LocationPinPickerProps {
  onConfirm: (pin: { latitude: number; longitude: number }) => void
  initial?: { latitude: number; longitude: number }
}

// 日本(東京)あたりを初期表示の中心にする
const DEFAULT_CENTER = {
  latitude: 35.68,
  longitude: 139.76,
}
const DEFAULT_ZOOM = 14

// 地図の種類(ちず / 航空写真)。航空写真は地名ラベル付きで場所を選びやすい。
const MAP_STYLES = {
  street: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const
type MapStyleKey = keyof typeof MAP_STYLES

type Pin = { latitude: number; longitude: number }
/** kind: place=住所/地名, facility=学校など施設(POI) */
type Suggestion = {
  id: string
  /** 主表示(施設名・地名)。太字で見せる */
  label: string
  /** 副表示(住所など)。薄い文字で2行目に */
  sublabel?: string
  latitude: number
  longitude: number
  kind: "place" | "facility"
}

const C = tokens.color

// ---- 検索(Mapbox Geocoding) ----

/** Mapbox Geocoding。住所・地名・POIを検索する。 */
async function fetchMapboxSuggestions(
  query: string,
  token: string,
  proximity: { lng: number; lat: number } | null,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  const prox =
    proximity && Number.isFinite(proximity.lng) && Number.isFinite(proximity.lat)
      ? `&proximity=${proximity.lng},${proximity.lat}`
      : ""
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${token}&country=jp&language=ja&limit=5&types=place,locality,neighborhood,address,poi${prox}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  const features = Array.isArray(data?.features) ? data.features : []
  return features
    .map((f: Record<string, unknown>): Suggestion => {
      const center = f.center as [number, number] | undefined
      const types = (f.place_type as string[] | undefined) ?? []
      const primary = String(f.text ?? f.place_name ?? "")
      const full = String(f.place_name ?? "")
      // place_name は「四谷小学校, 新宿区...」のように先頭が primary。住所部分だけ副表示に。
      const sublabel = full.startsWith(primary)
        ? full.slice(primary.length).replace(/^[,、\s]+/, "")
        : full
      return {
        id: `mb-${String(f.id ?? f.place_name ?? Math.random())}`,
        label: primary,
        sublabel: sublabel || undefined,
        longitude: Number(center?.[0]),
        latitude: Number(center?.[1]),
        kind: types.includes("poi") ? "facility" : "place",
      }
    })
    .filter((s: Suggestion) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
}

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
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("street")

  /** ラベルを日本語優先にする(子ども向け: 英語表記を避ける)。 */
  const localizeLabels = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      const layers = map.getStyle()?.layers ?? []
      for (const layer of layers) {
        if (layer.type !== "symbol") continue
        // 道路番号シールドや出口番号は name を持たない(ref 等を表示)ため
        // 書き換えると空ラベルになる。名前系レイヤーだけを対象にする。
        if (/shield|road-number|road-exit|oneway/.test(layer.id)) continue
        const textField = map.getLayoutProperty(layer.id, "text-field") as unknown
        if (!textField) continue
        const serialized = JSON.stringify(textField)
        if (!serialized.includes("name")) continue
        map.setLayoutProperty(layer.id, "text-field", [
          "coalesce",
          ["get", "name_ja"],
          ["get", "name"],
        ])
      }
    } catch {
      // スタイルにより失敗しても地図機能は損なわない
    }
  }, [])

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

  // --- 検索(住所・地名・施設を Mapbox で検索・デバウンス) ---
  useEffect(() => {
    const q = query.trim()
    if (!mapToken || q.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      // 表示中の地図の中心・範囲に近い候補を優先(地域の関連性を上げる)
      const center = mapRef.current?.getCenter() ?? null
      const proximity = center ? { lng: center.lng, lat: center.lat } : null
      fetchMapboxSuggestions(q, mapToken, proximity, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          setSuggestions(results)
        })
        .catch(() => {
          // abort / ネットワーク失敗は無視(検索なしでも地図タップは使える)
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

  // 現在地へ移動(任意・許可が必要)
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

  // トークンが無い場合は地図を出さずフォールバック表示(throwしない)
  if (!mapToken) {
    return (
      <div
        className="flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed p-6 text-center"
        style={{
          borderColor: `${C.primary}55`,
          background: C.card,
          boxShadow: tokens.shadow.soft,
        }}
      >
        <Mascot size="md" mood="think" />
        <p className="text-[16px] font-black" style={{ color: C.primaryStrong }}>
          <ruby>
            地図<rt>ちず</rt>
          </ruby>
          を よみこめなかったみたい
        </p>
        <p className="text-[14px] font-bold" style={{ color: C.inkSoft }}>
          もういちど ためしてみてね
        </p>
      </div>
    )
  }

  const pinKey = pin ? `${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}` : ""

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      {/* 地図(白フレームの窓) */}
      <div
        className="relative min-h-[240px] w-full flex-1 overflow-hidden rounded-[18px] border-4 bg-white"
        style={{ borderColor: "#FFFFFF", boxShadow: tokens.shadow.card }}
      >
        <Map
          ref={mapRef}
          mapboxAccessToken={mapToken}
          mapStyle={MAP_STYLES[mapStyle]}
          initialViewState={initialViewState}
          onClick={handleMapClick}
          onLoad={localizeLabels}
          onStyleData={localizeLabels}
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
                initial={reduce ? { opacity: 0 } : { y: -18, scale: 0.4, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 480, damping: 24 }}
              >
                {!reduce && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: C.primary }}
                    initial={{ scale: 0.6, opacity: 0.4 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span
                  className="relative grid h-[52px] w-[52px] place-items-center rounded-full"
                  style={{
                    background: C.primary,
                    boxShadow: `0 0 0 4px #fff, ${tokens.shadow.card}`,
                    color: "#fff",
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

        {/* 検索窓(上部オーバーレイ) */}
        <div className="absolute inset-x-2.5 top-2.5 z-20">
          <div
            className="flex items-center gap-2 rounded-full border bg-white px-3.5 py-2.5"
            style={{ borderColor: "rgba(67,57,43,.1)", boxShadow: tokens.shadow.card }}
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
              style={{ color: C.ink, fontFamily: tokens.font.family }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setSuggestions([])
                }}
                aria-label="けんさくを けす"
                className={`shrink-0 rounded-full p-1.5 hover:bg-black/5 ${tokens.cls.focus}`}
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
              className="mt-1.5 overflow-hidden rounded-[16px] border bg-white"
              style={{ borderColor: "rgba(67,57,43,.1)", boxShadow: tokens.shadow.card }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => handleSelectSuggestion(s)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left hover:bg-[#F2FAF6]"
                  >
                    {s.kind === "facility" ? (
                      <Building2
                        className="h-4 w-4 shrink-0"
                        style={{ color: C.primary }}
                        aria-label="しせつ"
                      />
                    ) : (
                      <MapPin
                        className="h-4 w-4 shrink-0"
                        style={{ color: C.accent }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[14px] font-black leading-snug"
                        style={{ color: C.ink }}
                      >
                        {s.label}
                      </span>
                      {s.sublabel && (
                        <span
                          className="block truncate text-[11.5px] font-bold leading-snug"
                          style={{ color: C.inkSoft }}
                        >
                          {s.sublabel}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 地図の種類 切替(左下) */}
        <div
          role="group"
          aria-label="ちずの しゅるいを えらぶ"
          className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-full border bg-white p-1"
          style={{ borderColor: "rgba(67,57,43,.1)", boxShadow: tokens.shadow.card }}
        >
          {([
            { key: "street", label: "ちず", Icon: MapIcon },
            { key: "satellite", label: "そらから", Icon: Satellite },
          ] as const).map(({ key, label, Icon }) => {
            const active = mapStyle === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMapStyle(key)}
                aria-pressed={active}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black transition-colors ${tokens.cls.focus}`}
                style={{
                  background: active ? C.primary : "transparent",
                  color: active ? "#fff" : C.inkSoft,
                }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
                {label}
              </button>
            )
          })}
        </div>

        {/* 現在地ボタン(右下) */}
        <button
          type="button"
          onClick={handleLocate}
          aria-label="いまいる ばしょへ いどう"
          className={`absolute bottom-3 right-3 z-20 grid h-12 w-12 place-items-center rounded-full border bg-white active:translate-y-[2px] transition-transform ${tokens.cls.focus}`}
          style={{
            borderColor: "rgba(67,57,43,.1)",
            boxShadow: tokens.shadow.card,
            color: C.primary,
          }}
        >
          <LocateFixed
            className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
        </button>

        {/* 下部の小さなヒント(候補表示中は隠す) */}
        {suggestions.length === 0 && !pin && (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-2">
            <span
              className="rounded-full px-3.5 py-1.5 text-[12px] font-black text-white"
              style={{ background: "rgba(38,65,59,.72)", backdropFilter: "blur(4px)" }}
            >
              ちずを タップして ピンを おいてね
            </span>
          </div>
        )}
      </div>

      {/* 決定バー(下部・固定) */}
      <BottomBar className="-mx-3 px-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="shrink-0">
            <Mascot size="sm" mood={pin ? "cheer" : "happy"} />
          </span>
          <p
            className="flex-1 text-[13.5px] font-black leading-snug"
            style={{ color: pin ? C.primaryStrong : C.inkSoft }}
            aria-live="polite"
          >
            {pin
              ? "ピンを おいたよ！ この ばしょで いい？"
              : "けんさく か ちずタップで ばしょを えらんでね"}
          </p>
        </div>
        <PrimaryCTA onClick={handleConfirm} disabled={!pin} variant="green">
          ここにする
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}
