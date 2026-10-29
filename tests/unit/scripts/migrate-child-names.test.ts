// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import {
  CHILD_MIGRATION_CONFIRM_ENV,
  legacyNicknameOf,
  main,
  planChildMigration,
} from '@/scripts/ops/migrate-child-names'

import { createFakeWrangler, createTestDeps } from './ops-fake-wrangler'

let database: TestDatabase

function addRoute(id: string, userId: string, childId: string | null, childName: string | null) {
  database.sqlite.prepare(`insert into user_routes (id, user_id, name, child_id, child_name, start_lat, start_lng, end_lat, end_lng, start_address, end_address)
    values (?, ?, '通学路', ?, ?, 35.68, 139.76, 35.69, 139.77, '自宅', '学校')`).run(id, userId, childId, childName)
}

function addSession(id: string, userId: string, routeId: string, childId: string | null, childName: string | null) {
  database.sqlite.prepare(`insert into route_learning_sessions (id, user_id, route_id, session_id, child_id, child_name, started_at)
    values (?, ?, ?, ?, ?, ?, '2026-10-01T00:00:00.000Z')`).run(id, userId, routeId, `${id}-session`, childId, childName)
}

function rows<T>(sql: string): T[] {
  return database.sqlite.prepare(sql).all() as T[]
}

beforeEach(() => {
  database = createTestDatabase()
  addRoute('r1', 'user-1', 'child-さくら', 'さくら')
  addRoute('r2', 'user-1', 'child-さくら', 'さくら')
  addRoute('r3', 'user-1', 'child-だいち', null)
  addRoute('r4', 'user-2', 'child-さくら', 'さくら')
  addRoute('r5', 'user-2', null, null)
  addSession('s1', 'user-1', 'r1', 'child-さくら', 'さくら')
  addSession('s2', 'user-2', 'r5', null, null)
})

afterEach(() => {
  database.sqlite.close()
})

describe('migrate-child-names の計画', () => {
  it('child_name が無ければ「child-名前」の id から呼び名を作る', () => {
    expect(legacyNicknameOf({ id: 'r', userId: 'u', childId: 'child-だいち', childName: null })).toBe('だいち')
    expect(legacyNicknameOf({ id: 'r', userId: 'u', childId: 'uuid', childName: '  ' })).toBe('')
  })

  it('人ごと・呼び名ごとに1行だけ作り、すでにある呼び名は使い回す', () => {
    let next = 0
    const plan = planChildMigration(
      [
        { id: 'r1', userId: 'u1', childId: null, childName: 'さくら' },
        { id: 'r2', userId: 'u1', childId: null, childName: 'さくら' },
        { id: 'r3', userId: 'u2', childId: null, childName: 'さくら' },
        { id: 'r4', userId: 'u1', childId: null, childName: 'だいち' },
      ],
      [{ id: 'existing-daichi', userId: 'u1', nickname: 'だいち' }],
      () => `new-${++next}`,
    )

    expect(plan.newChildren).toEqual([
      { id: 'new-1', userId: 'u1', nickname: 'さくら' },
      { id: 'new-2', userId: 'u2', nickname: 'さくら' },
    ])
    expect(plan.routeUpdates.map((update) => update.childId)).toEqual(['new-1', 'new-1', 'new-2', 'existing-daichi'])
  })

  it('1人10人を超える分は作らず、通学路の指定を外す', () => {
    const routes = Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, userId: 'u1', childId: null, childName: `子${index}` }))
    const plan = planChildMigration(routes, [])

    expect(plan.newChildren).toHaveLength(10)
    expect(plan.droppedOverLimit).toBe(2)
    expect(plan.routeUpdates.slice(10).map((update) => update.childId)).toEqual([null, null])
  })
})

describe('migrate-child-names main', () => {
  it('ドライランは件数だけを表示し、何も書き換えない(名前は出さない)', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner })

    expect(await main([], deps)).toBe(0)

    const output = [...deps.lines, ...deps.errors].join('\n')
    expect(output).toContain('名前が残っている通学路: 4 件(2 人) / 学習の記録: 1 件')
    expect(output).toContain('作る呼び名: 3 件')
    for (const secret of ['さくら', 'だいち', 'user-1', 'r1']) expect(output).not.toContain(secret)
    expect(rows('select * from children')).toEqual([])
  })

  it('--apply だけでは書き換えない', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner })
    expect(await main(['--apply'], deps)).toBe(1)
    expect(rows('select * from children')).toEqual([])
  })

  it('--apply と確認で、呼び名を未確認のまま移し、通学路と学習の記録から名前を消す', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [CHILD_MIGRATION_CONFIRM_ENV]: 'yes' } })

    expect(await main(['--apply'], deps)).toBe(0)

    const children = rows<{ id: string; user_id: string; nickname: string; nickname_confirmed_at: string | null }>(
      'select id, user_id, nickname, nickname_confirmed_at from children order by user_id, nickname',
    )
    expect(children.map(({ user_id, nickname, nickname_confirmed_at }) => ({ user_id, nickname, nickname_confirmed_at }))).toEqual([
      { user_id: 'user-1', nickname: 'さくら', nickname_confirmed_at: null },
      { user_id: 'user-1', nickname: 'だいち', nickname_confirmed_at: null },
      { user_id: 'user-2', nickname: 'さくら', nickname_confirmed_at: null },
    ])
    const sakura1 = children.find((child) => child.user_id === 'user-1' && child.nickname === 'さくら')!.id
    const routes = rows<{ id: string; child_id: string | null; child_name: string | null }>('select id, child_id, child_name from user_routes order by id')
    expect(routes.find((route) => route.id === 'r1')).toEqual({ id: 'r1', child_id: sakura1, child_name: null })
    expect(routes.find((route) => route.id === 'r2')?.child_id).toBe(sakura1)
    expect(routes.find((route) => route.id === 'r4')?.child_id).not.toBe(sakura1)
    expect(routes.every((route) => route.child_name === null && !route.child_id?.startsWith('child-'))).toBe(true)
    expect(rows('select child_id, child_name from route_learning_sessions where id = \'s1\'')).toEqual([{ child_id: sakura1, child_name: null }])
    expect(deps.lines.join('\n')).toContain('数え直し: 名前が残っている通学路 0 件 / 学習の記録 0 件')
  })

  it('流し直しても同じ呼び名を二重に作らない', async () => {
    const env = { [CHILD_MIGRATION_CONFIRM_ENV]: 'yes' }
    expect(await main(['--apply'], createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env }))).toBe(0)
    addRoute('r6', 'user-1', 'child-さくら', 'さくら')

    expect(await main(['--apply'], createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env }))).toBe(0)

    expect(rows('select count(*) as n from children where user_id = \'user-1\' and nickname = \'さくら\'')).toEqual([{ n: 1 }])
  })
})
