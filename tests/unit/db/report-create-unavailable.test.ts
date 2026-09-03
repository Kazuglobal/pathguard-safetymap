import { describe, expect, it, vi } from 'vitest'
import { createDangerReport } from '@/lib/db/repos/danger-reports.repo'
import { ReportCreateUnavailableError } from '@/lib/db/report-create-errors'

vi.mock('@/lib/db/client', () => ({ getDb: () => { throw new Error('D1 binding unavailable') } }))

describe('report creation without a D1 binding', () => {
  it('maps binding initialization failure to the 503 error type', () => {
    expect(() => createDangerReport(
      { kind: 'user', id: 'owner', email: null, isAdmin: false },
      { title: 'Crosswalk', dangerType: 'traffic', dangerLevel: 3, latitude: 35, longitude: 139 },
    )).toThrow(ReportCreateUnavailableError)
  })
})
