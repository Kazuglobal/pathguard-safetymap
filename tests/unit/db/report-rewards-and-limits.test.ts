import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createDangerReportsRepo } from '@/lib/db/repos/danger-reports.repo'
import { createGamificationRepo } from '@/lib/db/repos/gamification.repo'
import { ReportCreateRateLimitError } from '@/lib/db/report-create-errors'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { toDangerReportJson } from '@/lib/danger-report-api'

const owner: Actor = { kind: 'user', id: 'owner', email: null, isAdmin: false }
const admin: Actor = { ...owner, id: 'admin', isAdmin: true }
const input = { title: 'Crosswalk', dangerType: 'traffic', dangerLevel: 3, latitude: 35, longitude: 139 }

describe('SEC-02 report creation and rewards', () => {
  let database: TestDatabase
  let repo: ReturnType<typeof createDangerReportsRepo>
  beforeEach(() => {
    database = createTestDatabase()
    repo = createDangerReportsRepo(database.db as unknown as AppDb)
  })
  afterEach(() => database.sqlite.close())

  function points() {
    return database.sqlite.prepare('select points, level from user_points where user_id = ?').get(owner.id)
  }
  function seedHistory(count: number, ageSeconds: number, prefix = 'history') {
    const insert = database.sqlite.prepare(`insert into report_create_history (report_id, user_id, created_at)
      values (?, ?, unixepoch() - ?)`)
    for (let i = 0; i < count; i++) insert.run(`${prefix}-${i}`, owner.id, ageSeconds)
  }

  it('allows ten creations, blocks the eleventh, and does not reset on deletion', async () => {
    const reports = []
    for (let i = 0; i < 10; i++) reports.push(await repo.create(owner, input))
    await repo.delete(owner, reports[0].id)
    await expect(repo.create(owner, input)).rejects.toBeInstanceOf(ReportCreateRateLimitError)
    expect(database.sqlite.prepare('select count(*) as n from report_create_history').get()).toEqual({ n: 10 })
    expect(database.sqlite.prepare('select count(*) as n from danger_reports').get()).toEqual({ n: 9 })
    expect(points()).toBeUndefined()
    await expect(repo.create({ ...owner, id: 'other' }, input)).resolves.toMatchObject({ userId: 'other' })
  })

  it('allows the fiftieth daily creation and blocks the fifty-first', async () => {
    seedHistory(49, 7200)
    await repo.create(owner, input)
    await expect(repo.create(owner, input)).rejects.toBeInstanceOf(ReportCreateRateLimitError)
  })

  it('uses the later reset when both quotas are exhausted', async () => {
    seedHistory(40, 7200, 'day')
    seedHistory(10, 60, 'hour')
    const error = await repo.create(owner, input).catch((error: unknown) => error)
    expect(error).toBeInstanceOf(ReportCreateRateLimitError)
    expect((error as ReportCreateRateLimitError).reset).toBeGreaterThan(Date.now() + 21 * 3600_000)
    expect((error as ReportCreateRateLimitError).reset).toBeLessThanOrEqual(Date.now() + 22 * 3600_000)
  })

  it('expires hour and day windows at their exact boundaries', async () => {
    seedHistory(10, 3600)
    seedHistory(40, 86400, 'expired')
    await expect(repo.create(owner, input)).resolves.toBeDefined()
    expect(database.sqlite.prepare('select count(*) as n from report_create_history').get()).toEqual({ n: 11 })
  })

  it('bounds expiration cleanup to 1000 entries per successful creation', async () => {
    seedHistory(1001, 86401)
    await repo.create(owner, input)
    expect(database.sqlite.prepare('select count(*) as n from report_create_history').get()).toEqual({ n: 2 })
  })

  it('does not consume quota for invalid or rolled-back creations', async () => {
    await expect(repo.create(owner, { ...input, latitude: 100 })).rejects.toBeInstanceOf(RangeError)
    database.sqlite.exec(`create trigger fail_history before insert on report_create_history
      begin select raise(abort, 'injected failure'); end;`)
    await expect(repo.create(owner, input)).rejects.toThrow()
    expect(database.sqlite.prepare('select count(*) as n from danger_reports').get()).toEqual({ n: 0 })
    expect(database.sqlite.prepare('select count(*) as n from report_create_history').get()).toEqual({ n: 0 })
  })

  it('grants only on approval, preserves levels, revokes on reopening, and restores once', async () => {
    const gamification = createGamificationRepo(database.db as unknown as AppDb)
    await gamification.incrementPoints({ kind: 'service' }, owner.id, 480)
    const report = await repo.create(owner, input)
    expect(report.rewardPoints).toBe(0)
    expect(toDangerReportJson(report)).not.toHaveProperty('reward_points')
    expect(points()).toEqual({ points: 480, level: 1 })
    for (const status of ['approved', 'approved', 'published', 'resolved']) {
      await repo.updateStatus(admin, report.id, status)
      expect(points()).toEqual({ points: 500, level: 2 })
    }
    for (const status of ['pending', 'rejected', 'rejected']) {
      await repo.updateStatus(admin, report.id, status)
      expect(points()).toEqual({ points: 480, level: 1 })
    }
    await repo.updateStatus(admin, report.id, 'approved')
    expect(points()).toEqual({ points: 500, level: 2 })
    await repo.delete(owner, report.id)
    await repo.delete(owner, report.id)
    expect(points()).toEqual({ points: 480, level: 1 })
  })

  it.each(['approved', 'published', 'resolved'])('awards a direct transition to %s', async (status) => {
    const report = await repo.create(owner, input)
    await repo.updateStatus(admin, report.id, status)
    expect(points()).toEqual({ points: 20, level: 1 })
  })

  it('revokes AI approval when an image reopens moderation', async () => {
    const report = await repo.create(owner, input)
    database.sqlite.prepare("update danger_reports set status = 'approved', ai_moderation_status = 'approved' where id = ?").run(report.id)
    expect(points()).toEqual({ points: 20, level: 1 })
    await repo.setImages(owner, report.id, { imageKey: 'test.webp' })
    expect(points()).toEqual({ points: 0, level: 1 })
  })

  it('does not award for pending, rejected, or moderation-only changes', async () => {
    const report = await repo.create(owner, input)
    database.sqlite.prepare("update danger_reports set ai_moderation_status = 'needs_review' where id = ?").run(report.id)
    await repo.updateStatus(admin, report.id, 'pending')
    await repo.updateStatus(admin, report.id, 'rejected')
    await repo.delete(owner, report.id)
    expect(points()).toBeUndefined()
  })

  it('leaves legacy reports and their existing points untouched', async () => {
    database.sqlite.exec(`insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude)
      values ('legacy', 'owner', 'Legacy', 'traffic', 3, 35, 139);
      insert into user_points (user_id, points, level) values ('owner', 120, 1);`)
    for (const status of ['approved', 'pending', 'approved', 'rejected']) await repo.updateStatus(admin, 'legacy', status)
    await repo.delete(owner, 'legacy')
    expect(points()).toEqual({ points: 120, level: 1 })
  })

  it('never permits negative balances on revocation', async () => {
    const report = await repo.create(owner, input)
    await repo.updateStatus(admin, report.id, 'approved')
    await createGamificationRepo(database.db as unknown as AppDb).incrementPoints({ kind: 'service' }, owner.id, -15)
    await repo.delete(owner, report.id)
    expect(points()).toEqual({ points: 0, level: 1 })
  })

  it('rolls back approval, reopening, and deletion when point writes fail', async () => {
    const report = await repo.create(owner, input)
    database.sqlite.exec(`create trigger fail_points before insert on user_points
      begin select raise(abort, 'injected point failure'); end;`)
    await expect(repo.updateStatus(admin, report.id, 'approved')).rejects.toThrow()
    expect(await repo.getById(owner, report.id)).toMatchObject({ status: 'pending', rewardPoints: 0 })
    database.sqlite.exec('drop trigger fail_points')
    await repo.updateStatus(admin, report.id, 'approved')
    database.sqlite.exec(`create trigger fail_points before update on user_points
      begin select raise(abort, 'injected point failure'); end;`)
    await expect(repo.updateStatus(admin, report.id, 'pending')).rejects.toThrow()
    await expect(repo.delete(owner, report.id)).rejects.toThrow()
    expect(await repo.getById(owner, report.id)).toMatchObject({ status: 'approved', rewardPoints: 20 })
    expect(points()).toEqual({ points: 20, level: 1 })
  })
})
