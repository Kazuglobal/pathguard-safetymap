import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const apiUsageLogs = sqliteTable('api_usage_logs', {
  id: text('id').primaryKey(),
  apiProvider: text('api_provider').notNull(),
  apiEndpoint: text('api_endpoint').notNull(),
  modelName: text('model_name'),
  requestCount: integer('request_count').notNull().default(1),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCostUsd: real('estimated_cost_usd'),
  success: integer('success', { mode: 'boolean' }).notNull().default(true),
  errorMessage: text('error_message'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_api_usage_provider_created').on(table.apiProvider, table.createdAt),
  check('api_usage_request_count', sql`${table.requestCount} >= 0`),
])

export const apiBudgetSettings = sqliteTable('api_budget_settings', {
  id: text('id').primaryKey(),
  apiProvider: text('api_provider').notNull(),
  monthlyBudgetUsd: real('monthly_budget_usd'),
  alertThresholdPercent: integer('alert_threshold_percent'),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('uq_api_budget_provider').on(table.apiProvider),
  check('api_budget_amount', sql`${table.monthlyBudgetUsd} is null or ${table.monthlyBudgetUsd} >= 0`),
  check('api_budget_threshold', sql`${table.alertThresholdPercent} is null or ${table.alertThresholdPercent} between 0 and 100`),
])

export const contactMessages = sqliteTable('contact_messages', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['inquiry', 'improvement'] }).notNull(),
  message: text('message').notNull(),
  replyEmail: text('reply_email'),
  deliveryStatus: text('delivery_status', { enum: ['pending', 'sent', 'failed', 'skipped'] }).notNull().default('pending'),
  deliveryError: text('delivery_error'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_contact_messages_created').on(table.createdAt),
  index('idx_contact_messages_delivery').on(table.deliveryStatus, table.createdAt),
  check('contact_messages_kind', sql`${table.kind} in ('inquiry','improvement')`),
  check('contact_messages_message_length', sql`length(${table.message}) between 1 and 2000`),
])
