import { getActor } from '@/lib/auth/actor'
import { listApiBudgets, listApiUsage, updateApiBudget } from '@/lib/db/repos/ops.repo'

const VALID_PROVIDERS = ['gemini', 'openai', 'mapbox'] as const
type ApiProvider = (typeof VALID_PROVIDERS)[number]

interface ProviderCostSummary { total_cost: number; request_count: number; budget: number; alert: boolean }
type CostSummaryResult = Record<ApiProvider, ProviderCostSummary>
interface DailyBreakdownEntry { date: string; gemini: number; openai: number; mapbox: number }
interface EndpointBreakdownEntry { endpoint: string; total_cost: number; request_count: number; api_provider: string }
export interface BudgetSettingsEntry { api_provider: string; monthly_budget_usd: number; alert_threshold_percent: number }

async function adminActor() {
  const actor = await getActor()
  if (actor.kind !== 'user' || !actor.isAdmin) throw new Error('管理者権限が必要です')
  return actor
}

function buildDateRange(yearMonth: string): { start: string; endExclusive: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01T00:00:00.000Z`
  const endExclusive = new Date(Date.UTC(year, month, 1)).toISOString()
  return { start, endExclusive }
}

function createDefaultSummary(): CostSummaryResult {
  return {
    gemini: { total_cost: 0, request_count: 0, budget: 0, alert: false },
    openai: { total_cost: 0, request_count: 0, budget: 0, alert: false },
    mapbox: { total_cost: 0, request_count: 0, budget: 0, alert: false },
  }
}

async function load(yearMonth: string) {
  const actor = await adminActor()
  const { start, endExclusive } = buildDateRange(yearMonth)
  return Promise.all([listApiUsage(actor, start, endExclusive), listApiBudgets(actor)])
}

export async function getCostSummary(yearMonth: string): Promise<CostSummaryResult> {
  const [logs, budgets] = await load(yearMonth)
  const summary = createDefaultSummary()
  for (const log of logs) {
    const provider = log.apiProvider as ApiProvider
    if (!VALID_PROVIDERS.includes(provider)) continue
    summary[provider].total_cost += log.estimatedCostUsd ?? 0
    summary[provider].request_count += log.requestCount
  }
  for (const budget of budgets) {
    const provider = budget.apiProvider as ApiProvider
    if (!VALID_PROVIDERS.includes(provider)) continue
    const monthlyBudget = budget.monthlyBudgetUsd ?? 0
    const threshold = budget.alertThresholdPercent ?? 80
    summary[provider].budget = monthlyBudget
    summary[provider].alert = monthlyBudget > 0 && summary[provider].total_cost / monthlyBudget * 100 >= threshold
  }
  return summary
}

export async function getDailyBreakdown(yearMonth: string): Promise<DailyBreakdownEntry[]> {
  const [logs] = await load(yearMonth)
  const daily = new Map<string, DailyBreakdownEntry>()
  for (const log of logs) {
    const provider = log.apiProvider as ApiProvider
    const date = log.createdAt.slice(0, 10)
    const row = daily.get(date) ?? { date, gemini: 0, openai: 0, mapbox: 0 }
    if (VALID_PROVIDERS.includes(provider)) row[provider] += log.estimatedCostUsd ?? 0
    daily.set(date, row)
  }
  return [...daily.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export async function getEndpointBreakdown(yearMonth: string): Promise<EndpointBreakdownEntry[]> {
  const [logs] = await load(yearMonth)
  const endpoints = new Map<string, EndpointBreakdownEntry>()
  for (const log of logs) {
    const current = endpoints.get(log.apiEndpoint)
    endpoints.set(log.apiEndpoint, current
      ? { ...current, total_cost: current.total_cost + (log.estimatedCostUsd ?? 0), request_count: current.request_count + log.requestCount }
      : { endpoint: log.apiEndpoint, total_cost: log.estimatedCostUsd ?? 0, request_count: log.requestCount, api_provider: log.apiProvider })
  }
  return [...endpoints.values()]
}

export async function getBudgetSettings(): Promise<BudgetSettingsEntry[]> {
  return (await listApiBudgets(await adminActor())).map((row) => ({
    api_provider: row.apiProvider,
    monthly_budget_usd: row.monthlyBudgetUsd ?? 0,
    alert_threshold_percent: row.alertThresholdPercent ?? 80,
  }))
}

export async function updateBudgetSettings(
  provider: ApiProvider,
  settings: { monthly_budget_usd?: number; alert_threshold_percent?: number },
): Promise<BudgetSettingsEntry> {
  if (!VALID_PROVIDERS.includes(provider)) throw new RangeError('Invalid provider')
  const row = await updateApiBudget(await adminActor(), provider, {
    ...(settings.monthly_budget_usd !== undefined ? { monthlyBudgetUsd: settings.monthly_budget_usd } : {}),
    ...(settings.alert_threshold_percent !== undefined ? { alertThresholdPercent: settings.alert_threshold_percent } : {}),
  })
  return {
    api_provider: row.apiProvider,
    monthly_budget_usd: row.monthlyBudgetUsd ?? 0,
    alert_threshold_percent: row.alertThresholdPercent ?? 80,
  }
}
