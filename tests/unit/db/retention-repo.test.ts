// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEMO_SAMPLE_MODERATION_REASON } from '@/lib/admin-report-moderation-queue'
import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createRetentionRepo } from '@/lib/db/repos/retention.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { isExpiredBackupKey, retentionCutoff } from '@/lib/retention/policy'

const service: Actor = { kind: 'service' }
const NOW = new Date('2026-10-29T00:00:00.000Z')
const daysAgo = (days: number) => retentionCutoff(NOW, days)

let database: TestDatabase

function addReport(id: string, status: string, fields: { createdAt?: string; updatedAt?: string; humanApprovedAt?: string | null; reason?: string | null } = {}) {
  database.sqlite.prepare(`insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude, status, image_key, processed_image_keys,
      reward_points, created_at, updated_at, human_approved_at, ai_moderation_reason)
    values (?, 'owner', '交差点', 'traffic', 3, 35, 139, ?, ?, ?, 20, ?, ?, ?, ?)`)
    .run(id, status, `danger-reports/owner/${id}/m-a.webp`, JSON.stringify([`danger-reports/owner/${id}/m-b.webp`]),
      fields.createdAt ?? daysAgo(1), fields.updatedAt ?? fields.createdAt ?? daysAgo(1), fields.humanApprovedAt ?? null, fields.reason ?? null)
}

beforeEach(() => {
  database = createTestDatabase()
  database.sqlite.prepare("insert into user_points (user_id, points) values ('owner', 100)").run()
})

afterEach(() => {
  database.sqlite.close()
})

describe('保持期間を過ぎたデータ(UIUX改装 項目60)', () => {
  it('非公開は作成から90日、公開中は承認から2年、解決済みは解決から90日で消す(デモの見本は消さない)', async () => {
    addReport('pending-old', 'pending', { createdAt: daysAgo(91) })
    addReport('pending-new', 'pending', { createdAt: daysAgo(89) })
    addReport('rejected-old', 'rejected', { createdAt: daysAgo(100) })
    addReport('published-old', 'published', { createdAt: daysAgo(800), humanApprovedAt: daysAgo(731) })
    addReport('published-reapproved', 'approved', { createdAt: daysAgo(800), humanApprovedAt: daysAgo(100) })
    addReport('resolved-old', 'resolved', { createdAt: daysAgo(400), updatedAt: daysAgo(91) })
    addReport('resolved-new', 'resolved', { createdAt: daysAgo(400), updatedAt: daysAgo(10) })
    addReport('demo-sample', 'pending', { createdAt: daysAgo(300), reason: DEMO_SAMPLE_MODERATION_REASON })
    database.sqlite.prepare("insert into report_images (id, report_id, image_key) values ('extra', 'pending-old', 'danger-reports/owner/pending-old/extra.webp')").run()
    const repo = createRetentionRepo(database.db as unknown as AppDb)

    const expired = await repo.listExpiredReports(service, NOW)

    expect(expired.map((report) => report.id).sort()).toEqual(['pending-old', 'published-old', 'rejected-old', 'resolved-old'])
    expect(expired.find((report) => report.id === 'pending-old')?.mediaKeys.sort()).toEqual([
      'danger-reports/owner/pending-old/extra.webp', 'danger-reports/owner/pending-old/m-a.webp', 'danger-reports/owner/pending-old/m-b.webp',
    ])

    expect(await repo.deleteReports(service, expired.map((report) => report.id))).toBe(4)
    // 期限切れで消しても、投稿者が得たポイントは減らさない
    expect(database.sqlite.prepare("select points from user_points where user_id = 'owner'").get()).toEqual({ points: 100 })
    expect(database.sqlite.prepare('select count(*) as n from danger_reports').get()).toEqual({ n: 4 })
  })

  it('180日、更新も配信もない通知の購読を消す(配信が続いている購読は残す)', async () => {
    const insert = database.sqlite.prepare("insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, updated_at, last_notified_at) values (?, 'u', ?, 'k', 'a', ?, ?)")
    insert.run('stale', 'https://push/1', daysAgo(200), null)
    insert.run('notified', 'https://push/2', daysAgo(200), daysAgo(3))
    insert.run('fresh', 'https://push/3', daysAgo(10), null)

    expect(await createRetentionRepo(database.db as unknown as AppDb).deleteStaleSubscriptions(service, NOW)).toBe(1)
    expect(database.sqlite.prepare('select id from push_subscriptions order by id').all()).toEqual([{ id: 'fresh' }, { id: 'notified' }])
  })

  it('30日より前の報告の作成の記録を消す', async () => {
    const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
    const insert = database.sqlite.prepare("insert into report_create_history (report_id, user_id, created_at) values (?, 'u', ?)")
    insert.run('old', seconds(daysAgo(31)))
    insert.run('new', seconds(daysAgo(29)))

    expect(await createRetentionRepo(database.db as unknown as AppDb).deleteOldReportCreateHistory(service, NOW)).toBe(1)
    expect(database.sqlite.prepare('select report_id from report_create_history').all()).toEqual([{ report_id: 'new' }])
  })

  it('利用者からは呼べない', async () => {
    await expect(createRetentionRepo(database.db as unknown as AppDb).listExpiredReports({ kind: 'user', id: 'u', email: null, isAdmin: true }, NOW))
      .rejects.toThrow('Service actor is required')
  })

  it('バックアップは30日より前の日付のものを消す', () => {
    expect(isExpiredBackupKey('d1/2026-09-28.sql.gz', NOW)).toBe(true)
    expect(isExpiredBackupKey('d1/2026-09-30.sql.gz', NOW)).toBe(false)
    expect(isExpiredBackupKey('other/2020-01-01.sql.gz', NOW)).toBe(false)
  })
})
