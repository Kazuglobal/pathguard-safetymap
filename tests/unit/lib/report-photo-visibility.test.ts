// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { toDangerReportJsonForViewer } from '@/lib/danger-report-api'
import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { dangerReports } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { createPrivateMediaAuthorizer } from '@/lib/media/authorize'
import { parsePrivateMediaKey } from '@/lib/media/url'

const owner: Actor = { kind: 'user', id: 'owner-1', email: null, isAdmin: false }
const other: Actor = { kind: 'user', id: 'other-1', email: null, isAdmin: false }
const admin: Actor = { kind: 'user', id: 'admin-1', email: null, isAdmin: true }

// ぼかしていない(既存の)写真と、端末でぼかした写真(ファイル名の頭に m-)
const ORIGINAL = 'danger-reports/owner-1/report-1/original.webp'
const PROCESSED = 'danger-reports/owner-1/report-1/processed.webp'
const MASKED_ORIGINAL = 'danger-reports/owner-1/report-1/m-original.webp'
const MASKED_PROCESSED = 'danger-reports/owner-1/report-1/m-processed.webp'

let database: TestDatabase

async function insertReport(fields: Partial<typeof dangerReports.$inferInsert> = {}) {
  await database.db.insert(dangerReports).values({
    id: 'report-1', userId: 'owner-1', title: '見通しの悪い交差点', dangerType: 'traffic', dangerLevel: 3,
    latitude: 35.689634, longitude: 139.691706, status: 'approved', aiModerationStatus: 'approved',
    aiModerationReason: '問題なし', aiModerationScore: 0.1, imageKey: ORIGINAL, processedImageKeys: [PROCESSED],
    createdAt: '2026-10-29T07:41:12.345Z', updatedAt: '2026-10-29T08:00:00.000Z', ...fields,
  })
}

function report() {
  return database.db.select().from(dangerReports).all()[0]!
}

async function canSee(actor: Actor, key: string) {
  return createPrivateMediaAuthorizer(database.db as unknown as AppDb)(actor, parsePrivateMediaKey(key))
}

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(() => {
  database.sqlite.close()
})

describe('報告の写真はぼかしたものだけを公開する(UIUX改装 項目57)', () => {
  it('ぼかしていない写真(既存の写真)は、公開中でも本人と管理者だけが見られる', async () => {
    await insertReport({ imageMasked: false })

    expect(await canSee(other, ORIGINAL)).toBe(false)
    expect(await canSee(other, PROCESSED)).toBe(false)
    expect(await canSee(owner, ORIGINAL)).toBe(true)
    expect(await canSee(admin, PROCESSED)).toBe(true)
  })

  it('ぼかした写真は、公開中ならほかの人も見られる(非公開ならほかの人は見られない)', async () => {
    await insertReport({ imageMasked: true, imageKey: MASKED_ORIGINAL, processedImageKeys: [MASKED_PROCESSED] })
    expect(await canSee(other, MASKED_ORIGINAL)).toBe(true)
    expect(await canSee(other, MASKED_PROCESSED)).toBe(true)

    database.sqlite.prepare("update danger_reports set status = 'pending'").run()
    expect(await canSee(other, MASKED_ORIGINAL)).toBe(false)
  })

  it('元の写真をぼかした写真に差し替えても、古い(ぼかしていない写真から作った)もしも画像は見せない', async () => {
    await insertReport({ imageMasked: true, imageKey: MASKED_ORIGINAL, processedImageKeys: [PROCESSED, MASKED_PROCESSED] })

    expect(await canSee(other, MASKED_ORIGINAL)).toBe(true)
    expect(await canSee(other, PROCESSED)).toBe(false)
    expect(await canSee(other, MASKED_PROCESSED)).toBe(true)
    expect(await canSee(owner, PROCESSED)).toBe(true)
  })
})

describe('見る人に合わせた報告の JSON(UIUX改装 項目61)', () => {
  it('ほかの人には投稿者の id・審査の結果を返さず、日時は日単位・座標は約100m、ぼかしていない写真は返さない', async () => {
    await insertReport({ imageMasked: false })

    const json = toDangerReportJsonForViewer(report(), other)

    expect(json).toMatchObject({
      user_id: '', latitude: 35.69, longitude: 139.692, image_url: null, processed_image_urls: [],
      ai_moderation_status: null, ai_moderation_reason: null, ai_moderation_score: null,
      created_at: '2026-10-29', updated_at: '2026-10-29', title: '見通しの悪い交差点',
    })
    expect(JSON.stringify(json)).not.toContain('owner-1')
  })

  it('ぼかした写真なら、ほかの人にも写真の URL を返す(写真ごとに決める)', async () => {
    await insertReport({ imageMasked: true, imageKey: MASKED_ORIGINAL, processedImageKeys: [PROCESSED, MASKED_PROCESSED] })
    const json = toDangerReportJsonForViewer(report(), other)
    // ほかの人には、投稿者の id が入った保存のキーではなく、報告の id と写真の場所だけの URL を返す(項目61)
    expect(json.image_url).toBe('/api/media/report/report-1/image')
    expect(json.processed_image_urls).toEqual(['/api/media/report/report-1/p1'])
    expect(JSON.stringify(json)).not.toContain('owner-1')
  })

  it('本人と管理者には全部を返す(写真がぼかし直し待ちかも分かる)', async () => {
    await insertReport({ imageMasked: false })

    expect(toDangerReportJsonForViewer(report(), owner)).toMatchObject({
      user_id: 'owner-1', latitude: 35.689634, image_url: `/api/media/private/${ORIGINAL}`, image_masked: false,
      ai_moderation_reason: '問題なし', created_at: '2026-10-29T07:41:12.345Z',
    })
    expect(toDangerReportJsonForViewer(report(), admin).user_id).toBe('owner-1')
  })

  it('未ログインには写真なしのプレビューだけ(ログインしたほかの人に見せるものより粗くする)', async () => {
    await insertReport({ imageKey: MASKED_ORIGINAL, processedImageKeys: [MASKED_PROCESSED], imageMasked: true, postalCode: '1600023' })
    const json = toDangerReportJsonForViewer(report(), { kind: 'anon' })

    expect(json).toMatchObject({
      user_id: '', image_url: null, processed_image_url: null, processed_image_urls: [],
      latitude: 35.69, longitude: 139.69,
      created_at: '2026-10-29', updated_at: '2026-10-29',
      postal_code: null, address_hash: null, geocoded_at: null, geocode_source: null, geocode_confidence: null,
      ai_moderation_status: null, ai_moderation_reason: null, ai_moderation_score: null, ai_moderation_checked_at: null,
    })
  })
})
