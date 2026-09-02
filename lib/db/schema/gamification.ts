import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const userPoints = sqliteTable('user_points', {
  userId: text('user_id').primaryKey(),
  points: integer('points').notNull().default(0),
  level: integer('level').notNull().default(1),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_user_points_leaderboard').on(table.points, table.level),
  check('user_points_nonnegative', sql`${table.points} >= 0 and ${table.level} >= 1`),
])

export const badges = sqliteTable('badges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon'),
  threshold: integer('threshold'),
  createdAt: createdAt(),
})

export const userBadges = sqliteTable('user_badges', {
  userId: text('user_id').notNull(),
  badgeId: integer('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }),
  acquiredAt: createdAt('acquired_at'),
}, (table) => [
  primaryKey({ columns: [table.userId, table.badgeId], name: 'pk_user_badges' }),
  index('idx_user_badges_user_acquired').on(table.userId, table.acquiredAt),
])

export const missions = sqliteTable('missions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  period: text('period'),
  targetType: text('target_type'),
  targetValue: integer('target_value'),
  rewardPoints: integer('reward_points'),
  rewardBadgeId: text('reward_badge_id'),
  createdAt: createdAt(),
})

export const userMissionProgress = sqliteTable('user_mission_progress', {
  userId: text('user_id').notNull(),
  missionId: integer('mission_id').notNull().references(() => missions.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  updatedAt: updatedAt(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.missionId], name: 'pk_user_mission_progress' }),
  check('mission_progress_nonnegative', sql`${table.progress} >= 0`),
])

export const safetyQuestAttempts = sqliteTable('safety_quest_attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  challengeId: text('challenge_id'),
  mode: text('mode').notNull(),
  userMarkers: text('user_markers', { mode: 'json' }).$type<unknown[]>().notNull().default(sql`'[]'`),
  answerPayload: text('answer_payload', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  score: integer('score').notNull().default(0),
  accuracy: integer('accuracy').notNull().default(0),
  durationMs: integer('duration_ms'),
  pointsAwarded: integer('points_awarded').notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  index('idx_safety_quest_user_created').on(table.userId, table.createdAt),
  index('idx_safety_quest_challenge').on(table.challengeId),
  check('safety_quest_mode', sql`${table.mode} in ('hazard','quiz-battle','private-practice')`),
  check('safety_quest_score', sql`${table.score} between 0 and 100 and ${table.accuracy} between 0 and 100`),
  check('safety_quest_points', sql`${table.pointsAwarded} between 0 and 1000`),
  check('safety_quest_markers_json', sql`json_valid(${table.userMarkers}) and json_type(${table.userMarkers}) = 'array'`),
  check('safety_quest_answer_json', sql`${table.answerPayload} is null or json_valid(${table.answerPayload})`),
])
