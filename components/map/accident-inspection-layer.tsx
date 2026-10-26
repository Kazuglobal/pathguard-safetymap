"use client"

import { useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import { circle, featureCollection, point } from '@turf/turf'

const SOURCE = 'accident-inspection-scope'
const LAYERS = ['accident-inspection-fill', 'accident-inspection-border', 'accident-inspection-center']

/** APIに要求した中心を表示する。GPSの青点や移動後の地図中心とは別の集計範囲。 */
export function AccidentInspectionLayer({ map, center }: { map: mapboxgl.Map | null; center: [number, number] | null }) {
  useEffect(() => {
    if (!map || !center) return
    const data = featureCollection<GeoJSON.Polygon | GeoJSON.Point>([
      circle(center, 0.3, { steps: 128, units: 'kilometers', properties: { kind: 'range' } }),
      point(center, { kind: 'center' }),
    ])
    const sync = () => {
      if (!map.isStyleLoaded()) return
      if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data })
      if (!map.getLayer(LAYERS[0])) map.addLayer({ id: LAYERS[0], type: 'fill', source: SOURCE, filter: ['==', ['get', 'kind'], 'range'], paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.07 } })
      if (!map.getLayer(LAYERS[1])) map.addLayer({ id: LAYERS[1], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'range'], paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] } })
      if (!map.getLayer(LAYERS[2])) map.addLayer({ id: LAYERS[2], type: 'circle', source: SOURCE, filter: ['==', ['get', 'kind'], 'center'], paint: { 'circle-color': '#2563eb', 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } })
    }
    if (map.isStyleLoaded()) sync()
    map.on('style.load', sync)
    map.on('idle', sync)
    return () => {
      map.off('style.load', sync)
      map.off('idle', sync)
      for (const layer of LAYERS.slice().reverse()) if (map.getLayer(layer)) map.removeLayer(layer)
      if (map.getSource(SOURCE)) map.removeSource(SOURCE)
    }
  }, [map, center])
  return null
}
