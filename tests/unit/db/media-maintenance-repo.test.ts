import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createMediaMaintenanceRepo } from '@/lib/db/repos/media-maintenance.repo'
import { dangerReports, hazardDetections, hunterPhotos, reportImages } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const service: Actor = { kind: 'service' }

describe('media maintenance D1 repository', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  it('finds references across scalar, JSON-array, and report image keys', async () => {
    await database.db.insert(dangerReports).values({
      id: 'report-1',
      userId: 'user-1',
      title: 'test',
      dangerType: 'other',
      dangerLevel: 1,
      latitude: 35,
      longitude: 139,
      imageKey: 'danger-reports/user-1/report-1/original.webp',
      processedImageKeys: ['danger-reports/user-1/report-1/processed.webp'],
    })
    await database.db.insert(reportImages).values({
      id: 'image-1',
      reportId: 'report-1',
      imageKey: 'danger-reports/user-1/report-1/extra.webp',
    })

    const repo = createMediaMaintenanceRepo(database.db as unknown as AppDb)
    const referenced = await repo.findReferencedKeys(service, [
      'danger-reports/user-1/report-1/original.webp',
      'danger-reports/user-1/report-1/processed.webp',
      'danger-reports/user-1/report-1/extra.webp',
      'danger-reports/user-1/report-1/orphan.webp',
    ])

    expect([...referenced].sort()).toEqual([
      'danger-reports/user-1/report-1/extra.webp',
      'danger-reports/user-1/report-1/original.webp',
      'danger-reports/user-1/report-1/processed.webp',
    ])
  })

  it('deletes expired hunter rows with their dependent detections', async () => {
    await database.db.insert(hunterPhotos).values([
      { id: 'expired', playerId: 'user-1', imageKey: 'hunter-photos/user-1/expired/photo.webp', retentionUntil: '2026-01-01T00:00:00.000Z' },
      { id: 'active', playerId: 'user-1', imageKey: 'hunter-photos/user-1/active/photo.webp', retentionUntil: '2027-01-01T00:00:00.000Z' },
    ])
    await database.db.insert(hazardDetections).values({ id: 'detection-1', photoId: 'expired' })

    const repo = createMediaMaintenanceRepo(database.db as unknown as AppDb)
    const expired = await repo.listExpiredHunterRows(service, new Date('2026-08-23T00:00:00.000Z'))
    expect(expired).toEqual([{ id: 'expired', imageKey: 'hunter-photos/user-1/expired/photo.webp' }])
    await repo.deleteHunterRows(service, expired.map((row) => row.id))

    expect(database.sqlite.prepare('select id from hunter_photos order by id').all()).toEqual([{ id: 'active' }])
    expect(database.sqlite.prepare('select id from hazard_detections').all()).toEqual([])
  })

  it('does not expose maintenance deletes to user actors', async () => {
    const repo = createMediaMaintenanceRepo(database.db as unknown as AppDb)
    await expect(repo.listExpiredHunterRows({ kind: 'user', id: 'user-1', email: null, isAdmin: false }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
