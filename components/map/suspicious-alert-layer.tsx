"use client"

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { buildAlertCircleCollection } from '@/lib/suspicious-alert'
import type { DangerReport } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_ID = 'suspicious-alert-source'
const FILL_LAYER_ID = 'suspicious-alert-fill'
const LINE_LAYER_ID = 'suspicious-alert-line'

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuspiciousAlertLayerProps {
  /** Mapbox map instance */
  map: mapboxgl.Map | null
  /** DangerReport array — non-suspicious entries are filtered internally */
  reports: DangerReport[]
  /** Whether the layer should be shown */
  isVisible: boolean
  /** Focused report ID; matching circle is highlighted */
  focusedId?: string | null
}

// ---------------------------------------------------------------------------
// Helpers (matching accident-heatmap-layer.tsx pattern)
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
// Paint expression helpers
// ---------------------------------------------------------------------------

function fillOpacityExpression(focusedId: string | null | undefined): any {
  if (!focusedId) return 0.18
  return ['case', ['==', ['get', 'id'], focusedId], 0.32, 0.14]
}

function lineWidthExpression(focusedId: string | null | undefined): any {
  if (!focusedId) return 2
  return ['case', ['==', ['get', 'id'], focusedId], 3.5, 2]
}

// ---------------------------------------------------------------------------
// Layer setup
// ---------------------------------------------------------------------------

function addSourceAndLayers(m: mapboxgl.Map) {
  if (!sourceExists(m, SOURCE_ID)) {
    m.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON })
  }

  // Fill layer — semi-transparent orange area
  if (!layerExists(m, FILL_LAYER_ID)) {
    m.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': '#F97316',
        'fill-opacity': 0.18,
      },
    })
  }

  // Line layer — dashed orange boundary
  if (!layerExists(m, LINE_LAYER_ID)) {
    m.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': '#F97316',
        'line-width': 2,
        'line-dasharray': [2, 1.5],
      },
    })
  }
}

function removeSourceAndLayers(m: mapboxgl.Map) {
  safeRemoveLayer(m, LINE_LAYER_ID)
  safeRemoveLayer(m, FILL_LAYER_ID)
  safeRemoveSource(m, SOURCE_ID)
}

/**
 * Runs `cb` once the map style is fully loaded. If the style is already loaded
 * it runs synchronously; otherwise it waits for `styledata` and runs as soon as
 * `isStyleLoaded()` becomes true. Returns a canceller to detach the listener.
 *
 * This avoids "Style is not done loading" when the layer mounts with
 * isVisible=true before the initial style has finished loading.
 */
function whenStyleReady(m: mapboxgl.Map, cb: () => void): () => void {
  if (m.isStyleLoaded()) {
    cb()
    return () => {}
  }
  const handler = () => {
    if (m.isStyleLoaded()) {
      m.off('styledata', handler)
      cb()
    }
  }
  m.on('styledata', handler)
  return () => m.off('styledata', handler)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Headless component that renders suspicious-person alert areas as
 * semi-transparent orange fill circles with dashed boundaries on a Mapbox map.
 *
 * - Fill layer: orange (#F97316), opacity 0.18 (0.32 when focused)
 * - Line layer: orange dashed border, width 2 (3.5 when focused)
 * - focusedId highlights the matching circle via setPaintProperty
 * - Handles style reloads (re-adds layers after style.load)
 * - No click handling — delegated to map-container marker layer
 */
export function SuspiciousAlertLayer({
  map,
  reports,
  isVisible,
  focusedId,
}: SuspiciousAlertLayerProps): null {
  const layersAddedRef = useRef(false)
  const latestReportsRef = useRef<DangerReport[]>(reports)
  const latestFocusedIdRef = useRef<string | null | undefined>(focusedId)

  // Keep refs current
  useEffect(() => {
    latestReportsRef.current = reports
  }, [reports])

  useEffect(() => {
    latestFocusedIdRef.current = focusedId
  }, [focusedId])

  // -------------------------------------------------------------------------
  // Add / remove layers based on visibility
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!map) return

    if (isVisible) {
      // Add layers, seed data, and apply focus paint — only when the style is ready.
      const setup = () => {
        addSourceAndLayers(map)
        layersAddedRef.current = true

        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
        if (src) {
          src.setData(buildAlertCircleCollection(latestReportsRef.current) as any)
        }

        const fid = latestFocusedIdRef.current
        if (layerExists(map, FILL_LAYER_ID)) {
          map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', fillOpacityExpression(fid))
        }
        if (layerExists(map, LINE_LAYER_ID)) {
          map.setPaintProperty(LINE_LAYER_ID, 'line-width', lineWidthExpression(fid))
        }
      }

      // Initial add (deferred until the style finishes loading)
      const cancelStyleReady = whenStyleReady(map, setup)

      // Re-add layers after a style change (style switch wipes custom layers)
      const handleStyleLoad = () => {
        if (layersAddedRef.current) setup()
      }
      map.on('style.load', handleStyleLoad)

      return () => {
        cancelStyleReady()
        map.off('style.load', handleStyleLoad)
      }
    } else {
      // Visibility off — clean up
      removeSourceAndLayers(map)
      layersAddedRef.current = false
    }
  }, [map, isVisible])

  // -------------------------------------------------------------------------
  // Update GeoJSON data when reports change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!map || !isVisible) return

    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    const collection = buildAlertCircleCollection(reports)
    src.setData(collection as any)
  }, [map, isVisible, reports])

  // -------------------------------------------------------------------------
  // Update paint when focusedId changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!map || !isVisible) return

    if (layerExists(map, FILL_LAYER_ID)) {
      map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', fillOpacityExpression(focusedId))
    }
    if (layerExists(map, LINE_LAYER_ID)) {
      map.setPaintProperty(LINE_LAYER_ID, 'line-width', lineWidthExpression(focusedId))
    }
  }, [map, isVisible, focusedId])

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (map && layersAddedRef.current) {
        removeSourceAndLayers(map)
        layersAddedRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
