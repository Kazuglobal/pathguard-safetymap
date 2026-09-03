// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/d1'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createDangerReportsRepo } from '@/lib/db/repos/danger-reports.repo'
import * as schema from '@/lib/db/schema'
import { createDangerModerationD1 } from '@/lib/danger-report-moderation-d1'

const ai = vi.hoisted(() => ({ moderate: vi.fn() }))
vi.mock('@/lib/danger-report-moderation-ai', () => ({
  DANGER_MODERATION_PROMPT_VERSION: 'sec02-test', moderateDangerReportWithAi: ai.moderate,
}))

// Use Wrangler's installed workerd/D1 emulator, without adding a second version.
const require = createRequire(import.meta.url)
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', {
  paths: [path.dirname(require.resolve('wrangler/package.json'))],
}))

const owner: Actor = { kind: 'user', id: 'owner', email: null, isAdmin: false }
const admin: Actor = { ...owner, isAdmin: true }
const input = { title: 'Crosswalk', dangerType: 'traffic', dangerLevel: 3, latitude: 35, longitude: 139 }
const migration = '20260903155959_report_creation_rewards.sql'

describe('SEC-02 actual local D1 concurrency', { timeout: 30_000 }, () => {
  let emulator: InstanceType<typeof Miniflare>
  let binding: Parameters<typeof drizzle>[0]
  let repo: ReturnType<typeof createDangerReportsRepo>

  async function seedLegacy() {
    await binding.batch([
      binding.prepare("insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude) values ('legacy', 'owner', 'Legacy', 'traffic', 3, 35, 139)"),
      binding.prepare("insert into report_images (id, report_id, image_key) values ('image', 'legacy', 'legacy.webp')"),
      binding.prepare("insert into user_points (user_id, points, level) values ('owner', 20, 1)"),
    ])
  }

  beforeAll(async () => {
    emulator = new Miniflare(convertV4MiniflareOptions({
      name: 'sec02-test', modules: true, script: 'export default { fetch() { return new Response("ok") } }',
      compatibilityDate: '2026-08-22', d1Databases: ['DB'],
    }))
    binding = await emulator.getD1Database('DB')
    // Reconstruct the real pre-migration tables, then apply the new SQL through
    // D1 itself. This catches D1-specific trigger and migration incompatibilities.
    const old = new Database(':memory:')
    try {
      const directory = path.join(process.cwd(), 'lib/db/migrations')
      for (const file of fs.readdirSync(directory).filter((file) => file.endsWith('.sql') && file < migration).sort()) {
        old.exec(fs.readFileSync(path.join(directory, file), 'utf8'))
      }
      const tables = old.prepare("select sql from sqlite_master where type = 'table' and name in ('danger_reports', 'user_points', 'report_images', 'danger_report_moderation_log') order by rowid").all() as { sql: string }[]
      await binding.batch(tables.map(({ sql }) => binding.prepare(sql)))
      await seedLegacy()
      const statements = fs.readFileSync(path.join(directory, migration), 'utf8').split('--> statement-breakpoint').map((sql) => sql.trim()).filter(Boolean)
      await binding.batch(statements.map((sql) => binding.prepare(sql)))
      expect(await binding.prepare("select reward_points from danger_reports where id = 'legacy'").first()).toEqual({ reward_points: null })
      expect(await binding.prepare("select image_key from report_images where report_id = 'legacy'").first()).toEqual({ image_key: 'legacy.webp' })
      expect(await binding.prepare("select points from user_points where user_id = 'owner'").first()).toEqual({ points: 20 })
    } finally {
      old.close()
    }
    repo = createDangerReportsRepo(drizzle(binding, { schema }))
  }, 60_000)

  beforeEach(async () => {
    if (binding) await binding.batch([
      binding.prepare('delete from danger_reports'),
      binding.prepare('delete from report_create_history'),
      binding.prepare('delete from user_points'),
    ])
  })
  afterAll(async () => { await emulator?.dispose() })

  it('migrates existing reports, related images, and points without rewriting them', async () => {
    await seedLegacy()
    expect(await binding.prepare("select reward_points from danger_reports where id = 'legacy'").first()).toEqual({ reward_points: null })
    expect(await binding.prepare("select image_key from report_images where report_id = 'legacy'").first()).toEqual({ image_key: 'legacy.webp' })
    await repo.updateStatus(admin, 'legacy', 'approved')
    await repo.delete(owner, 'legacy')
    expect(await binding.prepare("select points from user_points where user_id = 'owner'").first()).toEqual({ points: 20 })
  })

  it('allows exactly 10 of 20 simultaneous creates and retains quota after deletion', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => repo.create(owner, input)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10)
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason.name).toBe('ReportCreateRateLimitError')
    }
    await binding.prepare('delete from danger_reports').run()
    await expect(repo.create(owner, input)).rejects.toMatchObject({ name: 'ReportCreateRateLimitError' })
    expect(await binding.prepare('select count(*) as n from report_create_history').first()).toEqual({ n: 10 })
  })

  it('allows exactly one concurrent creation when 49 daily slots are used', async () => {
    await binding.batch(Array.from({ length: 49 }, (_, i) => binding.prepare(
      "insert into report_create_history (report_id, user_id, created_at) values (?, 'owner', unixepoch() - 7200)",
    ).bind(`history-${i}`)))
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => repo.create(owner, input)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await binding.prepare('select count(*) as n from report_create_history').first()).toEqual({ n: 50 })
  })

  it('awards once under concurrent approvals and revokes once under concurrent deletes', async () => {
    const report = await repo.create(owner, input)
    await Promise.all(Array.from({ length: 10 }, () => repo.updateStatus(admin, report.id, 'approved')))
    expect(await binding.prepare("select points from user_points where user_id = 'owner'").first()).toEqual({ points: 20 })
    await Promise.all(Array.from({ length: 5 }, () => repo.delete(owner, report.id)))
    expect(await binding.prepare("select points from user_points where user_id = 'owner'").first()).toEqual({ points: 0 })
  })

  it('leaves zero points after a concurrent approval/delete race', async () => {
    const report = await repo.create(owner, input)
    await Promise.allSettled([repo.updateStatus(admin, report.id, 'approved'), repo.delete(owner, report.id)])
    expect(await repo.getById(owner, report.id)).toBeNull()
    const row = await binding.prepare("select points from user_points where user_id = 'owner'").first<{ points: number }>()
    expect(row?.points ?? 0).toBe(0)
  })

  it.each([
    { mode: 'live' as const, fallback: false, status: 'approved', points: 20 },
    { mode: 'shadow' as const, fallback: false, status: 'approved', points: 0 },
    { mode: 'live' as const, fallback: true, status: 'approved', points: 0 },
    { mode: 'live' as const, fallback: false, status: 'needs_review', points: 0 },
  ])('awards $points for AI mode=$mode fallback=$fallback verdict=$status', async ({ mode, fallback, status, points }) => {
    ai.moderate.mockResolvedValue({
      status, fallback, score: 0.1, reason: 'test', aiExecuted: true,
      heuristicStatus: 'approved', aiVerdict: null, model: 'test', promptVersion: 'sec02-test', latencyMs: 1,
    })
    const report = await repo.create(owner, input)
    const moderation = createDangerModerationD1(drizzle(binding, { schema }))
    await moderation.moderate({ kind: 'service' }, report, mode)
    const row = await binding.prepare("select points from user_points where user_id = 'owner'").first<{ points: number }>()
    expect(row?.points ?? 0).toBe(points)
    expect((await repo.getById(owner, report.id))?.rewardPoints).toBe(points)
  })

  it('rolls back the report and quota history when the INSERT trigger fails in D1', async () => {
    await binding.prepare("create trigger injected_failure before insert on report_create_history begin select raise(abort, 'injected failure'); end").run()
    try {
      await expect(repo.create(owner, input)).rejects.toMatchObject({ name: 'ReportCreateUnavailableError' })
      expect(await binding.prepare('select count(*) as n from danger_reports').first()).toEqual({ n: 0 })
      expect(await binding.prepare('select count(*) as n from report_create_history').first()).toEqual({ n: 0 })
    } finally {
      await binding.prepare('drop trigger injected_failure').run()
    }
  })
})
