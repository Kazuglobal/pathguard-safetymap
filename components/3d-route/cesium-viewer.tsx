"use client"
import { useEffect, useRef } from 'react'

// 東京・渋谷駅周辺のデフォルト座標
const POC_LON = 139.7006
const POC_LAT = 35.6585
// WGS84楕円体高（東京平均地上高 ≒ 38m）+ 子ども目線 1.1m
const GROUND_ELLIPSOID_H_TOKYO = 38
const CHILD_EYE_H = GROUND_ELLIPSOID_H_TOKYO + 1.1
// 一般的な日本の地面高さ（日本全体の近似値）
const APPROX_GROUND_H_JAPAN = 40

interface Location {
  lon: number
  lat: number
}

export default function CesiumViewer({
  hourOfDay,
  location,
}: {
  hourOfDay: number
  location: Location | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null)

  // ① 初期化: マウント時1回のみ
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    let destroyed = false

    async function init() {
      // Turbopackは DefinePlugin 不可のため、import前に手動設定
      ;(window as any).CESIUM_BASE_URL = '/cesium'

      const Cesium = await import('cesium')

      // TurbopackではCSS importが動作しないため動的注入
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/cesium/Widgets/widgets.css'
      document.head.appendChild(link)

      if (destroyed || !containerRef.current) return

      Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? ''

      const viewer = new Cesium.Viewer(containerRef.current, {
        globe: false,           // Google 3D Tilesで地形を上書きするため無効化
        shadows: true,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        // PoCのためUIウィジェットは非表示
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      })
      viewerRef.current = viewer

      // Google Photorealistic 3D Tiles 読み込み
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset({
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        })
        viewer.scene.primitives.add(tileset)
      } catch (err) {
        console.error('[CesiumViewer] Google 3D Tiles 読み込み失敗:', err)
      }

      viewer.shadowMap.size = 2048
      viewer.shadowMap.softShadows = true

      // 子ども目線カメラ設定（110cm）
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(POC_LON, POC_LAT, CHILD_EYE_H),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-5), // 自然な前方視線（やや下向き）
          roll: 0,
        },
      })
    }

    init()

    return () => {
      destroyed = true
      if (viewerRef.current && viewerRef.current.isDestroyed?.() === false) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // ② 場所変更: location変化時にカメラを飛行
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed?.() || !location) return

    import('cesium').then(({ Cartesian3, Math: CesiumMath }) => {
      const targetH = APPROX_GROUND_H_JAPAN + 1.1
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(location.lon, location.lat, targetH),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-5),
          roll: 0,
        },
        duration: 1.5,
      })
    })
  }, [location])

  // ③ 時間帯変更: hourOfDay変化時のみ
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed?.()) return

    import('cesium').then(({ JulianDate }) => {
      const d = new Date()
      d.setHours(Math.floor(hourOfDay), Math.round((hourOfDay % 1) * 60), 0, 0)
      viewer.clock.currentTime = JulianDate.fromDate(d)
      viewer.clock.multiplier = 0
      viewer.clock.shouldAnimate = false
    })
  }, [hourOfDay])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  )
}
