// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createProfilesRepo } from '@/lib/db/repos/profiles.repo'
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

function storedFullName(): unknown {
  return (database.sqlite.prepare('select full_name from profiles where id = ?').get(USER_ID) as { full_name: unknown } | undefined)?.full_name
}

describe('プロフィールは氏名を預からない(UIUX改装 項目55)', () => {
  it('表示名を保存すると、以前に預かった氏名が残っていても消える', async () => {
    database.sqlite.prepare('insert into profiles (id, email, display_name, full_name) values (?, ?, ?, ?)')
      .run(USER_ID, 'parent@example.com', '前の表示名', '山田 花子')

    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })

    expect(row.displayName).toBe('さくらママ')
    expect(storedFullName()).toBeNull()
  })

  it('アイコンだけを保存しても氏名は消え、表示名はそのまま', async () => {
    database.sqlite.prepare('insert into profiles (id, email, display_name, full_name) values (?, ?, ?, ?)')
      .run(USER_ID, 'parent@example.com', 'さくらママ', '山田 花子')

    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { avatarKey: `avatars/${USER_ID}/icon.webp` })

    expect(row.displayName).toBe('さくらママ')
    expect(row.avatarKey).toBe(`avatars/${USER_ID}/icon.webp`)
    expect(storedFullName()).toBeNull()
  })

  it('新しく作る行には氏名を入れない', async () => {
    await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })
    expect(storedFullName()).toBeNull()
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
    const json = toProfileJson({ ...row, fullName: '山田 花子' })

    expect(json).not.toHaveProperty('full_name')
    expect(JSON.stringify(json)).not.toContain('山田')
    expect(json.display_name).toBe('さくらママ')
  })
})
