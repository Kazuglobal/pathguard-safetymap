"use client"

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { AccidentGeoJSON } from '@/lib/traffic-accident-heatmap'
import { HEATMAP_MAX_ZOOM, CIRCLE_MIN_ZOOM, getSeverityLabel } from '@/lib/traffic-accident-heatmap'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_ID = 'accident-heatmap-source'
const HEATMAP_LAYER_ID = 'accident-heatmap-layer'
const CIRCLE_LAYER_ID = 'accident-circle-layer'

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

interface PopupDisplayData {
  severity: number | null
  severityLabel: string
  year: number | null
  type: string | null
  weather: string | null
  fatalities: number
  injuries: number
  hasChild: boolean
  hasPedestrian: boolean
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccidentHeatmapLayerProps {
  /** Mapbox map instance */
  map: mapboxgl.Map | null
  /** GeoJSON data to render */
  geoJSON: AccidentGeoJSON | null
  /** Whether the layer should be shown */
  isVisible: boolean
}

// ---------------------------------------------------------------------------
// Helpers (local, matching map-container.tsx pattern)
// ---------------------------------------------------------------------------

function layerExists(m: mapboxgl.Map, id: string): boolean {
  try { return !!m.getLayer(id) } catch { return false }
}

function sourceExists(m: mapboxgl.Map, id: string): boolean {
  try { return !!m.getSource(id) } catch { return false }
}

function safeRemoveLayer(m: mapboxgl.Map, id: string) {
  if (layerExists(m, id)) {
    try { m.removeLayer(id) } catch (e) { console.error(`Error removing layer ${id}:`, e) }
  }
}

function safeRemoveSource(m: mapboxgl.Map, id: string) {
  if (sourceExists(m, id)) {
    try { m.removeSource(id) } catch (e) { console.error(`Error removing source ${id}:`, e) }
  }
}

// ---------------------------------------------------------------------------
// Layer setup
// ---------------------------------------------------------------------------

function addSourceAndLayers(m: mapboxgl.Map) {
  // Source
  if (!sourceExists(m, SOURCE_ID)) {
    m.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON })
  }

  // Heatmap layer (low zoom)
  if (!layerExists(m, HEATMAP_LAYER_ID)) {
    m.addLayer({
      id: HEATMAP_LAYER_ID,
      type: 'heatmap',
      source: SOURCE_ID,
      maxzoom: HEATMAP_MAX_ZOOM,
      paint: {
        // Weight: fatal = 3x, injury = 1x
        'heatmap-weight': [
          'interpolate', ['linear'], ['coalesce', ['get', 'severity'], 2],
          1, 3,
          2, 1,
        ],
        // Intensity increases with zoom
        'heatmap-intensity': [
          'interpolate', ['linear'], ['zoom'],
          0, 1,
          9, 3,
        ],
        // Color gradient: transparent → blue → cyan → white → orange → red
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(33, 102, 172, 0)',
          0.2, 'rgb(103, 169, 207)',
          0.4, 'rgb(209, 229, 240)',
          0.6, 'rgb(253, 219, 199)',
          0.8, 'rgb(239, 138, 98)',
          1, 'rgb(178, 24, 43)',
        ],
        // Radius scales with zoom
        'heatmap-radius': [
          'interpolate', ['linear'], ['zoom'],
          0, 2,
          5, 8,
          9, 20,
        ],
        'heatmap-opacity': [
          'interpolate', ['linear'], ['zoom'],
          7, 0.8,
          13, 0.3,
        ],
      },
    })
  }

  // Circle layer (high zoom)
  if (!layerExists(m, CIRCLE_LAYER_ID)) {
    m.addLayer({
      id: CIRCLE_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      minzoom: CIRCLE_MIN_ZOOM,
      paint: {
        // Radius based on impact
        'circle-radius': [
          'interpolate', ['linear'],
          ['+', ['coalesce', ['get', 'fatalities'], 0], ['/', ['coalesce', ['get', 'injuries'], 0], 2]],
          0, 5,
          3, 9,
          10, 16,
        ],
        // Color by severity
        'circle-color': [
          'match', ['coalesce', ['get', 'severity'], 2],
          1, '#DC2626',
          2, '#F59E0B',
          '#9CA3AF',
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
}

function removeSourceAndLayers(m: mapboxgl.Map) {
  safeRemoveLayer(m, CIRCLE_LAYER_ID)
  safeRemoveLayer(m, HEATMAP_LAYER_ID)
  safeRemoveSource(m, SOURCE_ID)
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function parseNonNegativeNumber(value: unknown): number {
  const parsed = parseNullableNumber(value)
  if (parsed === null) return 0
  return Math.max(0, parsed)
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toPopupDisplayData(properties: Record<string, unknown>): PopupDisplayData {
  const severity = parseNullableNumber(properties.severity)
  return {
    severity,
    severityLabel: getSeverityLabel(severity),
    year: parseNullableNumber(properties.year),
    type: parseText(properties.type),
    weather: parseText(properties.weather),
    fatalities: parseNonNegativeNumber(properties.fatalities),
    injuries: parseNonNegativeNumber(properties.injuries),
    hasChild: parseBoolean(properties.hasChild),
    hasPedestrian: parseBoolean(properties.hasPedestrian),
  }
}

export function buildAccidentPopupContent(properties: Record<string, unknown>): HTMLDivElement {
  const data = toPopupDisplayData(properties)
  const severityColor = data.severity === 1 ? '#DC2626' : '#F59E0B'

  const root = document.createElement('div')
  root.style.padding = '8px'
  root.style.minWidth = '160px'

  const title = document.createElement('div')
  title.style.fontWeight = '700'
  title.style.color = severityColor
  title.style.marginBottom = '4px'
  title.style.fontSize = '14px'
  title.textContent = data.severityLabel
  root.appendChild(title)

  if (data.type) {
    const typeEl = document.createElement('p')
    typeEl.style.margin = '2px 0'
    typeEl.style.fontSize = '12px'
    typeEl.style.color = '#555'
    typeEl.textContent = data.type
    root.appendChild(typeEl)
  }

  const meta = document.createElement('p')
  meta.style.margin = '2px 0'
  meta.style.fontSize = '12px'
  const metaParts: string[] = []
  if (data.year !== null) metaParts.push(`${data.year}年`)
  if (data.weather) metaParts.push(`天候: ${data.weather}`)
  meta.textContent = metaParts.join(' / ')
  root.appendChild(meta)

  const casualties = document.createElement('p')
  casualties.style.margin = '4px 0 0'
  casualties.style.fontSize = '12px'
  casualties.style.color = '#333'
  casualties.textContent = `死亡: ${data.fatalities}人 / 負傷: ${data.injuries}人`
  root.appendChild(casualties)

  if (data.hasChild) {
    const child = document.createElement('p')
    child.style.margin = '4px 0 0'
    child.style.fontSize = '11px'
    child.style.color = '#DC2626'
    child.textContent = '24歳以下関与（年齢区分）'
    root.appendChild(child)
  }

  if (data.hasPedestrian) {
    const pedestrian = document.createElement('p')
    pedestrian.style.margin = '2px 0 0'
    pedestrian.style.fontSize = '11px'
    pedestrian.style.color = '#1D4ED8'
    pedestrian.textContent = '歩行者関与'
    root.appendChild(pedestrian)
  }

  return root
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Headless component that manages Mapbox GL heatmap and circle layers
 * for traffic accident visualization.
 *
 * - Heatmap at zoom 0–13
 * - Individual circles at zoom 13+
 * - Click popup with accident details
 * - Cursor change on hover
 * - Handles style changes (re-add layers after style.load)
 */
export function AccidentHeatmapLayer({ map, geoJSON, isVisible }: AccidentHeatmapLayerProps) {
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const layersAddedRef = useRef(false)
  const latestGeoJSONRef = useRef<AccidentGeoJSON | null>(geoJSON)

  useEffect(() => {
    latestGeoJSONRef.current = geoJSON
  }, [geoJSON])

  // -------------------------------------------------------------------------
  // Popup on circle click
  // -------------------------------------------------------------------------

  const handleCircleClick = useCallback((e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    if (!e.features || e.features.length === 0) return
    const mapInstance = e.target as mapboxgl.Map

    const feature = e.features[0]
    const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const content = buildAccidentPopupContent(props)

    // Remove previous popup
    if (popupRef.current) {
      popupRef.current.remove()
    }

    popupRef.current = new mapboxgl.Popup({ offset: 12, maxWidth: '240px' })
      .setLngLat(coords)
      .setDOMContent(content)
      .addTo(mapInstance)
  }, [])

  const handleMouseEnter = useCallback((e: mapboxgl.MapMouseEvent) => {
    (e.target as mapboxgl.Map).getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback((e: mapboxgl.MapMouseEvent) => {
    (e.target as mapboxgl.Map).getCanvas().style.cursor = ''
  }, [])

  // -------------------------------------------------------------------------
  // Add / remove layers based on visibility
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!map) return

    if (isVisible) {
      addSourceAndLayers(map)
      layersAddedRef.current = true

      // Event listeners
      map.on('click', CIRCLE_LAYER_ID, handleCircleClick as any)
      map.on('mouseenter', CIRCLE_LAYER_ID, handleMouseEnter as any)
      map.on('mouseleave', CIRCLE_LAYER_ID, handleMouseLeave as any)

      // Re-add layers after style change
      const handleStyleLoad = () => {
        if (layersAddedRef.current) {
          addSourceAndLayers(map)
          // Re-set data if we have it
          if (latestGeoJSONRef.current) {
            const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
            if (src) src.setData(latestGeoJSONRef.current as any)
          }
        }
      }
      map.on('style.load', handleStyleLoad)

      return () => {
        map.off('click', CIRCLE_LAYER_ID, handleCircleClick as any)
        map.off('mouseenter', CIRCLE_LAYER_ID, handleMouseEnter as any)
        map.off('mouseleave', CIRCLE_LAYER_ID, handleMouseLeave as any)
        map.off('style.load', handleStyleLoad)
      }
    } else {
      // Visibility off → clean up
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      removeSourceAndLayers(map)
      layersAddedRef.current = false
    }
  }, [map, isVisible, handleCircleClick, handleMouseEnter, handleMouseLeave])

  // -------------------------------------------------------------------------
  // Update GeoJSON data
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!map || !isVisible || !geoJSON) return

    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (src) {
      src.setData(geoJSON as any)
    }
  }, [map, isVisible, geoJSON])

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
    }
  }, [])

  return null
}
