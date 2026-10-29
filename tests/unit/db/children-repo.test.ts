// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import {
  createChildrenRepo,
  legacyChildNameToNickname,
  MAX_CHILDREN_PER_USER,
  normalizeChildNickname,
} from '@/lib/db/repos/children.repo'
import { createRoutesRepo } from '@/lib/db/repos/routes.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { toUserRouteJson } from '@/lib/route-api'

const owner: Actor = { kind: 'user', id: 'user-1', email: 'owner@example.com', isAdmin: false }
const other: Actor = { kind: 'user', id: 'user-2', email: 'other@example.com', isAdmin: false }
const admin: Actor = { kind: 'user', id: 'admin-1', email: 'admin@example.com', isAdmin: true }

const ROUTE_INPUT = {
  name: '登校ルート', startLat: 35.68, startLng: 139.76, endLat: 35.69, endLng: 139.77,
  startAddress: '自宅', endAddress: '学校',
}

let database: TestDatabase
let db: AppDb

beforeEach(() => {
  database = createTestDatabase()
  db = database.db as unknown as AppDb
  database.sqlite.prepare(`insert into school_districts (id, municipality_code, school_code, prefecture, city, name, source_url, data_year)
    values ('district-a', '13104', 'A1', '東京都', '新宿区', '第一小学校区', 'https://nlftp.mlit.go.jp/', 2023)`).run()
})

afterEach(() => {
  database.sqlite.close()
})

function routeRow(id: string) {
  return database.sqlite.prepare('select child_id, child_name from user_routes where id = ?').get(id) as { child_id: string | null; child_name: string | null }
}

describe('呼び名の正規化', () => {
  it('全角の空白・半角カナを揃え、前後の空白を落とす(タブも空白として扱う)', () => {
    expect(normalizeChildNickname('　ｻｸちゃん　 ')).toBe('サクちゃん')
    expect(normalizeChildNickname('さく\tちゃん')).toBe('さく ちゃん')
  })

  it('以前の長い名前は20文字(コードポイント)に収める', () => {
    expect(legacyChildNameToNickname('あ'.repeat(30))).toBe('あ'.repeat(20))
    expect([...legacyChildNameToNickname('🌸'.repeat(25))]).toHaveLength(20)
  })
})

describe('children repo(本人だけが読み書きできる)', () => {
  it('登録した呼び名・学年・学区を本人の一覧にだけ返す', async () => {
    const repo = createChildrenRepo(db)
    const child = await repo.create(owner, { nickname: 'さくちゃん', grade: 3, schoolDistrictId: 'district-a' })

    expect(child.nicknameConfirmedAt).not.toBeNull()
    const [listed] = await repo.list(owner)
    expect(listed).toMatchObject({ nickname: 'さくちゃん', grade: 3, schoolDistrictName: '第一小学校区', schoolDistrictCity: '新宿区' })
    expect(await repo.list(other)).toEqual([])
    expect(await repo.getOwn(other, child.id)).toBeNull()
  })

  it('管理者にも他人の子どもは見せず、書き換えさせない', async () => {
    const repo = createChildrenRepo(db)
    const child = await repo.create(owner, { nickname: 'さくちゃん' })

    expect(await repo.getOwn(admin, child.id)).toBeNull()
    expect(await repo.update(admin, child.id, { nickname: 'のっとり' })).toBeNull()
    expect(await repo.delete(admin, child.id)).toBe(false)
    expect((await repo.list(owner))[0]?.nickname).toBe('さくちゃん')
  })

  it.each([
    ['', 'Invalid child nickname'],
    ['あ'.repeat(21), 'Invalid child nickname'],
    ['bell\u0007name', 'Invalid child nickname'],
  ])('呼び名 %j は登録しない', async (nickname, message) => {
    await expect(createChildrenRepo(db).create(owner, { nickname })).rejects.toThrow(message)
  })

  it('学年は1〜6、学区は実在するものだけ', async () => {
    const repo = createChildrenRepo(db)
    await expect(repo.create(owner, { nickname: 'a', grade: 7 })).rejects.toThrow('Invalid child grade')
    await expect(repo.create(owner, { nickname: 'a', grade: 2.5 })).rejects.toThrow('Invalid child grade')
    await expect(repo.create(owner, { nickname: 'a', schoolDistrictId: 'no-such-district' })).rejects.toThrow('Unknown school district')
  })

  it('同じ人の中で同じ呼び名は重ねない。上限は10人', async () => {
    const repo = createChildrenRepo(db)
    await repo.create(owner, { nickname: 'さくちゃん' })
    await expect(repo.create(owner, { nickname: ' さくちゃん ' })).rejects.toThrow('Child nickname already exists')
    await expect(repo.create(other, { nickname: 'さくちゃん' })).resolves.toMatchObject({ userId: 'user-2' })

    for (let index = 1; index < MAX_CHILDREN_PER_USER; index += 1) await repo.create(owner, { nickname: `子${index}` })
    await expect(repo.create(owner, { nickname: 'もうひとり' })).rejects.toThrow('Too many children')
  })

  it('呼び名を書き直すか「このままでよい」で、確認済みになる', async () => {
    const repo = createChildrenRepo(db)
    const migrated = await repo.findOrCreateByNickname(owner, 'さくら', { confirmed: false })
    expect(migrated.nicknameConfirmedAt).toBeNull()

    expect((await repo.update(owner, migrated.id, { confirmNickname: true }))?.nicknameConfirmedAt).not.toBeNull()

    const other1 = await repo.findOrCreateByNickname(owner, 'だいち', { confirmed: false })
    const renamed = await repo.update(owner, other1.id, { nickname: 'だいくん' })
    expect(renamed).toMatchObject({ nickname: 'だいくん' })
    expect(renamed?.nicknameConfirmedAt).not.toBeNull()
  })

  it('子どもを消すと、通学路は残して子どもの指定だけを外す', async () => {
    const routes = createRoutesRepo(db)
    const route = await routes.create(owner, { ...ROUTE_INPUT, childNickname: 'さくちゃん' })
    const childId = route.childId!

    expect(await createChildrenRepo(db).delete(owner, childId)).toBe(true)

    expect(routeRow(route.id)).toEqual({ child_id: null, child_name: null })
    expect(await createChildrenRepo(db).list(owner)).toEqual([])
  })
})

