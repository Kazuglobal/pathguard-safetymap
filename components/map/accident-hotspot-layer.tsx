"use client"

import { useCallback, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

import { useAccidentHotspots } from '@/hooks/use-accident-hotspots'
import { useEventCallback } from '@/hooks/use-event-callback'
import { tankenTokens } from '@/lib/design/tanken'
import { HOTSPOT_ATTRIBUTION } from '@/lib/traffic-accident/hotspot-config'
import {
  hotspotBreakdown,
  hotspotHeadline,
  hotspotPeakHourLabel,
  hotspotsToGeoJSON,
  hotspotYearSeries,
} from '@/lib/traffic-accident/hotspot-presentation'
import { dominantAccidentClass, type AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'

const SOURCE_ID = 'accident-hotspot-source'
const CIRCLE_LAYER_ID = 'accident-hotspot-circle'
const LABEL_LAYER_ID = 'accident-hotspot-label'

interface AccidentHotspotLayerProps {
  map: mapboxgl.Map | null
  isVisible: boolean
}

function layerExists(m: mapboxgl.Map, id: string): boolean {
  try { return !!m.getLayer(id) } catch { return false }
}

function sourceExists(m: mapboxgl.Map, id: string): boolean {
  try { return !!m.getSource(id) } catch { return false }
}

function addSourceAndLayers(m: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  if (!sourceExists(m, SOURCE_ID)) m.addSource(SOURCE_ID, { type: 'geojson', data })
  if (!layerExists(m, CIRCLE_LAYER_ID)) {
    m.addLayer({
      id: CIRCLE_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': ['get', 'color'],
        // 件数が多いほど大きく、寄るほど大きく
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          8, ['interpolate', ['linear'], ['get', 'accidentCount'], 5, 3, 20, 6, 60, 9],
          14, ['interpolate', ['linear'], ['get', 'accidentCount'], 5, 9, 20, 15, 60, 22],
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
  if (!layerExists(m, LABEL_LAYER_ID)) {
    m.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 13,
      layout: {
        'text-field': ['to-string', ['get', 'accidentCount']],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    })
  }
}

function removeSourceAndLayers(m: mapboxgl.Map) {
  for (const id of [LABEL_LAYER_ID, CIRCLE_LAYER_ID]) {
    if (layerExists(m, id)) {
      try { m.removeLayer(id) } catch (error) { console.error(`Error removing layer ${id}:`, error) }
    }
  }
  if (sourceExists(m, SOURCE_ID)) {
    try { m.removeSource(SOURCE_ID) } catch (error) { console.error(`Error removing source ${SOURCE_ID}:`, error) }
  }
}

function line(text: string, style: Partial<CSSStyleDeclaration> = {}): HTMLParagraphElement {
  const element = document.createElement('p')
  element.style.margin = '2px 0'
  element.style.fontSize = '12px'
  element.style.color = tankenTokens.color.ink
  Object.assign(element.style, style)
  element.textContent = text
  return element
}

/** 多発地点のポップアップ（textContent のみで組み立て、HTML を差し込まない）。 */
export function buildHotspotPopupContent(spot: AccidentHotspotSummary): HTMLDivElement {
  const root = document.createElement('div')
  root.style.padding = '8px'
  root.style.minWidth = '200px'

  root.appendChild(line(`事故多発地点（全国${spot.nationalRank}位）`, {
    fontWeight: '700', fontSize: '14px', color: tankenTokens.color.danger, marginBottom: '4px',
  }))
  root.appendChild(line(hotspotHeadline(spot), { fontWeight: '600' }))
  const breakdown = hotspotBreakdown(spot)
  if (breakdown) root.appendChild(line(breakdown))
  const main = dominantAccidentClass(spot.byClass)
  if (main) root.appendChild(line(`多い事故: ${main}`))
  const peak = hotspotPeakHourLabel(spot.peakHour)
  if (peak) root.appendChild(line(`多い時間帯: ${peak}`))

  const series = hotspotYearSeries(spot)
  const max = Math.max(1, ...series.map((item) => item.count))
  const chart = document.createElement('div')
  chart.setAttribute('aria-label', `年ごとの件数: ${series.map((item) => `${item.year}年${item.count}件`).join('、')}`)
  chart.style.marginTop = '6px'
  for (const item of series) {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '4px'
    row.style.fontSize = '11px'
    row.style.color = tankenTokens.color.inkSoft
    const label = document.createElement('span')
    label.style.width = '36px'
    label.textContent = String(item.year)
    const bar = document.createElement('span')
    bar.style.display = 'inline-block'
    bar.style.height = '6px'
    bar.style.borderRadius = '3px'
    bar.style.background = tankenTokens.color.accent
    bar.style.width = `${Math.round((item.count / max) * 90)}px`
    const value = document.createElement('span')
    value.textContent = `${item.count}件`
    row.append(label, bar, value)
    chart.appendChild(row)
  }
  root.appendChild(chart)

  root.appendChild(line(HOTSPOT_ATTRIBUTION, { fontSize: '10px', color: tankenTokens.color.inkFaint, marginTop: '6px' }))
  return root
}

/** 事故多発地点の Mapbox レイヤー（表示範囲の取得・ポップアップ・スタイル変更時の再追加を含む）。 */
export function AccidentHotspotLayer({ map, isVisible }: AccidentHotspotLayerProps) {
  const { hotspots, error, fetchForViewport, clear } = useAccidentHotspots()
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const geoJSON = hotspotsToGeoJSON(hotspots)

  // Mapbox に一度だけ登録するハンドラで最新の hotspots を読むため useEventCallback を使う（同期 ref を新設しない）
  const handleClick = useEventCallback((event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    const id = Number(event.features?.[0]?.properties?.id)
    const spot = hotspots.find((item) => item.id === id)
    if (!spot) return
    popupRef.current?.remove()
    popupRef.current = new mapboxgl.Popup({ offset: 12, maxWidth: '260px' })
      .setLngLat([spot.longitude, spot.latitude])
      .setDOMContent(buildHotspotPopupContent(spot))
      .addTo(event.target as mapboxgl.Map)
  })

  const handleStyleLoad = useEventCallback(() => {
    if (map) addSourceAndLayers(map, geoJSON)
  })

  const handleMoveEnd = useCallback(() => {
    const bounds = map?.getBounds()
    if (!bounds) return
    fetchForViewport({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth(),
    })
  }, [map, fetchForViewport])

  const setPointer = useCallback((event: mapboxgl.MapMouseEvent) => {
    (event.target as mapboxgl.Map).getCanvas().style.cursor = 'pointer'
  }, [])
  const resetPointer = useCallback((event: mapboxgl.MapMouseEvent) => {
    (event.target as mapboxgl.Map).getCanvas().style.cursor = ''
  }, [])

  useEffect(() => {
    if (!map) return
    if (!isVisible) {
      popupRef.current?.remove()
      popupRef.current = null
      removeSourceAndLayers(map)
      clear()
      return
    }
    addSourceAndLayers(map, hotspotsToGeoJSON([]))
    map.on('click', CIRCLE_LAYER_ID, handleClick)
    map.on('mouseenter', CIRCLE_LAYER_ID, setPointer)
    map.on('mouseleave', CIRCLE_LAYER_ID, resetPointer)
    map.on('style.load', handleStyleLoad)
    map.on('moveend', handleMoveEnd)
    handleMoveEnd()
    return () => {
      map.off('click', CIRCLE_LAYER_ID, handleClick)
      map.off('mouseenter', CIRCLE_LAYER_ID, setPointer)
      map.off('mouseleave', CIRCLE_LAYER_ID, resetPointer)
      map.off('style.load', handleStyleLoad)
      map.off('moveend', handleMoveEnd)
    }
  }, [map, isVisible, handleClick, handleStyleLoad, handleMoveEnd, setPointer, resetPointer, clear])

  useEffect(() => {
    if (!map || !isVisible) return
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    source?.setData(hotspotsToGeoJSON(hotspots))
  }, [map, isVisible, hotspots])

  useEffect(() => () => {
    popupRef.current?.remove()
    popupRef.current = null
  }, [])

  if (!isVisible || !error) return null
  return (
    <div
      role="status"
      className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs shadow"
      style={{ color: tankenTokens.color.danger }}
    >
      {error}
    </div>
  )
}
