import { and, desc, eq, like, sql } from 'drizzle-orm'

import { HUNTER_CHALLENGE_PREFIX } from '@/lib/hunter/rewards'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { badges, missions, profiles, safetyQuestAttempts, userBadges, userMissionProgress, userPoints } from '../schema'

const POINTS_PER_LEVEL = 500

type SafetyQuestAttemptInput = Omit<typeof safetyQuestAttempts.$inferInsert, 'id' | 'userId'>

function validateIncrement(userId: string, delta: number): void {
  if (!userId || userId.length > 128) throw new RangeError('Invalid userId')
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
    throw new RangeError('delta must be a non-zero integer between -1000 and 1000')
  }
}

function isDailyAwardConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('uq_safety_quest_daily_award')
    || message.includes('safety_quest_attempts.user_id, safety_quest_attempts.challenge_id, safety_quest_attempts.mode')
}

export function createGamificationRepo(db: AppDb) {
  return {
    async getPoints(actor: Actor, userId: string) {
      assertCan(actor, 'select', 'user_points', { ownerId: userId, leaderboard: actor.kind === 'service' })
      const [row] = await db.select().from(userPoints).where(eq(userPoints.userId, userId)).limit(1)
      return row ?? null
    },

    async listMissions(actor: Actor, userId: string) {
      assertCan(actor, 'select', 'missions')
      assertCan(actor, 'select', 'user_mission_progress', { ownerId: userId })
      const [missionRows, progressRows] = await Promise.all([
        db.select().from(missions).orderBy(missions.id).limit(200),
        db.select().from(userMissionProgress).where(eq(userMissionProgress.userId, userId)).limit(200),
      ])
      return { missions: missionRows, progress: progressRows }
    },

    async listBadges(actor: Actor, userId?: string) {
      assertCan(actor, 'select', 'badges')
      const rows = await db.select().from(badges).orderBy(badges.threshold)
      if (!userId) return { badges: rows, owned: [], points: 0 }
      assertCan(actor, 'select', 'user_badges', { ownerId: userId })
      const [owned, points] = await Promise.all([
        db.select().from(userBadges).where(eq(userBadges.userId, userId)),
        this.getPoints(actor, userId),
      ])
      return { badges: rows, owned, points: points?.points ?? 0 }
    },

    async leaderboard(actor: Actor, userId?: string) {
      if (actor.kind === 'anon') throw new Error('Authentication required')
      const top = await db.select({
        userId: userPoints.userId,
        points: userPoints.points,
        level: userPoints.level,
        displayName: profiles.displayName,
      }).from(userPoints).leftJoin(profiles, eq(profiles.id, userPoints.userId))
        .orderBy(desc(userPoints.points)).limit(50)
      let mine = null
      if (userId && !top.some((row) => row.userId === userId)) {
        const [row] = await db.select({
          userId: userPoints.userId,
          points: userPoints.points,
          level: userPoints.level,
          displayName: profiles.displayName,
        }).from(userPoints).leftJoin(profiles, eq(profiles.id, userPoints.userId))
          .where(eq(userPoints.userId, userId)).limit(1)
        mine = row ?? null
      }
      return { top, mine }
    },

    async saveSafetyQuestAttempt(actor: Actor, input: SafetyQuestAttemptInput) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'safety_quest_attempts', { ownerId: actor.id })
      const [row] = await db.insert(safetyQuestAttempts).values({
        ...input, id: crypto.randomUUID(), userId: actor.id,
      }).returning()
      return row
    },

    async recordSafetyQuestAttemptAndAward(actor: Actor, serviceActor: Actor, input: SafetyQuestAttemptInput) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'safety_quest_attempts', { ownerId: actor.id })
      const requestedPoints = input.pointsAwarded ?? 0
      if (!Number.isSafeInteger(requestedPoints) || requestedPoints < 0 || requestedPoints > 1000) {
        throw new RangeError('pointsAwarded must be an integer between 0 and 1000')
      }

      const attemptId = crypto.randomUUID()
      if (requestedPoints === 0) {
        await db.insert(safetyQuestAttempts).values({ ...input, id: attemptId, userId: actor.id })
        return { attemptId, pointsAwarded: 0 }
      }

      assertCan(serviceActor, 'insert', 'user_points')
      assertCan(serviceActor, 'update', 'user_points')
      validateIncrement(actor.id, requestedPoints)
      const now = new Date().toISOString()
      try {
        // A D1 batch is atomic. The partial unique index makes a second award for the
        // same user/challenge/mode/day fail and rolls the point update back with it.
        await db.batch([
          db.insert(safetyQuestAttempts).values({ ...input, id: attemptId, userId: actor.id }),
          db.insert(userPoints).values({
            userId: actor.id,
            points: requestedPoints,
            level: Math.floor(requestedPoints / POINTS_PER_LEVEL) + 1,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: userPoints.userId,
            set: {
              points: sql<number>`${userPoints.points} + ${requestedPoints}`,
              level: sql<number>`cast((${userPoints.points} + ${requestedPoints}) / ${POINTS_PER_LEVEL} as integer) + 1`,
              updatedAt: now,
            },
          }),
        ])
        return { attemptId, pointsAwarded: requestedPoints }
      } catch (error) {
        if (!isDailyAwardConflict(error)) throw error
        const duplicateAttemptId = crypto.randomUUID()
        await db.insert(safetyQuestAttempts).values({
          ...input,
          id: duplicateAttemptId,
          userId: actor.id,
          pointsAwarded: 0,
        })
        return { attemptId: duplicateAttemptId, pointsAwarded: 0 }
      }
    },

    /**
     * ミッション進捗を進め、達成した瞬間だけ報酬ポイント/バッジを付与する。
     * - 旧 Postgres の update_mission_progress(SECURITY DEFINER) の D1 移植。進捗は累積
     *   (period=daily/weekly のリセットは user_mission_progress にキーが無いため未対応)。
     * - 「達成した瞬間」は completed=0→1 の条件付き UPDATE ... RETURNING で判定するので、
     *   同時呼び出しでも報酬は 1 回しか付かない。
     * - 報酬ポイントは service actor で user_points へ加算(authz: user_points は service のみ)。
     */
    async applyMissionProgress(
      actor: Actor,
      serviceActor: Actor,
      input: { targetType: string; increment?: number },
    ) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      const increment = input.increment ?? 1
      if (!Number.isSafeInteger(increment) || increment <= 0 || increment > 100) {
        throw new RangeError('increment must be an integer between 1 and 100')
      }
      if (!input.targetType || input.targetType.length > 64) throw new RangeError('Invalid targetType')
      assertCan(actor, 'insert', 'user_mission_progress', { ownerId: actor.id })
      assertCan(actor, 'update', 'user_mission_progress', { ownerId: actor.id })

      const targets = await db.select().from(missions).where(eq(missions.targetType, input.targetType))
      const completed: Array<{ missionId: number; title: string; rewardPoints: number }> = []
      const now = new Date().toISOString()

      for (const mission of targets) {
        await db.insert(userMissionProgress)
          .values({ userId: actor.id, missionId: mission.id, progress: 0, completed: false, updatedAt: now })
          .onConflictDoNothing()
        const [row] = await db.update(userMissionProgress)
          .set({ progress: sql<number>`${userMissionProgress.progress} + ${increment}`, updatedAt: now })
          .where(and(eq(userMissionProgress.userId, actor.id), eq(userMissionProgress.missionId, mission.id)))
          .returning({ progress: userMissionProgress.progress, completed: userMissionProgress.completed })

        const target = mission.targetValue ?? 0
        if (!row || row.completed || target <= 0 || row.progress < target) continue

        const flipped = await db.update(userMissionProgress)
          .set({ completed: true, updatedAt: now })
          .where(and(
            eq(userMissionProgress.userId, actor.id),
            eq(userMissionProgress.missionId, mission.id),
            eq(userMissionProgress.completed, false),
          ))
          .returning({ missionId: userMissionProgress.missionId })
        if (flipped.length !== 1) continue

        const reward = mission.rewardPoints ?? 0
        if (reward > 0) {
          try {
            await this.incrementPoints(serviceActor, actor.id, reward)
          } catch (error) {
            // flip 済み・未加点の状態を残さない: completed を戻して次回のプレイで再試行できるようにする。
            await db.update(userMissionProgress)
              .set({ completed: false, updatedAt: now })
              .where(and(eq(userMissionProgress.userId, actor.id), eq(userMissionProgress.missionId, mission.id)))
            throw error
          }
        }

        const badgeId = Number(mission.rewardBadgeId)
        if (mission.rewardBadgeId && Number.isSafeInteger(badgeId) && badgeId > 0) {
          assertCan(actor, 'insert', 'user_badges', { ownerId: actor.id })
          try {
            await db.insert(userBadges).values({ userId: actor.id, badgeId }).onConflictDoNothing()
          } catch (error) {
            // 存在しないバッジID(FK違反)で達成そのものを失敗させない
            console.error('mission badge award failed:', error instanceof Error ? error.message : 'unknown')
          }
        }
        completed.push({ missionId: mission.id, title: mission.title, rewardPoints: reward })
      }
      return { completed }
    },

    /**
     * きけんハンター由来の safety_quest_attempts(challenge_id が hunter- で始まる行)を新しい順に返す。
     * きろく一覧の「みつけた N/M・回数」と、写真ごとの成長表示に使う。
     */
    async listHunterAttempts(actor: Actor, userId: string) {
      assertCan(actor, 'select', 'safety_quest_attempts', { ownerId: userId })
      return db.select({
        id: safetyQuestAttempts.id,
        challengeId: safetyQuestAttempts.challengeId,
        score: safetyQuestAttempts.score,
        answerPayload: safetyQuestAttempts.answerPayload,
        pointsAwarded: safetyQuestAttempts.pointsAwarded,
        createdAt: safetyQuestAttempts.createdAt,
      })
        .from(safetyQuestAttempts)
        .where(and(eq(safetyQuestAttempts.userId, userId), like(safetyQuestAttempts.challengeId, `${HUNTER_CHALLENGE_PREFIX}%`)))
        .orderBy(desc(safetyQuestAttempts.createdAt))
        .limit(300)
    },

    async incrementPoints(actor: Actor, userId: string, delta: number) {
      assertCan(actor, 'insert', 'user_points')
      assertCan(actor, 'update', 'user_points')
      validateIncrement(userId, delta)

      const initialPoints = Math.max(0, delta)
      const now = new Date().toISOString()
      const [result] = await db.insert(userPoints).values({
        userId,
        points: initialPoints,
        level: Math.floor(initialPoints / POINTS_PER_LEVEL) + 1,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: userPoints.userId,
        set: {
          points: sql<number>`max(0, ${userPoints.points} + ${delta})`,
          level: sql<number>`cast(max(0, ${userPoints.points} + ${delta}) / ${POINTS_PER_LEVEL} as integer) + 1`,
          updatedAt: now,
        },
      }).returning({
        points: userPoints.points,
        level: userPoints.level,
      })

      if (!result) throw new Error('Failed to update user points')
      return result
    },
  }
}

