'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchAccidentFeatures, type AccidentGeoJSON, type AccidentHeatmapFilters } from '@/lib/traffic-accident-heatmap'
import { arAccidentBounds, shouldRefreshARPoint, AR_ACCIDENT_FETCH_MOVE_M,
  AR_HAZARD_FETCH_MOVE_M, AR_HAZARD_FETCH_INTERVAL_MS, type ARPoint } from '@/lib/ar-risk-data'
import type { HazardPointResult } from '@/lib/hazard-point'

export function useARRiskData({ enabled, point, distance, filters }: {
  enabled: boolean; point: ARPoint | null; distance: number; filters: AccidentHeatmapFilters
}) {
  const [accidents, setAccidents] = useState<AccidentGeoJSON | null>(null)
  const [accidentError, setAccidentError] = useState<string | null>(null)
  const [hazards, setHazards] = useState<HazardPointResult | null>(null)
  const [hazardError, setHazardError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const active = enabled && visible
  const lastAccident = useRef<{ point: ARPoint; key: string } | null>(null)
  const lastHazard = useRef<{ point: ARPoint; time: number } | null>(null)
  const accidentRequest = useRef<AbortController | null>(null)
  const hazardRequest = useRef<AbortController | null>(null)
  const stableVerdict = useRef<{ key: string; hits: number } | null>(null)
  const key = JSON.stringify({ filters, distance })
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latitude = point?.lat
  const longitude = point?.lon

  useEffect(() => {
    if (!active || latitude === undefined || longitude === undefined) return
    const center = { lat: latitude, lon: longitude }
    if (lastAccident.current?.key === key && !shouldRefreshARPoint(lastAccident.current.point, center, AR_ACCIDENT_FETCH_MOVE_M)) return
    accidentRequest.current?.abort()
    const controller = new AbortController()
    accidentRequest.current = controller
    lastAccident.current = { point: center, key }
    setAccidentError(null)
    setAccidents(null)
    void fetchAccidentFeatures(arAccidentBounds(center, distance), filters, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setAccidents(data) })
      .catch(() => { if (!controller.signal.aborted) setAccidentError('事故データを取得できません。0件という意味ではありません。') })
    // A sensor update inside the fetched area must not cancel/restart the request.
    // filters are included in the stable key above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, latitude, longitude, key, revision])

  useEffect(() => {
    if (!active || latitude === undefined || longitude === undefined) return
    const center = { lat: latitude, lon: longitude }
    const previous = lastHazard.current
    if (previous && !shouldRefreshARPoint(previous.point, center, AR_HAZARD_FETCH_MOVE_M)) return
    // Hide the old location's water immediately, even while throttling the next lookup.
    setHazards(null)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    hazardRequest.current?.abort()
    const wait = previous ? AR_HAZARD_FETCH_INTERVAL_MS - (Date.now() - previous.time) : 0
    if (wait > 0) {
      stableVerdict.current = null
      confirmTimer.current = setTimeout(() => {
        lastHazard.current = null
        setRevision(value => value + 1)
      }, wait)
      return
    }
    const controller = new AbortController()
    hazardRequest.current = controller
    lastHazard.current = { point: center, time: Date.now() }
    setHazardError(null)
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })
    void fetch(`/api/hazard/point-risks?${query}`, { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('lookup failed')
        const data = await response.json() as HazardPointResult
        if (controller.signal.aborted) return
        if (!data?.hazards?.flood || !data?.hazards?.tsunami) throw new Error('invalid lookup')
        const signature = JSON.stringify(['flood', 'tsunami'].map(type => {
          const risk = data.hazards[type as 'flood' | 'tsunami']
          return [risk.kind, risk.zone?.zoneId]
        }))
        const candidate = stableVerdict.current
        const hits = candidate?.key === signature ? candidate.hits + 1 : 1
        stableVerdict.current = { key: signature, hits }
        // First result can be shown as text; changed boundaries require a second
        // independent position verdict before an animation can be started.
        setHazards({ ...data, hazards: Object.fromEntries(Object.entries(data.hazards).map(([type, risk]) => [type,
          risk.kind === 'inside' && hits < 2 ? { ...risk, confirmed: false } : { ...risk, confirmed: true },
        ])) as HazardPointResult['hazards'] })
        if (confirmTimer.current) clearTimeout(confirmTimer.current)
        if (hits < 2 && Object.values(data.hazards).some(risk => risk.kind === 'inside')) {
          confirmTimer.current = setTimeout(() => {
            lastHazard.current = null
            setRevision(value => value + 1)
          }, AR_HAZARD_FETCH_INTERVAL_MS)
        }
      })
      .catch(() => { if (!controller.signal.aborted) { setHazards(null); setHazardError('浸水想定を確認できません。時間をおいて再試行してください。') } })
  }, [active, latitude, longitude, revision])

  useEffect(() => {
    if (active) return
    accidentRequest.current?.abort()
    hazardRequest.current?.abort()
    lastAccident.current = null
    lastHazard.current = null
    stableVerdict.current = null
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setHazards(null)
    setAccidents(null)
  }, [active])
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => () => {
    accidentRequest.current?.abort(); hazardRequest.current?.abort()
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    lastAccident.current = null; lastHazard.current = null
  }, [])

  return { accidents, accidentError, hazards, hazardError, retry: () => {
    lastAccident.current = null; lastHazard.current = null; setRevision(value => value + 1)
  } }
}
