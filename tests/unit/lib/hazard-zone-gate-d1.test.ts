import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  zonesAtPoint: vi.fn(),
  hasCoverageAtPoint: vi.fn(),
  logGateVerdict: vi.fn(),
}))

vi.mock('@/lib/db/repos/hazard.repo', () => ({
  zonesAtPoint: mocks.zonesAtPoint,
  hasCoverageAtPoint: mocks.hasCoverageAtPoint,
  logGateVerdict: mocks.logGateVerdict,
}))

import { queryAndLogHazardGateD1 } from '@/lib/hazard-zone-gate'

const actor = { kind: 'user' as const, id: 'user-1', email: null, isAdmin: false }
const serviceActor = { kind: 'service' as const }

describe('D1 hazard gate adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasCoverageAtPoint.mockResolvedValue(true)
    mocks.logGateVerdict.mockResolvedValue(undefined)
  })

  it('combines zone and coverage repositories and writes a service audit row', async () => {
    mocks.zonesAtPoint.mockResolvedValue([{
      id: 'zone-1',
      hazard_type: 'flood',
      source_layer: 'mlit',
      risk_level: 4,
      depth_min_m: 1,
      depth_max_m: 2,
      area_context: 'riverside',
    }])

    const verdict = await queryAndLogHazardGateD1(actor, serviceActor, {
      route: 'generate-image',
      mode: 'enforce',
      situation: 'flood',
      point: { longitude: 139, latitude: 35 },
      userId: 'user-1',
      hazardType: 'flood',
      toleranceMeters: 30,
    })

    expect(verdict).toMatchObject({ kind: 'inside', zone: { zoneId: 'zone-1' } })
    expect(mocks.zonesAtPoint).toHaveBeenCalledWith(actor, expect.objectContaining({
      longitude: 139,
      latitude: 35,
      hazardType: 'flood',
      toleranceMeters: 30,
    }))
    expect(mocks.logGateVerdict).toHaveBeenCalledWith(serviceActor, expect.objectContaining({
      verdict: 'inside',
      zoneId: 'zone-1',
      userId: 'user-1',
    }))
  })
})
