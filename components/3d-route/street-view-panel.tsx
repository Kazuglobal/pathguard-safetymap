"use client"
import { useEffect, useRef, useState } from 'react'

interface Props {
  location: { lon: number; lat: number } | null
}

const DEFAULT_LAT = 35.6585
const DEFAULT_LON = 139.7006

export default function StreetViewPanel({ location }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panoramaRef = useRef<any>(null)
  const apiLoadedRef = useRef(false)
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

        const lat = location?.lat ?? DEFAULT_LAT
        const lng = location?.lon ?? DEFAULT_LON

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sv = new (window as any).google.maps.StreetViewService()
        sv.getPanorama(
          { location: { lat, lng }, radius: 50 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data: any, status: any) => {
            if (cancelled) return
            setIsLoading(false)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const OK = (window as any).google.maps.StreetViewStatus.OK
            if (status !== OK) {
              setHasError(true)
              return
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            panoramaRef.current = new (window as any).google.maps.StreetViewPanorama(
              containerRef.current!,
              {
                position: { lat, lng },
                pov: { heading: 0, pitch: 0 },
                zoom: 0,
                addressControl: false,
                showRoadLabels: true,
              }
            )
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
    if (!apiLoadedRef.current || !location) return

    const lat = location.lat
    const lng = location.lon
    setHasError(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google
    if (!google?.maps) return

    const sv = new google.maps.StreetViewService()
    sv.getPanorama(
      { location: { lat, lng }, radius: 50 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any, status: any) => {
        if (status !== google.maps.StreetViewStatus.OK) {
          setHasError(true)
          return
        }
        if (panoramaRef.current) {
          panoramaRef.current.setPosition({ lat, lng })
        } else if (containerRef.current) {
          // パノラマ未作成の場合 (デフォルト地点がStreetViewなしだったケース)
          panoramaRef.current = new google.maps.StreetViewPanorama(
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
  }, [location])

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
