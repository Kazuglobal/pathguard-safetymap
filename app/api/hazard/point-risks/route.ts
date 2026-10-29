import { NextRequest, NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { queryHazardGateD1 } from '@/lib/hazard-zone-gate'
import { coverageAtPoint } from '@/lib/db/repos/hazard.repo'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { hazardSourceMetadata, type HazardPointRisk, type HazardPointResult } from '@/lib/hazard-point'
import type { HazardType } from '@/lib/types'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const lat = params.get('latitude')
  const lng = params.get('longitude')
  const latitude = lat?.trim() ? Number(lat) : NaN
  const longitude = lng?.trim() ? Number(lng) : NaN
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: '有効な緯度・経度が必要です' }, { status: 400 })
  }
  try {
    const rate = await checkApiRateLimit(`hazard-point:${actor.kind === 'user' ? actor.id : 'service'}`)
    if (!rate.success) return rateLimitedResponse(rate.reset)
    const point = { latitude, longitude }
    const lookup = async (type: HazardType): Promise<HazardPointRisk> => {
      const verdict = await queryHazardGateD1(actor, point, type, { toleranceMeters: 0 })
      if (verdict.kind === 'unavailable') return { kind: 'unavailable', sources: [] }
      try {
        const coverage = await coverageAtPoint(actor, { ...point, hazardType: type })
        const layers = new Set(coverage.map(row => row.sourceLayer))
        if (verdict.kind === 'inside') layers.add(verdict.zone.sourceLayer)
        const sources = [...layers].map(layer => ({ ...hazardSourceMetadata(layer),
          importedAt: coverage.find(row => row.sourceLayer === layer)?.importedAt ?? null }))
        return { kind: verdict.kind, ...(verdict.kind === 'inside' ? { zone: verdict.zone } : {}), sources }
      } catch {
        return { kind: 'unavailable', sources: [] }
      }
    }
    const [flood, tsunami] = await Promise.all([lookup('flood'), lookup('tsunami')])
    const result: HazardPointResult = { point, hazards: { flood, tsunami } }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '浸水想定を確認できません' }, { status: 503 })
  }
}
