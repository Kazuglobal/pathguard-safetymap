import mapboxgl from 'mapbox-gl'

import { overlaySafeArea, popupAnchorForPoint, popupPanOffset, type VerticalBox } from '@/lib/map/popup-placement'

/** 地図データの丸（多発地点・事故ヒートマップ）。ここをタップしたときは吹き出しを出すので、地図全体のクリック処理を動かさない。 */
export const MAP_DATA_POINT_LAYER_IDS = ['accident-hotspot-circle', 'accident-circle-layer'] as const

/** タップした位置に地図データの丸があるか（存在しないレイヤーは調べない）。 */
export function hitsMapDataPoint(map: mapboxgl.Map, point: mapboxgl.Point): boolean {
  const layers = MAP_DATA_POINT_LAYER_IDS.filter((id) => {
    try { return Boolean(map.getLayer(id)) } catch { return false }
  })
  if (layers.length === 0) return false
  try {
    return map.queryRenderedFeatures(point, { layers: [...layers] }).length > 0
  } catch {
    return false
  }
}

function verticalBox(element: Element): VerticalBox {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, bottom: rect.bottom }
}

/**
 * 吹き出しを、上の検索欄・ボタン列や下の報告ボタン（data-map-overlay）の下に潜らせずに開く。
 * 点が上半分なら下向き、下半分なら上向きに開き、それでも重なる分だけ地図をずらす。
 */
export function showPopupInView(
  map: mapboxgl.Map,
  lngLat: [number, number],
  content: HTMLElement,
  options: { maxWidth?: string; offset?: number } = {},
): mapboxgl.Popup {
  const container = map.getContainer()
  const point = map.project(lngLat)
  const popup = new mapboxgl.Popup({
    offset: options.offset ?? 12,
    // スマホでも画面からはみ出さない幅にする
    maxWidth: options.maxWidth ?? 'min(280px, calc(100vw - 32px))',
    anchor: popupAnchorForPoint(point.y, container.clientHeight),
  })
    .setLngLat(lngLat)
    .setDOMContent(content)
    .addTo(map)

  requestAnimationFrame(() => {
    const element = popup.getElement()
    if (!element || !popup.isOpen()) return
    const mapBox = verticalBox(container)
    const safe = overlaySafeArea(mapBox, {
      top: [...document.querySelectorAll('[data-map-overlay="top"]')].map(verticalBox),
      bottom: [...document.querySelectorAll('[data-map-overlay="bottom"]')].map(verticalBox),
    })
    const dy = popupPanOffset(verticalBox(element), mapBox, safe)
    if (dy !== 0) map.panBy([0, dy], { duration: 300 })
  })

  return popup
}
