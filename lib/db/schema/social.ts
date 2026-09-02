import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'
import { dangerReports } from './reports'

export const dangerReportReactions = sqliteTable('danger_report_reactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  reactionType: text('reaction_type').notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('uq_reaction_user_report_type').on(table.userId, table.reportId, table.reactionType),
  index('idx_reactions_report').on(table.reportId),
])

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  reportId: text('report_id').references(() => dangerReports.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  link: text('link'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  index('idx_notifications_user_read_created').on(table.userId, table.isRead, table.createdAt),
])

export const reportComments = sqliteTable('report_comments', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  parentCommentId: text('parent_comment_id'),
  content: text('content').notNull(),
  isEdited: integer('is_edited', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_comments_report_created').on(table.reportId, table.createdAt),
  index('idx_comments_user').on(table.userId),
])

export const reportLikes = sqliteTable('report_likes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('uq_report_likes_user_report').on(table.userId, table.reportId),
  index('idx_report_likes_report').on(table.reportId),
])

export const reportBookmarks = sqliteTable('report_bookmarks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('uq_report_bookmarks_user_report').on(table.userId, table.reportId),
  index('idx_report_bookmarks_report').on(table.reportId),
])

export const reportShares = sqliteTable('report_shares', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  platform: text('platform').notNull(),
  createdAt: createdAt(),
}, (table) => [
  index('idx_report_shares_report').on(table.reportId),
  check('report_share_platform', sql`${table.platform} in ('twitter','facebook','line','clipboard','other')`),
])

export const reportFlags = sqliteTable('report_flags', {
  id: text('id').primaryKey(),
  reporterUserId: text('reporter_user_id').notNull(),
  targetReportId: text('target_report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_report_flags_target').on(table.targetReportId),
  index('idx_report_flags_reporter').on(table.reporterUserId),
  check('report_flags_reason_length', sql`${table.reason} is null or length(${table.reason}) <= 500`),
])
