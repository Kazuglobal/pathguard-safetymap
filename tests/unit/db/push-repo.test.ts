import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createDangerReportsRepo } from '@/lib/db/repos/danger-reports.repo'
import { createPushRepo } from '@/lib/db/repos/push.repo'
import { dangerReports } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const service: Actor = { kind: 'service' }
const owner: Actor = { kind: 'user', id: 'user-1', email: null, isAdmin: false }
const admin: Actor = { kind: 'user', id: 'admin-1', email: null, isAdmin: true }

describe('danger report push D1 repository', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  async function insertReport(
    id: string,
    status: string,
    aiModerationStatus: string | null,
    pushNotifiedAt: string | null = null,
  ) {
    await database.db.insert(dangerReports).values({
      id,
      userId: 'user-1',
      title: `attacker-controlled-${id}`,
      dangerType: 'other',
      dangerLevel: 5,
      latitude: 35,
      longitude: 139,
      status,
      aiModerationStatus,
      pushNotifiedAt,
      createdAt: '2026-09-03T00:00:00.000Z',
    })
  }

  it('lists only unnotified public reports whose AI moderation is approved', async () => {
    await Promise.all([
      insertReport('approved', 'approved', 'approved'),
      insertReport('published', 'published', 'approved'),
      insertReport('resolved', 'resolved', 'approved'),
      insertReport('pending', 'pending', 'pending'),
      insertReport('rejected', 'rejected', 'approved'),
      insertReport('not-reviewed', 'approved', null),
      insertReport('needs-review', 'approved', 'needs_review'),
      insertReport('already-sent', 'approved', 'approved', '2026-09-03T01:00:00.000Z'),
    ])
    const repo = createPushRepo(database.db as unknown as AppDb)

    const rows = await repo.listPendingReportIds(service, '2026-09-02T00:00:00.000Z')

    expect(rows.map((row) => row.id).sort()).toEqual(['approved', 'published', 'resolved'])
  })

  it('atomically refuses reports that are not public and AI-approved', async () => {
    await insertReport('pending', 'pending', 'pending')
    await insertReport('rejected', 'rejected', 'approved')
    await insertReport('not-reviewed', 'approved', null)
    await insertReport('needs-review', 'approved', 'needs_review')
    const repo = createPushRepo(database.db as unknown as AppDb)

    for (const id of ['pending', 'rejected', 'not-reviewed', 'needs-review']) {
      await expect(repo.claimReport(service, id, 'user-1')).resolves.toEqual({ status: 'not_ready' })
    }
    const rows = database.sqlite.prepare(
      'select id, push_notified_at from danger_reports order by id',
    ).all()
    expect(rows).toEqual([
      { id: 'needs-review', push_notified_at: null },
      { id: 'not-reviewed', push_notified_at: null },
      { id: 'pending', push_notified_at: null },
      { id: 'rejected', push_notified_at: null },
    ])
  })

  it.each(['approved', 'published', 'resolved'])('claims an eligible %s report exactly once', async (status) => {
    await insertReport(status, status, 'approved')
    const repo = createPushRepo(database.db as unknown as AppDb)

    const first = await repo.claimReport(service, status, 'user-1')
    expect(first).toMatchObject({
      status: 'claimed',
      report: { id: status, dangerType: 'other', prefecture: null, latitude: 35, longitude: 139 },
    })
    await expect(repo.claimReport(service, status, 'user-1')).resolves.toEqual({ status: 'already_claimed' })
    await expect(repo.claimReport(service, status, 'different-user')).resolves.toEqual({ status: 'not_found' })
  })

  it('rechecks eligibility at claim time after a listed report is reopened', async () => {
    await insertReport('reopened', 'approved', 'approved')
    const repo = createPushRepo(database.db as unknown as AppDb)
    expect(await repo.listPendingReportIds(service, '2026-09-02T00:00:00.000Z')).toEqual([{ id: 'reopened' }])
    await database.db.update(dangerReports).set({ status: 'pending', aiModerationStatus: 'needs_review' })

    await expect(repo.claimReport(service, 'reopened')).resolves.toEqual({ status: 'not_ready' })
    expect(database.sqlite.prepare(
      'select push_notified_at from danger_reports where id = ?',
    ).get('reopened')).toEqual({ push_notified_at: null })
  })

  it('invalidates an in-flight claim when an image reopens moderation before fanout', async () => {
    await insertReport('raced', 'approved', 'approved')
    const pushRepo = createPushRepo(database.db as unknown as AppDb)
    const reportRepo = createDangerReportsRepo(database.db as unknown as AppDb)
    const claimed = await pushRepo.claimReport(service, 'raced', 'user-1')
    expect(claimed.status).toBe('claimed')
    if (claimed.status !== 'claimed') throw new Error('Expected report claim')

    await reportRepo.setImages(owner, 'raced', {
      imageKey: 'danger-reports/user-1/raced/review.webp',
    })

    await expect(pushRepo.confirmReportClaim(service, 'raced', claimed.claimedAt)).resolves.toBe(false)
    expect(database.sqlite.prepare(
      'select status, ai_moderation_status, push_notified_at from danger_reports where id = ?',
    ).get('raced')).toEqual({
      status: 'pending', ai_moderation_status: 'needs_review', push_notified_at: null,
    })
  })

  describe('運営(人)の承認と、取りこぼしを拾う範囲(UIUX改装 項目59)', () => {
    async function insertWith(id: string, fields: Partial<typeof dangerReports.$inferInsert>) {
      await database.db.insert(dangerReports).values({
        id, userId: 'user-1', title: id, dangerType: 'other', dangerLevel: 3, latitude: 35, longitude: 139,
        status: 'pending', aiModerationStatus: 'needs_review', createdAt: '2026-09-03T00:00:00.000Z', ...fields,
      })
    }
    function row(id: string) {
      return database.sqlite.prepare('select status, ai_moderation_status, human_approved_at, push_notified_at from danger_reports where id = ?').get(id) as {
        status: string; ai_moderation_status: string | null; human_approved_at: string | null; push_notified_at: string | null
      }
    }

    it('管理者が公開にした報告は、AI が承認していなくても通知の対象になる', async () => {
      await insertWith('human', { status: 'pending', aiModerationStatus: 'needs_review' })
      const reports = createDangerReportsRepo(database.db as unknown as AppDb)
      const push = createPushRepo(database.db as unknown as AppDb)
      expect(await push.listPendingReportIds(service, '2026-09-02T00:00:00.000Z')).toEqual([])

      await reports.updateStatus(admin, 'human', 'approved')

      expect(row('human').human_approved_at).not.toBeNull()
      expect((await push.listPendingReportIds(service, '2000-01-01T00:00:00.000Z')).map((item) => item.id)).toEqual(['human'])
      expect((await push.claimReport(service, 'human')).status).toBe('claimed')
    })

    it('審査前のもの(AI も人も承認していない)は、公開の状態でも送らない', async () => {
      await insertWith('unreviewed', { status: 'approved', aiModerationStatus: 'needs_review', humanApprovedAt: null })
      const push = createPushRepo(database.db as unknown as AppDb)

      expect(await push.listPendingReportIds(service, '2000-01-01T00:00:00.000Z')).toEqual([])
      expect((await push.claimReport(service, 'unreviewed')).status).toBe('not_ready')
    })

    it('作成からではなく承認からの時間で拾う(古い承認はまとめて送らない)', async () => {
      await insertWith('old-created-new-approval', {
        status: 'approved', aiModerationStatus: 'approved', createdAt: '2026-08-01T00:00:00.000Z', aiModerationCheckedAt: '2026-09-03T00:00:00.000Z',
      })
      await insertWith('old-approval', {
        status: 'approved', aiModerationStatus: 'needs_review', createdAt: '2026-09-03T00:00:00.000Z', humanApprovedAt: '2026-09-01T00:00:00.000Z',
      })
      const push = createPushRepo(database.db as unknown as AppDb)

      const rows = await push.listPendingReportIds(service, '2026-09-02T00:00:00.000Z')

      expect(rows.map((item) => item.id)).toEqual(['old-created-new-approval'])
    })

    it('非公開に戻したら人の承認を取り消す。サービス(自動処理)による公開は人の承認にしない', async () => {
      await insertWith('toggle', { status: 'pending' })
      const reports = createDangerReportsRepo(database.db as unknown as AppDb)

      await reports.updateStatus(admin, 'toggle', 'approved')
      const approvedAt = row('toggle').human_approved_at
      await reports.updateStatus(admin, 'toggle', 'published')
      expect(row('toggle').human_approved_at).toBe(approvedAt)
      await reports.updateStatus(admin, 'toggle', 'rejected')
      expect(row('toggle').human_approved_at).toBeNull()

      await reports.updateStatus(service, 'toggle', 'approved')
      expect(row('toggle').human_approved_at).toBeNull()
    })

    it('人が承認した報告も、写真が変わったら審査をやり直す(人の承認と通知済みの印を外す)', async () => {
      await insertWith('human-image', { status: 'approved', aiModerationStatus: 'needs_review', humanApprovedAt: '2026-09-03T01:00:00.000Z', pushNotifiedAt: '2026-09-03T01:05:00.000Z' })
      const reports = createDangerReportsRepo(database.db as unknown as AppDb)

      await reports.setImages(owner, 'human-image', { imageKey: 'danger-reports/user-1/human-image/new.webp' })

      expect(row('human-image')).toEqual({ status: 'pending', ai_moderation_status: 'needs_review', human_approved_at: null, push_notified_at: null })
    })
  })
})
