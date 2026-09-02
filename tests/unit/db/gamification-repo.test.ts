import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createGamificationRepo } from '@/lib/db/repos/gamification.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const service: Actor = { kind: 'service' }
const user: Actor = { kind: 'user', id: 'user-1', email: null, isAdmin: false }

describe('gamification D1 repository', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  it('atomically upserts points and derives levels at 500 point boundaries', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)

    await expect(repo.incrementPoints(service, 'user-1', 480)).resolves.toEqual({ points: 480, level: 1 })
    await expect(repo.incrementPoints(service, 'user-1', 20)).resolves.toEqual({ points: 500, level: 2 })
  })

  it('never allows negative point balances', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    await repo.incrementPoints(service, 'user-1', 10)
    await expect(repo.incrementPoints(service, 'user-1', -20)).resolves.toEqual({ points: 0, level: 1 })
  })

  it('applyMissionProgress accumulates progress and pays the reward exactly once', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    database.sqlite.prepare(
      'insert into missions (id, title, target_type, target_value, reward_points) values (?, ?, ?, ?, ?)',
    ).run(1, '写真ゲーム2回', 'hazard_game_play', 2, 50)
    database.sqlite.prepare(
      'insert into missions (id, title, target_type, target_value, reward_points) values (?, ?, ?, ?, ?)',
    ).run(2, '報告1回', 'report', 1, 20)

    const first = await repo.applyMissionProgress(user, service, { targetType: 'hazard_game_play' })
    expect(first.completed).toEqual([])
    const second = await repo.applyMissionProgress(user, service, { targetType: 'hazard_game_play' })
    expect(second.completed).toEqual([{ missionId: 1, title: '写真ゲーム2回', rewardPoints: 50 }])
    const third = await repo.applyMissionProgress(user, service, { targetType: 'hazard_game_play' })
    expect(third.completed).toEqual([])

    const progress = database.sqlite.prepare(
      'select progress, completed from user_mission_progress where user_id = ? and mission_id = 1',
    ).get('user-1') as { progress: number; completed: number }
    expect(progress).toEqual({ progress: 3, completed: 1 })
    // 報酬は達成の瞬間の 1 回だけ。無関係な target_type の行は触らない。
    await expect(repo.getPoints(user, 'user-1')).resolves.toMatchObject({ points: 50 })
    expect(database.sqlite.prepare('select count(*) as n from user_mission_progress').get()).toEqual({ n: 1 })
  })

  it('applyMissionProgress grants the reward badge once and survives a dangling badge id', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    database.sqlite.prepare('insert into badges (id, name) values (7, \'はじめての発見\')').run()
    database.sqlite.prepare(
      'insert into missions (id, title, target_type, target_value, reward_points, reward_badge_id) values (?, ?, ?, ?, ?, ?)',
    ).run(1, 'バッジ付き', 'hazard_game_high_score', 1, 0, '7')
    database.sqlite.prepare(
      'insert into missions (id, title, target_type, target_value, reward_points, reward_badge_id) values (?, ?, ?, ?, ?, ?)',
    ).run(2, '壊れたバッジ参照', 'hazard_game_high_score', 1, 10, '999')

    const result = await repo.applyMissionProgress(user, service, { targetType: 'hazard_game_high_score' })
    expect(result.completed.map((m) => m.missionId).sort()).toEqual([1, 2])
    expect(database.sqlite.prepare('select count(*) as n from user_badges where user_id = ? and badge_id = 7').get('user-1'))
      .toEqual({ n: 1 })
    await expect(repo.getPoints(user, 'user-1')).resolves.toMatchObject({ points: 10 })
  })

  it('applyMissionProgress refuses anonymous/service callers and bad increments', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    await expect(repo.applyMissionProgress(service, service, { targetType: 'hazard_game_play' }))
      .rejects.toThrow('A user actor is required')
    await expect(repo.applyMissionProgress(user, service, { targetType: 'hazard_game_play', increment: 0 }))
      .rejects.toBeInstanceOf(RangeError)
  })

  it('listHunterAttempts returns only hunter challenges for that user, newest first', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    const insert = database.sqlite.prepare(
      'insert into safety_quest_attempts (id, user_id, challenge_id, mode, user_markers, answer_payload, score, accuracy, points_awarded, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insert.run('a1', 'user-1', 'hunter-explore', 'private-practice', '[]', '{"photoId":"p1"}', 50, 50, 5, '2026-09-01T00:00:00.000Z')
    insert.run('a2', 'user-1', 'hunter-quiz', 'private-practice', '[]', null, 100, 100, 0, '2026-09-02T00:00:00.000Z')
    insert.run('a3', 'user-1', 'report-1', 'hazard', '[]', null, 10, 10, 0, '2026-09-03T00:00:00.000Z')
    insert.run('a4', 'user-2', 'hunter-explore', 'private-practice', '[]', null, 10, 10, 0, '2026-09-04T00:00:00.000Z')

    const rows = await repo.listHunterAttempts(user, 'user-1')
    expect(rows.map((row) => row.id)).toEqual(['a2', 'a1'])
    expect(rows[1].answerPayload).toEqual({ photoId: 'p1' })
    await expect(repo.listHunterAttempts(user, 'user-2')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects user-authored point awards', async () => {
    const repo = createGamificationRepo(database.db as unknown as AppDb)
    await expect(repo.incrementPoints(
      { kind: 'user', id: 'user-1', email: null, isAdmin: false },
      'user-1',
      10,
    )).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
