// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getTableColumns } from 'drizzle-orm'

import type { Actor } from '@/lib/db/authz'
import { createProfilesRepo } from '@/lib/db/repos/profiles.repo'
import { profiles } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { toProfileJson } from '@/lib/profile-api'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const actor: Actor = { kind: 'user', id: USER_ID, email: 'parent@example.com', isAdmin: false }

let database: TestDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(() => {
  database.sqlite.close()
})

describe('プロフィールは氏名を預からない(UIUX改装 項目55)', () => {
  it('アプリのスキーマは氏名(full_name)の列を読み書きしない', () => {
    expect(Object.keys(getTableColumns(profiles))).not.toContain('fullName')
  })

  it('マイグレーションのあとの profiles の表には、氏名の列そのものが無い(20261029235818)', () => {
    const columns = (database.sqlite.prepare('pragma table_info(profiles)').all() as { name: string }[]).map((column) => column.name)
    expect(columns).not.toContain('full_name')
    expect(columns).toEqual(expect.arrayContaining(['display_name', 'avatar_key', 'location_precision']))
  })

  it('表示名とアイコンは保存でき、氏名は返さない', async () => {
    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ', avatarKey: `avatars/${USER_ID}/icon.webp` })

    expect(row.displayName).toBe('さくらママ')
    expect(row.avatarKey).toBe(`avatars/${USER_ID}/icon.webp`)
    expect(Object.keys(row)).not.toContain('fullName')
  })

  it('「粗く保存」にすると、保存済みの通学路からも道すじを消し、起点・終点を約10kmに丸める', async () => {
    database.sqlite.prepare(`insert into user_routes (id, user_id, name, start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry)
      values ('r1', ?, '通学路', 35.69, 139.69, 35.68, 139.77, '〒160-0023 東京都新宿区西新宿2丁目8-1', '東京都千代田区', '{"type":"LineString","coordinates":[[139.69,35.69],[139.77,35.68]]}')`).run(USER_ID)
    database.sqlite.prepare(`insert into user_routes (id, user_id, name, start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry)
      values ('other', 'someone-else', '通学路', 35.69, 139.69, 35.68, 139.77, 'A', 'B', '{"type":"LineString","coordinates":[[139.69,35.69],[139.77,35.68]]}')`).run()

    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { locationPrecision: 'coarse' })

    expect(row.locationPrecision).toBe('coarse')
    expect(toProfileJson(row).location_precision).toBe('coarse')
    // 以前に保存した番地つきの住所も、市区町村までにする
    expect(database.sqlite.prepare('select start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry from user_routes where id = ?').get('r1'))
      .toEqual({ start_lat: 35.7, start_lng: 139.7, end_lat: 35.7, end_lng: 139.8, start_address: '東京都新宿区', end_address: '東京都千代田区', route_geometry: null })
    expect((database.sqlite.prepare('select route_geometry from user_routes where id = ?').get('other') as { route_geometry: string | null }).route_geometry).not.toBeNull()
  })

  it('位置の保存のしかたは standard と coarse だけ', async () => {
    await expect(createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { locationPrecision: 'exact' as never }))
      .rejects.toThrow('Invalid location precision')
  })

  it('API に返す JSON に氏名の項目を含めない', async () => {
    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })
    // 以前の行の形(氏名つき)が渡っても、JSON には出さない
    const legacyRow = { ...row, fullName: '山田 花子' }
    const json = toProfileJson(legacyRow)

    expect(json).not.toHaveProperty('full_name')
    expect(JSON.stringify(json)).not.toContain('山田')
    expect(json.display_name).toBe('さくらママ')
  })
})