describe('通学路と子ども(通学路には呼び名を書かない)', () => {
  it('入力欄の呼び名から子どもを作って結びつけ、通学路の child_name は空のまま', async () => {
    const routes = createRoutesRepo(db)
    const route = await routes.create(owner, { ...ROUTE_INPUT, childNickname: ' さくちゃん ' })

    expect(routeRow(route.id).child_name).toBeNull()
    expect(route.childNickname).toBe('さくちゃん')
    expect(toUserRouteJson(route).child_name).toBe('さくちゃん')
    const [child] = await createChildrenRepo(db).list(owner)
    expect(child).toMatchObject({ id: route.childId, nickname: 'さくちゃん' })
  })

  it('同じ呼び名の通学路は同じ子どもを指す', async () => {
    const routes = createRoutesRepo(db)
    const first = await routes.create(owner, { ...ROUTE_INPUT, childNickname: 'さくちゃん' })
    const second = await routes.create(owner, { ...ROUTE_INPUT, name: '下校ルート', childNickname: 'さくちゃん' })

    expect(second.childId).toBe(first.childId)
    expect(await createChildrenRepo(db).list(owner)).toHaveLength(1)
  })

  it('以前の「child-名前」形式の id や他人の子どもの id は捨てる', async () => {
    const otherChild = await createChildrenRepo(db).create(other, { nickname: 'よそのこ' })
    const routes = createRoutesRepo(db)

    const legacy = await routes.create(owner, { ...ROUTE_INPUT, childId: 'child-さくら' })
    const foreign = await routes.create(owner, { ...ROUTE_INPUT, childId: otherChild.id })

    expect(routeRow(legacy.id).child_id).toBeNull()
    expect(routeRow(foreign.id).child_id).toBeNull()
  })

  it('呼び名を空にすると子どもの指定を外す', async () => {
    const routes = createRoutesRepo(db)
    const route = await routes.create(owner, { ...ROUTE_INPUT, childNickname: 'さくちゃん' })

    const updated = await routes.update(owner, route.id, { childNickname: '' })

    expect(updated?.childId).toBeNull()
    expect(toUserRouteJson(updated!).child_name).toBeNull()
  })

  it('移行前の通学路(名前が残っている)は、ほかの項目を保存したときに未確認の呼び名へ移す', async () => {
    database.sqlite.prepare(`insert into user_routes (id, user_id, name, child_id, child_name, start_lat, start_lng, end_lat, end_lng, start_address, end_address)
      values ('legacy-route', 'user-1', '古いルート', 'child-さくら', 'さくら', 35.68, 139.76, 35.69, 139.77, '自宅', '学校')`).run()
    const routes = createRoutesRepo(db)
    expect(toUserRouteJson((await routes.getById(owner, 'legacy-route'))!).child_name).toBe('さくら')

    const updated = await routes.update(owner, 'legacy-route', { name: '新しい名前' })

    expect(routeRow('legacy-route').child_name).toBeNull()
    expect(updated?.childNickname).toBe('さくら')
    const [child] = await createChildrenRepo(db).list(owner)
    expect(child).toMatchObject({ id: updated?.childId, nickname: 'さくら', nicknameConfirmedAt: null })
  })

  it('学習の記録には子どもの名前を残さず、id は本人の子どものものだけ', async () => {
    const routes = createRoutesRepo(db)
    const route = await routes.create(owner, { ...ROUTE_INPUT, childNickname: 'さくちゃん' })
    const base = {
      id: '', userId: 'user-1', routeId: route.id, schemaVersion: 1, startedAt: '2026-10-29T00:00:00.000Z',
      completedAt: null, reviewedCount: 0, savedCount: 0, quizScore: 0, quizTotal: 0, checklist: [], stopResults: [],
    }

    const own = await routes.upsertLearningSession(owner, { ...base, sessionId: 's1', childId: route.childId, childName: 'さくら' })
    const legacy = await routes.upsertLearningSession(owner, { ...base, sessionId: 's2', childId: 'child-さくら', childName: 'さくら' })

    expect(own).toMatchObject({ childId: route.childId, childName: null })
    expect(legacy).toMatchObject({ childId: null, childName: null })
  })
})
