/**
 * API Cost Calculator
 *
 * Calculates costs for Gemini, OpenAI, and Mapbox API usage
 * based on current published pricing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelPricing {
  readonly inputPer1kTokens: number
  readonly outputPer1kTokens: number
}

interface CalculateCostParams {
  readonly provider: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
}

interface MapboxEndpointPricing {
  readonly freeTier: number
  readonly costPer1kAfterFree: number
}

// ---------------------------------------------------------------------------
// Pricing constants
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_PRICING: ModelPricing = {
  inputPer1kTokens: 0.001,
  outputPer1kTokens: 0.002,
} as const

export const API_PRICING = {
  gemini: {
    'gemini-2.5-flash-image': {
      inputPer1kTokens: 0.00015,
      outputPer1kTokens: 0.03,
    },
    'gemini-3-pro-image-preview': {
      inputPer1kTokens: 0.0025,
      outputPer1kTokens: 0.01,
    },
    'gemini-2.5-flash': {
      inputPer1kTokens: 0.00015,
      outputPer1kTokens: 0.0006,
    },
  },
  openai: {
    'gpt-4o': {
      inputPer1kTokens: 0.005,
      outputPer1kTokens: 0.015,
    },
  },
  mapbox: {
    directions: {
      freeTier: 100_000,
      costPer1kAfterFree: 5,
    },
    geocode: {
      freeTier: 100_000,
      costPer1kAfterFree: 5,
    },
  },
} as const

// ---------------------------------------------------------------------------
// Model pricing lookup
// ---------------------------------------------------------------------------

/**
 * Returns the per-1K-token pricing for the given provider and model.
 * Falls back to a sensible default when the model is unknown.
 */
export function getModelPricing(provider: string, model: string): ModelPricing {
  const providerPricing =
    (API_PRICING as unknown as Record<string, Record<string, unknown>>)[
      provider
    ] ?? {}
  const entry = providerPricing[model]

  if (
    entry != null &&
    typeof entry === 'object' &&
    'inputPer1kTokens' in entry &&
    'outputPer1kTokens' in entry
  ) {
    const modelPricing = entry as ModelPricing
    return {
      inputPer1kTokens: modelPricing.inputPer1kTokens,
      outputPer1kTokens: modelPricing.outputPer1kTokens,
    }
  }

  return { ...DEFAULT_MODEL_PRICING }
}

// ---------------------------------------------------------------------------
// Token cost calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the USD cost for a given number of input / output tokens.
 */
export function calculateCost({
  provider,
  model,
  inputTokens,
  outputTokens,
}: CalculateCostParams): number {
  const safeInput = Math.max(0, inputTokens)
  const safeOutput = Math.max(0, outputTokens)

  if (safeInput === 0 && safeOutput === 0) {
    return 0
  }

  const pricing = getModelPricing(provider, model)
  const inputCost = (safeInput / 1000) * pricing.inputPer1kTokens
  const outputCost = (safeOutput / 1000) * pricing.outputPer1kTokens

  return inputCost + outputCost
}

// ---------------------------------------------------------------------------
// Mapbox cost calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the USD cost for Mapbox API usage, accounting for the free tier.
 */
export function calculateMapboxCost(
  endpoint: string,
  requestCount: number,
): number {
  if (requestCount <= 0) {
    return 0
  }

  const endpointPricing =
    (API_PRICING.mapbox as Record<string, MapboxEndpointPricing>)[endpoint]

  if (!endpointPricing) {
    return 0
  }

  const billableRequests = Math.max(0, requestCount - endpointPricing.freeTier)

  if (billableRequests === 0) {
    return 0
  }

  return (billableRequests / 1000) * endpointPricing.costPer1kAfterFree
}

// ---------------------------------------------------------------------------
// Monthly projection
// ---------------------------------------------------------------------------

/**
 * Estimates the total monthly cost based on current spend and the day of month.
 *
 * Formula: (currentCost / dayOfMonth) * daysInCurrentMonth
 */
export function estimateMonthlyProjection(
  currentCost: number,
  dayOfMonth: number,
): number {
  if (currentCost === 0 || dayOfMonth <= 0) {
    return 0
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  // day 0 of next month gives the last day of this month
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (currentCost / dayOfMonth) * daysInMonth
}
