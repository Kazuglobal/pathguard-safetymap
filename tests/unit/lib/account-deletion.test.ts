// @vitest-environment node
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ACCOUNT_DELETION_COVERAGE, collectAccountMediaKeys, deleteAccountRows } from '@/lib/account-deletion'
import type { AppDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const ME = 'user-me'
const OTHER = 'user-other'

let database: TestDatabase

function run(sql: string, ...params: unknown[]) {
  database.sqlite.prepare(sql).run(...params)
}

function count(table: string, where: string, ...params: unknown[]): number {
  return (database.sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get(...params) as { n: number }).n
}

/** 自分とほかの人の、それぞれの表の行を作る */
function seed() {
  for (const user of [ME, OTHER]) {
    run('insert into profiles (id, email, display_name, avatar_key) values (?, ?, ?, ?)', user, `${user}@example.com`, 'ニックネーム', `avatars/${user}/icon.webp`)
    run(`insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude, status, image_key, processed_image_keys, reward_points)
      values (?, ?, '交差点', 'traffic', 3, 35, 139, 'approved', ?, ?, 20)`, `report-${user}`, user, `danger-reports/${user}/report-${user}/m-a.webp`, JSON.stringify([`danger-reports/${user}/report-${user}/m-b.webp`]))
    run('insert into report_create_history (report_id, user_id) values (?, ?)', `history-${user}`, user)
    run('insert into user_routes (id, user_id, name, start_lat, start_lng, end_lat, end_lng, start_address, end_address) values (?, ?, ?, 35, 139, 35, 139, ?, ?)', `route-${user}`, user, '通学路', '東京都新宿区', '東京都新宿区')
    run('insert into route_learning_sessions (id, user_id, route_id, session_id, started_at) values (?, ?, ?, ?, ?)', `session-${user}`, user, `route-${user}`, 's', '2026-10-01')
    run('insert into children (id, user_id, nickname) values (?, ?, ?)', `child-${user}`, user, 'さく')
    run('insert into push_subscriptions (id, user_id, endpoint, p256dh, auth) values (?, ?, ?, ?, ?)', `push-${user}`, user, `https://push.example/${user}`, 'k', 'a')
    run('insert into user_points (user_id, points) values (?, 100)', user)
    run('insert into safety_quest_attempts (id, user_id, challenge_id, mode, user_markers) values (?, ?, ?, ?, ?)', `quest-${user}`, user, 'sample-1', 'hazard', '[]')
    run('insert into hunter_photos (id, player_id, image_key) values (?, ?, ?)', `photo-${user}`, user, `hunter-photos/${user}/photo-${user}/p.webp`)
    run('insert into hunter_audit_log (id, actor_id, action) values (?, ?, ?)', `audit-${user}`, user, 'analyze')
    run('insert into image_generation_gate_log (id, route, mode, verdict, user_id) values (?, ?, ?, ?, ?)', `gate-${user}`, 'hazard-image', 'log', 'inside', user)
    run('insert into notifications (id, user_id, type, title, content) values (?, ?, ?, ?, ?)', `note-${user}`, user, 'system', 't', 'c')
  }
  run('insert into badges (id, name) values (1, ?)', 'はじめて')
  run('insert into missions (id, title) values (1, ?)', 'まいにち')
  for (const user of [ME, OTHER]) {
    run('insert into user_badges (user_id, badge_id) values (?, 1)', user)
    run('insert into user_mission_progress (user_id, mission_id) values (?, 1)', user)
  }
  // 自分がほかの人の報告にしたこと / ほかの人が自分の報告にしたこと
  run('insert into report_comments (id, report_id, user_id, content) values (?, ?, ?, ?)', 'my-comment', `report-${OTHER}`, ME, '気をつけます')
  run('insert into report_comments (id, report_id, user_id, content) values (?, ?, ?, ?)', 'their-comment', `report-${ME}`, OTHER, 'ありがとう')
  run('insert into report_likes (id, user_id, report_id) values (?, ?, ?)', 'my-like', ME, `report-${OTHER}`)
  run('insert into report_bookmarks (id, user_id, report_id) values (?, ?, ?)', 'my-bookmark', ME, `report-${OTHER}`)
  run('insert into danger_report_reactions (id, user_id, report_id, reaction_type) values (?, ?, ?, ?)', 'my-reaction', ME, `report-${OTHER}`, 'helpful')
  run('insert into report_flags (id, reporter_user_id, target_report_id) values (?, ?, ?)', 'my-flag', ME, `report-${OTHER}`)
  run('insert into report_shares (id, report_id, user_id, platform) values (?, ?, ?, ?)', 'my-share', `report-${OTHER}`, ME, 'line')
  run('insert into report_images (id, report_id, image_key, uploaded_by) values (?, ?, ?, ?)', 'my-upload', `report-${OTHER}`, `danger-reports/${OTHER}/report-${OTHER}/extra.webp`, ME)
}

beforeEach(() => {
  database = createTestDatabase()
  seed()
})

afterEach(() => {
  database.sqlite.close()
})

describe('退会で本人のデータをすべて消す(UIUX改装 項目40)', () => {
  it('消す写真のキーを先に集める(報告の写真・もしも画像・追加の写真・ハンターの写真・アイコン)', async () => {
    const media = await collectAccountMediaKeys(database.db as unknown as AppDb, ME)

    expect(media.privateKeys.sort()).toEqual([
      `danger-reports/${OTHER}/report-${OTHER}/extra.webp`,
      `danger-reports/${ME}/report-${ME}/m-a.webp`,
      `danger-reports/${ME}/report-${ME}/m-b.webp`,
      `hunter-photos/${ME}/photo-${ME}/p.webp`,
    ].sort())
    expect(media.publicKeys).toEqual([`avatars/${ME}/icon.webp`])
  })

  it('本人の行を消し、ほかの人の行は残し、ログは本人の id だけを消して残す', async () => {
    await deleteAccountRows(database.db as unknown as AppDb, ME)

    for (const [table, { column, action }] of Object.entries(ACCOUNT_DELETION_COVERAGE)) {
      expect(count(table, `${column} = ?`, ME), `${table}.${column}`).toBe(0)
      if (action === 'anonymize') continue
    }
    expect(count('hunter_audit_log', 'id = ? and actor_id is null', `audit-${ME}`)).toBe(1)
    expect(count('image_generation_gate_log', 'id = ? and user_id is null', `gate-${ME}`)).toBe(1)
    expect(count('report_shares', 'id = ? and user_id is null', 'my-share')).toBe(1)
    // 自分の報告への、ほかの人のコメントも一緒に消える
    expect(count('report_comments', 'id = ?', 'their-comment')).toBe(0)
    // ほかの人のデータは残る
    for (const table of ['profiles', 'danger_reports', 'user_routes', 'children', 'push_subscriptions', 'user_points', 'hunter_photos', 'user_badges']) {
      const column = table === 'profiles' ? 'id' : table === 'hunter_photos' ? 'player_id' : 'user_id'
      expect(count(table, `${column} = ?`, OTHER), table).toBe(1)
    }
    expect(count('user_points', 'user_id = ? and points = 100', OTHER)).toBe(1)
  })

  it('流し直しても失敗しない(途中で止まっても残りだけを消せる)', async () => {
    await deleteAccountRows(database.db as unknown as AppDb, ME)
    await expect(deleteAccountRows(database.db as unknown as AppDb, ME)).resolves.toBeUndefined()
  })
})

describe('利用者を指す列を持つ表は、退会ですべて扱う', () => {
  it('スキーマの表のうち、利用者の id を持つものは ACCOUNT_DELETION_COVERAGE にある(新しい表の漏れを見つける)', () => {
    const userColumns = new Set(['user_id', 'player_id', 'actor_id', 'uploaded_by', 'reporter_user_id', 'owner_id', 'target_user_id'])
    const found: string[] = []
    for (const value of Object.values(schema)) {
      let config: ReturnType<typeof getTableConfig>
      try {
        config = getTableConfig(value as Parameters<typeof getTableConfig>[0])
      } catch {
        continue
      }
      if (!config?.columns) continue
      for (const column of config.columns) {
        if (userColumns.has(column.name)) found.push(`${config.name}.${column.name}`)
      }
    }

    expect(found.length).toBeGreaterThan(10)
    const covered = new Set(Object.entries(ACCOUNT_DELETION_COVERAGE).map(([table, { column }]) => `${table}.${column}`))
    expect(found.filter((entry) => !covered.has(entry))).toEqual([])
  })
})
