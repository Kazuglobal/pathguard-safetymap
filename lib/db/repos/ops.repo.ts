import { and, eq, gte, lt } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { apiBudgetSettings, apiUsageLogs } from '../schema'

export interface ApiUsageLogInput {
  apiProvider: string
  apiEndpoint: string
  modelName?: string
  inputTokens?: number
  outputTokens?: number
  requestCount: number
  estimatedCostUsd: number
  success: boolean
  errorMessage?: string
}

export function createOpsRepo(db: AppDb) {
  return {
    async insertUsage(actor: Actor, input: ApiUsageLogInput) {
      assertCan(actor, 'insert', 'api_usage_logs')
      await db.insert(apiUsageLogs).values({ id: crypto.randomUUID(), ...input })
    },
    async listUsage(actor: Actor, start: string, endExclusive: string) {
      assertCan(actor, 'select', 'api_usage_logs')
      const rows: Array<typeof apiUsageLogs.$inferSelect> = []
      const pageSize = 2_000
      for (let offset = 0; ; offset += pageSize) {
        const page = await db.select().from(apiUsageLogs).where(and(
          gte(apiUsageLogs.createdAt, start), lt(apiUsageLogs.createdAt, endExclusive),
        )).limit(pageSize).offset(offset)
        rows.push(...page)
        if (page.length < pageSize) return rows
      }
    },
    async listBudgets(actor: Actor) {
      assertCan(actor, 'select', 'api_budget_settings')
      return db.select().from(apiBudgetSettings).limit(100)
    },
    async updateBudget(actor: Actor, provider: string, settings: {
      monthlyBudgetUsd?: number
      alertThresholdPercent?: number
    }) {
      assertCan(actor, 'update', 'api_budget_settings')
      const [row] = await db.update(apiBudgetSettings).set({
        ...settings, updatedAt: new Date().toISOString(),
      }).where(eq(apiBudgetSettings.apiProvider, provider)).returning()
      if (!row) throw new Error(`Budget settings not found for ${provider}`)
      return row
    },
  }
}

export function insertApiUsage(actor: Actor, input: ApiUsageLogInput) { return createOpsRepo(getDb()).insertUsage(actor, input) }
export function listApiUsage(actor: Actor, start: string, endExclusive: string) { return createOpsRepo(getDb()).listUsage(actor, start, endExclusive) }
export function listApiBudgets(actor: Actor) { return createOpsRepo(getDb()).listBudgets(actor) }
export function updateApiBudget(actor: Actor, provider: string, settings: Parameters<ReturnType<typeof createOpsRepo>['updateBudget']>[2]) { return createOpsRepo(getDb()).updateBudget(actor, provider, settings) }
