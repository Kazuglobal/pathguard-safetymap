import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createDangerReportsRepo } from '@/lib/db/repos/danger-reports.repo'
import { dangerReports, reportImages } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const owner: Actor = { kind: 'user', id: 'user-1', email: null, isAdmin: false }
const otherUser: Actor = { kind: 'user', id: 'user-2', email: null, isAdmin: false }

describe('danger reports D1 repository', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  it('creates pending reports owned by the authenticated actor', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    const report = await repo.create(owner, {
      title: ' Crosswalk ',
      description: ' Needs paint ',
      dangerType: 'traffic',
      dangerLevel: 3,
      latitude: 35.68,
      longitude: 139.76,
    })
    expect(report).toMatchObject({ userId: 'user-1', title: 'Crosswalk', status: 'pending' })
  })

  it('prevents IDOR image updates', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    const report = await repo.create(owner, {
      title: 'test', dangerType: 'other', dangerLevel: 1, latitude: 35, longitude: 139,
    })
    await expect(repo.getForImageUpdate(otherUser, report.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(repo.setImages(otherUser, report.id, {
      imageKey: `danger-reports/user-2/${report.id}/forged.webp`,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('atomically reopens approved moderation when an image key changes', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    const report = await repo.create(owner, {
      title: 'test', dangerType: 'other', dangerLevel: 1, latitude: 35, longitude: 139,
    })
    await database.db.update(dangerReports).set({
      status: 'approved',
      aiModerationStatus: 'approved',
      aiModerationReason: 'automatic',
    })
    const updated = await repo.setImages(owner, report.id, {
      imageKey: `danger-reports/user-1/${report.id}/original.webp`,
    })
    expect(updated).toMatchObject({
      status: 'pending',
      aiModerationStatus: 'needs_review',
    })
    expect(updated.aiModerationReason).toContain('automatic / AI承認後に画像が追加されたため')
  })

  it('deletes the row and returns every persisted media key', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    const report = await repo.create(owner, {
      title: 'test', dangerType: 'other', dangerLevel: 1, latitude: 35, longitude: 139,
    })
    await repo.setImages(owner, report.id, {
      processedImageKeys: [`danger-reports/user-1/${report.id}/processed.webp`],
    })
    await database.db.insert(reportImages).values({
      id: 'extra', reportId: report.id, imageKey: `danger-reports/user-1/${report.id}/extra.webp`,
    })
    const result = await repo.delete(owner, report.id)
    expect(result?.imageKeys).toHaveLength(2)
    expect(database.sqlite.prepare('select id from danger_reports').all()).toEqual([])
  })
})
