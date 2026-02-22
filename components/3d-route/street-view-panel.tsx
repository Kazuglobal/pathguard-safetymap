"use client"
import { useEffect, useRef, useState } from 'react'

interface Props {
  location: { lon: number; lat: number } | null
  active: boolean
}

interface StreetViewPanoramaLike {
  setPosition: (position: { lat: number; lng: number }) => void
}

interface StreetViewServiceLike {
  getPanorama: (
    request: { location: { lat: number; lng: number }; radius: number },
    callback: (data: unknown, status: string) => void
  ) => void
}

interface MapsLike {
  StreetViewService: new () => StreetViewServiceLike
  StreetViewPanorama: new (
    container: Element,
    options: {
      position: { lat: number; lng: number }
      pov: { heading: number; pitch: number }
      zoom: number
      addressControl: boolean
      showRoadLabels: boolean
    }
  ) => StreetViewPanoramaLike
  StreetViewStatus: {
    OK: string
  }
}

function getMapsApi(): MapsLike | null {
  const g = (window as Window & { google?: { maps?: MapsLike } }).google
  return g?.maps ?? null
}

const DEFAULT_LAT = 35.6585
const DEFAULT_LON = 139.7006

export default function StreetViewPanel({ location, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<StreetViewPanoramaLike | null>(null)
  const apiLoadedRef = useRef(false)
  const requestIdRef = useRef(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // ① 初期化: マウント時1回のみ (SSR不可のためdynamic importと組み合わせる)
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      try {
        const { Loader } = await import('@googlemaps/js-api-loader')
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
          version: 'weekly',
        })
        await loader.load()
        apiLoadedRef.current = true

        if (cancelled || !containerRef.current) return

        const maps = getMapsApi()
        if (!maps) throw new Error('Google Maps API not available')

        const lat = location?.lat ?? DEFAULT_LAT
        const lng = location?.lon ?? DEFAULT_LON
        const requestId = ++requestIdRef.current

        const sv = new maps.StreetViewService()
        sv.getPanorama(
          { location: { lat, lng }, radius: 50 },
          (_data: unknown, status: string) => {
            if (cancelled || requestId !== requestIdRef.current) return
            setIsLoading(false)
            if (status !== maps.StreetViewStatus.OK) {
              setHasError(true)
              return
            }
            setHasError(false)
            panoramaRef.current = new maps.StreetViewPanorama(containerRef.current!, {
              position: { lat, lng },
              pov: { heading: 0, pitch: 0 },
              zoom: 0,
              addressControl: false,
              showRoadLabels: true,
            })
          }
        )
      } catch {
        if (!cancelled) {
          setIsLoading(false)
          setHasError(true)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ② 場所変更: location変化時にパノラマを移動
  useEffect(() => {
    if (!active || !apiLoadedRef.current || !location) return

    const maps = getMapsApi()
    if (!maps) return

    const lat = location.lat
    const lng = location.lon
    const requestId = ++requestIdRef.current
    setHasError(false)
    setIsLoading(true)
    const sv = new maps.StreetViewService()
    sv.getPanorama(
      { location: { lat, lng }, radius: 50 },
      (_data: unknown, status: string) => {
        if (requestId !== requestIdRef.current) return

        setIsLoading(false)
        if (status !== maps.StreetViewStatus.OK) {
          setHasError(true)
          return
        }

        if (panoramaRef.current) {
          panoramaRef.current.setPosition({ lat, lng })
        } else if (containerRef.current) {
          // パノラマ未作成の場合 (デフォルト地点がStreetViewなしだったケース)
          panoramaRef.current = new maps.StreetViewPanorama(
            containerRef.current,
            {
              position: { lat, lng },
              pov: { heading: 0, pitch: 0 },
              zoom: 0,
              addressControl: false,
              showRoadLabels: true,
            }
          )
        }
      }
    )
  }, [active, location])

  return (
    <div className="relative w-full h-full">
      {/* パノラマコンテナ: 常にマウントしてGoogle Mapsが初期化できるようにする */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: '#1a1a2e' }}
      />

      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
          Street View を読み込み中...
        </div>
      )}

      {/* エラーオーバーレイ */}
      {!isLoading && hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-3">
          <svg
            className="w-12 h-12 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <p className="text-sm">この場所のストリートビューはありません</p>
          <p className="text-xs opacity-60">別の住所を検索してください</p>
        </div>
      )}
    </div>
  )
}
