"use client"

import { useCallback, useMemo, useState } from "react"
import Map, { Marker } from "react-map-gl/mapbox"
import type { MapMouseEvent } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { motion, useReducedMotion } from "framer-motion"
import { MapPin } from "lucide-react"

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

const C = tokens.color

export function LocationPinPicker({
  onConfirm,
  initial,
}: LocationPinPickerProps) {
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const reduce = useReducedMotion()

  const initialViewState = useMemo(
    () => ({
      latitude: initial?.latitude ?? DEFAULT_CENTER.latitude,
      longitude: initial?.longitude ?? DEFAULT_CENTER.longitude,
      zoom: DEFAULT_ZOOM,
    }),
    [initial?.latitude, initial?.longitude]
  )

  const [pin, setPin] = useState<Pin | null>(() =>
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : null
  )

  // 地図をタップ/クリックした地点にピンを置く
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    setPin({
      latitude: event.lngLat.lat,
      longitude: event.lngLat.lng,
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (!pin) return
    onConfirm({ latitude: pin.latitude, longitude: pin.longitude })
  }, [pin, onConfirm])

  // トークンが無い場合は地図を出さずフォールバック表示（throwしない）
  if (!mapToken) {
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed bg-[#FFF8EF] p-6 text-center"
        style={{
          minHeight: 288,
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

  // ピンを置いた地点を文字列キーにして、置くたびに「ポンっ」と出るようにする
  const pinKey = pin ? `${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}` : ""

  return (
    <div
      className="relative w-full overflow-hidden rounded-[24px] bg-white"
      style={{
        boxShadow: `0 0 0 4px ${C.primary}, ${tokens.shadow.soft}, ${tokens.shadow.card}`,
      }}
    >
      {/* 地図エリア */}
      <div className="relative h-72 w-full sm:h-80">
        <Map
          mapboxAccessToken={mapToken}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          initialViewState={initialViewState}
          onClick={handleMapClick}
          cursor="crosshair"
          attributionControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {pin && (
            <Marker
              latitude={pin.latitude}
              longitude={pin.longitude}
              anchor="bottom"
            >
              <motion.div
                key={pinKey}
                role="img"
                aria-label="えらんだ ばしょの ピン"
                className="relative flex flex-col items-center"
                initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { scale: [0, 1.15, 1], opacity: 1 }
                }
                transition={
                  reduce ? { duration: 0.2 } : { ...tokens.spring }
                }
              >
                {/* やわらかいパルスリング（reduced 時は出さない） */}
                {!reduce && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: C.primary }}
                    initial={{ scale: 0.6, opacity: 0.45 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                {/* 丸く大きい親しみやすいマーカー */}
                <span
                  className="relative grid h-12 w-12 place-items-center rounded-full text-white"
                  style={{
                    background: tokens.gradient.sky,
                    boxShadow: `0 0 0 4px #fff, ${tokens.shadow.card}`,
                  }}
                >
                  <MapPin className="h-6 w-6" aria-hidden="true" strokeWidth={2.5} />
                </span>
                {/* 下向きのしっぽ（ピン先） */}
                <span
                  aria-hidden="true"
                  className="-mt-1 h-0 w-0"
                  style={{
                    borderLeft: "7px solid transparent",
                    borderRight: "7px solid transparent",
                    borderTop: `10px solid ${C.primaryStrong}`,
                  }}
                />
              </motion.div>
            </Marker>
          )}
        </Map>

        {/* 子ども向け説明オーバーレイ */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-[92%] -translate-x-1/2">
          <div
            className="flex items-center gap-2 rounded-[20px] bg-white/95 px-3 py-2 text-left"
            style={{ boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}` }}
          >
            <span className="shrink-0">
              <Mascot size="sm" mood={pin ? "cheer" : "happy"} />
            </span>
            <p
              className="text-[15px] font-extrabold leading-snug"
              style={{ color: C.ink }}
            >
              {pin ? (
                <>
                  ここで いいかな？
                  <br />
                  <span className="font-bold" style={{ color: C.inkSoft }}>
                    べつの ところも タップできるよ
                  </span>
                </>
              ) : (
                <>
                  どこで とった{" "}
                  <ruby>
                    写真<rt>しゃしん</rt>
                  </ruby>
                  かな？
                  <br />
                  <ruby>
                    地図<rt>ちず</rt>
                  </ruby>
                  を タップして ピンを おいてね
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 決定ボタン */}
      <div
        className="flex flex-col items-center gap-2.5 px-4 py-4"
        style={{ background: C.surfaceWarm }}
      >
        <p
          className="text-[14px] font-bold"
          style={{ color: pin ? C.success : C.inkSoft }}
        >
          {pin ? "ピンを おいたよ！ いいばしょかな？" : "ちずを タップしてね"}
        </p>
        <PrimaryCTA
          onClick={handleConfirm}
          disabled={!pin}
          className={tokens.cls.ctaBlue}
        >
          ここにする
        </PrimaryCTA>
      </div>
    </div>
  )
}
