import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_PROVIDERS = ['gemini', 'openai', 'mapbox'] as const
type ApiProvider = (typeof VALID_PROVIDERS)[number]

interface ProviderCostSummary {
  total_cost: number
  request_count: number
  budget: number
  alert: boolean
}

type CostSummaryResult = Record<ApiProvider, ProviderCostSummary>

interface DailyBreakdownEntry {
  date: string
  gemini: number
  openai: number
  mapbox: number
}

interface EndpointBreakdownEntry {
  endpoint: string
  total_cost: number
  request_count: number
  api_provider: string
}

interface BudgetSettingsEntry {
  api_provider: string
  monthly_budget_usd: number
  alert_threshold_percent: number
}

interface UsageLogRow {
  api_provider: string
  api_endpoint: string
  estimated_cost_usd: number
  request_count: number
  created_at: string
}

// The api_usage_logs / api_budget_settings tables are not yet in the
// generated Supabase types.  Cast to `any` to bypass the overload check,
// then cast the returned rows to our local interfaces.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

function buildDateRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function createDefaultSummary(): CostSummaryResult {
  return {
    gemini: { total_cost: 0, request_count: 0, budget: 0, alert: false },
    openai: { total_cost: 0, request_count: 0, budget: 0, alert: false },
    mapbox: { total_cost: 0, request_count: 0, budget: 0, alert: false },
  }
}

export async function getCostSummary(yearMonth: string): Promise<CostSummaryResult> {
  const { start, end } = buildDateRange(yearMonth)

  // Budget settings are fetched first (simple select)
  const { data: budgetData, error: budgetError } = await db
    .from('api_budget_settings')
    .select('api_provider, monthly_budget_usd, alert_threshold_percent')

  if (budgetError) {
    throw new Error(`Failed to fetch budget settings: ${budgetError.message}`)
  }

  // Usage logs are fetched with date range filters
  const { data: usageLogs, error: usageError } = await db
    .from('api_usage_logs')
    .select('api_provider, estimated_cost_usd, request_count')
    .gte('created_at', start)
    .lte('created_at', end)

  if (usageError) {
    throw new Error(`Failed to fetch usage logs: ${usageError.message}`)
  }

  const summary = createDefaultSummary()

  const logs = (usageLogs ?? []) as UsageLogRow[]
  for (const log of logs) {
    const provider = log.api_provider as ApiProvider
    if (VALID_PROVIDERS.includes(provider)) {
      summary[provider] = {
        ...summary[provider],
        total_cost: summary[provider].total_cost + (log.estimated_cost_usd ?? 0),
        request_count: summary[provider].request_count + (log.request_count ?? 0),
      }
    }
  }

  const budgets = (budgetData ?? []) as BudgetSettingsEntry[]
  for (const budget of budgets) {
    const provider = budget.api_provider as ApiProvider
    if (VALID_PROVIDERS.includes(provider)) {
      const monthlyBudget = budget.monthly_budget_usd ?? 0
      const thresholdPercent = budget.alert_threshold_percent ?? 80
      const usagePercent = monthlyBudget > 0
        ? (summary[provider].total_cost / monthlyBudget) * 100
        : 0

      summary[provider] = {
        ...summary[provider],
        budget: monthlyBudget,
        alert: usagePercent >= thresholdPercent,
      }
    }
  }

  return summary
}

export async function getDailyBreakdown(yearMonth: string): Promise<DailyBreakdownEntry[]> {
  const { start, end } = buildDateRange(yearMonth)

  const { data: usageLogs, error } = await db
    .from('api_usage_logs')
    .select('created_at, api_provider, estimated_cost_usd, request_count')
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) {
    throw new Error(`Failed to fetch usage logs: ${error.message}`)
  }

  const logs = (usageLogs ?? []) as UsageLogRow[]
  const dailyMap = new Map<string, DailyBreakdownEntry>()

  for (const log of logs) {
    const date = log.created_at.substring(0, 10)
    const provider = log.api_provider as ApiProvider

    const existing = dailyMap.get(date) ?? {
      date,
      gemini: 0,
      openai: 0,
      mapbox: 0,
    }

    if (VALID_PROVIDERS.includes(provider)) {
      const updated: DailyBreakdownEntry = {
        ...existing,
        [provider]: existing[provider] + (log.estimated_cost_usd ?? 0),
      }
      dailyMap.set(date, updated)
    } else {
      dailyMap.set(date, existing)
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getEndpointBreakdown(yearMonth: string): Promise<EndpointBreakdownEntry[]> {
  const { start, end } = buildDateRange(yearMonth)

  const { data: usageLogs, error } = await db
    .from('api_usage_logs')
    .select('api_endpoint, api_provider, estimated_cost_usd, request_count')
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) {
    throw new Error(`Failed to fetch usage logs: ${error.message}`)
  }

  const logs = (usageLogs ?? []) as UsageLogRow[]
  const endpointMap = new Map<string, EndpointBreakdownEntry>()

  for (const log of logs) {
    const endpoint = log.api_endpoint as string
    const existing = endpointMap.get(endpoint)

    if (existing) {
      endpointMap.set(endpoint, {
        ...existing,
        total_cost: existing.total_cost + (log.estimated_cost_usd ?? 0),
        request_count: existing.request_count + (log.request_count ?? 0),
      })
    } else {
      endpointMap.set(endpoint, {
        endpoint,
        total_cost: log.estimated_cost_usd ?? 0,
        request_count: log.request_count ?? 0,
        api_provider: log.api_provider as string,
      })
    }
  }

  return Array.from(endpointMap.values())
}

export async function getBudgetSettings(): Promise<BudgetSettingsEntry[]> {
  const { data, error } = await db
    .from('api_budget_settings')
    .select('api_provider, monthly_budget_usd, alert_threshold_percent')

  if (error) {
    throw new Error(`Failed to fetch budget settings: ${error.message}`)
  }

  return (data ?? []) as BudgetSettingsEntry[]
}

export async function updateBudgetSettings(
  provider: ApiProvider,
  settings: { monthly_budget_usd?: number; alert_threshold_percent?: number }
): Promise<BudgetSettingsEntry> {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Invalid provider: ${provider}. Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }

  const { data, error } = await db
    .from('api_budget_settings')
    .update(settings)
    .eq('api_provider', provider)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update budget settings: ${error.message}`)
  }

  return data as BudgetSettingsEntry
}
