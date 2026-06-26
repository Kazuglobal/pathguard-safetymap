"use client"

import { useCallback, useMemo, useState } from "react"
import Map, { Marker } from "react-map-gl/mapbox"
import type { MapMouseEvent } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"

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

export function LocationPinPicker({
  onConfirm,
  initial,
}: LocationPinPickerProps) {
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

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
      <div className="flex h-72 w-full items-center justify-center rounded-3xl border-2 border-dashed border-[#0d66c4]/30 bg-sky-50 p-6 text-center">
        <p className="text-base font-bold text-[#0d66c4]">
          地図を読み込めませんでした
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border-4 border-[#0d66c4] bg-white shadow-lg">
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
              <span
                role="img"
                aria-label="えらんだ ばしょの ピン"
                className="block text-4xl drop-shadow-md"
              >
                📍
              </span>
            </Marker>
          )}
        </Map>

        {/* 子ども向け説明オーバーレイ */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-[92%] -translate-x-1/2">
          <div className="rounded-2xl bg-[#f97316] px-4 py-2 text-center text-sm font-bold leading-relaxed text-white shadow-md sm:text-base">
            どこでとった写真かな?
            <br />
            地図をタップして ピンを おいてね
          </div>
        </div>
      </div>

      {/* 決定ボタン */}
      <div className="flex flex-col items-center gap-2 bg-sky-50 px-4 py-4">
        {pin && (
          <p className="text-xs font-medium text-[#0d66c4]">
            ピンを おいたよ! いいばしょかな?
          </p>
        )}
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!pin}
          size="lg"
          className="w-full max-w-xs rounded-full bg-[#0d66c4] text-base font-bold text-white hover:bg-[#0b569f] disabled:opacity-50"
          aria-label="えらんだ ばしょに きめる"
        >
          ここにする
        </Button>
      </div>
    </div>
  )
}
