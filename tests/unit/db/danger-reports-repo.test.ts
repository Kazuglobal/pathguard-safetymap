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

  it('includes legacy reports without a prefecture only inside the requested map bounds', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    for (const row of [
      { id: 'chiba', prefecture: '千葉県', latitude: 35.92 },
      { id: 'legacy-null', prefecture: null, latitude: 35.92 },
      { id: 'legacy-empty', prefecture: '', latitude: 35.92 },
      { id: 'outside', prefecture: null, latitude: 34 },
      { id: 'other-prefecture', prefecture: '東京都', latitude: 35.92 },
      { id: 'private', prefecture: null, latitude: 35.92, status: 'pending' },
    ]) {
      await database.db.insert(dangerReports).values({
        userId: owner.id, title: row.id, dangerType: 'traffic', dangerLevel: 3,
        longitude: 139.96, status: 'approved', ...row,
      })
    }
    const anon: Actor = { kind: 'anon' }
    const reports = await repo.list(anon, {
      prefecture: '千葉県',
      bounds: { minLng: 139.8, minLat: 35.8, maxLng: 140.2, maxLat: 36.2 },
    })
    expect(reports.map((report) => report.id).sort()).toEqual(['chiba', 'legacy-empty', 'legacy-null'])
    const prefectureOnly = await repo.list(anon, { prefecture: '千葉県' })
    expect(prefectureOnly.map((report) => report.id)).toEqual(['chiba'])
  })

  it('ほかの人の絞り込みは、見せるのと同じ粗さで行う(範囲を狭めて丸める前の場所・時刻を割り出せない)', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    await database.db.insert(dangerReports).values({
      id: 'exact', userId: owner.id, title: '交差点', dangerType: 'traffic', dangerLevel: 3,
      latitude: 35.689634, longitude: 139.691706, status: 'approved', createdAt: '2026-10-29T07:41:12.345Z',
    })
    const admin: Actor = { kind: 'user', id: 'admin-1', email: null, isAdmin: true }
    const ids = async (actor: Actor, input: Parameters<typeof repo.list>[1]) => (await repo.list(actor, input)).map((report) => report.id)
    // 元の座標だけを囲む小さな範囲(丸めた 35.690 / 139.692 は外)
    const tinyBounds = { minLng: 139.6917, minLat: 35.6896, maxLng: 139.6918, maxLat: 35.6897 }

    expect(await ids(otherUser, { bounds: tinyBounds })).toEqual([])
    expect(await ids(otherUser, { bounds: { minLng: 139.6915, minLat: 35.6895, maxLng: 139.6925, maxLat: 35.6905 } })).toEqual(['exact'])
    expect(await ids({ kind: 'anon' }, { bounds: { minLng: 139.6915, minLat: 35.6895, maxLng: 139.6925, maxLat: 35.6905 } })).toEqual([])
    expect(await ids({ kind: 'anon' }, { bounds: { minLng: 139.685, minLat: 35.685, maxLng: 139.695, maxLat: 35.695 } })).toEqual(['exact'])
    // 日時は日単位(同じ日のうちは、時刻で絞り込めない)
    expect(await ids(otherUser, { createdAfter: '2026-10-29T07:41:13.000Z' })).toEqual(['exact'])
    expect(await ids(otherUser, { createdAfter: '2026-10-30T00:00:00.000Z' })).toEqual([])
    // 管理者は元の値で絞り込む
    expect(await ids(admin, { bounds: tinyBounds })).toEqual(['exact'])
    expect(await ids(admin, { createdAfter: '2026-10-29T07:41:13.000Z' })).toEqual([])
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

  it('invalidates an in-flight push claim when moderation removes public status', async () => {
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)
    const report = await repo.create(owner, {
      title: 'test', dangerType: 'other', dangerLevel: 1, latitude: 35, longitude: 139,
    })
    await database.db.update(dangerReports).set({
      status: 'approved', aiModerationStatus: 'approved', pushNotifiedAt: 'claim:test-token',
    })

    const updated = await repo.updateStatus({ ...owner, isAdmin: true }, report.id, 'rejected')

    expect(updated).toMatchObject({ status: 'rejected', pushNotifiedAt: null })
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