export function incrementPoints(actor: Actor, userId: string, delta: number) {
  return createGamificationRepo(getDb()).incrementPoints(actor, userId, delta)
}

export function getUserPoints(actor: Actor, userId: string) { return createGamificationRepo(getDb()).getPoints(actor, userId) }
export function listUserMissions(actor: Actor, userId: string) { return createGamificationRepo(getDb()).listMissions(actor, userId) }
export function listBadges(actor: Actor, userId?: string) { return createGamificationRepo(getDb()).listBadges(actor, userId) }
export function getLeaderboard(actor: Actor, userId?: string) { return createGamificationRepo(getDb()).leaderboard(actor, userId) }
export function saveSafetyQuestAttempt(actor: Actor, input: SafetyQuestAttemptInput) {
  return createGamificationRepo(getDb()).saveSafetyQuestAttempt(actor, input)
}
export function applyMissionProgress(actor: Actor, serviceActor: Actor, input: { targetType: string; increment?: number }) {
  return createGamificationRepo(getDb()).applyMissionProgress(actor, serviceActor, input)
}
export function listHunterAttempts(actor: Actor, userId: string) {
  return createGamificationRepo(getDb()).listHunterAttempts(actor, userId)
}
export function recordSafetyQuestAttemptAndAward(actor: Actor, serviceActor: Actor, input: SafetyQuestAttemptInput) {
  return createGamificationRepo(getDb()).recordSafetyQuestAttemptAndAward(actor, serviceActor, input)
}
