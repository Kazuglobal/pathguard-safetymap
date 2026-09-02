/**
 * API Usage Logger
 *
 * Fire-and-forget logging of API usage to the `api_usage_logs` table.
 * Automatically calculates estimated cost based on provider/model pricing.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getServiceActor } from '@/lib/auth/service-actor'
import { insertApiUsage } from '@/lib/db/repos/ops.repo'
import { calculateCost, calculateMapboxCost } from '@/lib/api-cost-calculator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiUsageEntry = {
  readonly api_provider: 'gemini' | 'openai' | 'mapbox'
  readonly api_endpoint: string
  readonly model_name?: string
  readonly input_tokens?: number
  readonly output_tokens?: number
  readonly request_count?: number
  readonly estimated_cost_usd?: number
  readonly success?: boolean
  readonly error_message?: string
}

// ---------------------------------------------------------------------------
// Cost auto-calculation
// ---------------------------------------------------------------------------

function autoCalculateCost(entry: ApiUsageEntry): number {
  if (entry.estimated_cost_usd !== undefined) {
    return entry.estimated_cost_usd
  }

  if (entry.api_provider === 'mapbox') {
    return calculateMapboxCost(
      entry.api_endpoint,
      entry.request_count ?? 1,
    )
  }

  // gemini / openai
  return calculateCost({
    provider: entry.api_provider,
    model: entry.model_name ?? '',
    inputTokens: entry.input_tokens ?? 0,
    outputTokens: entry.output_tokens ?? 0,
  })
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Logs an API usage entry to the `api_usage_logs` table.
 *
 * This is a fire-and-forget operation: it does NOT await the database insert
 * and will NOT throw if the insert fails.
 */
export function logApiUsage(entry: ApiUsageEntry): void {
  const task = insertApiUsage(getServiceActor(), {
    apiProvider: entry.api_provider,
    apiEndpoint: entry.api_endpoint,
    modelName: entry.model_name,
    inputTokens: entry.input_tokens,
    outputTokens: entry.output_tokens,
    requestCount: entry.request_count ?? 1,
    estimatedCostUsd: autoCalculateCost(entry),
    success: entry.success ?? true,
    errorMessage: entry.error_message,
  }).catch((error: unknown) => {
    console.error('[api-usage-logger] Insert failed:', error instanceof Error ? error.message : 'unknown')
  })
  try {
    getCloudflareContext().ctx.waitUntil(task)
  } catch {
    void task
  }
}
