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
const IMAGE_GENERATION_ESTIMATED_COST_PER_REQUEST_USD = {
  'gemini-2.5-flash-image': 0.04,
  'gemini-3-pro-image-preview': 0.04,
  'gemini-3.1-flash-image-preview': 0.04,
  // Fallback only when the provider response does not include token usage.
  'gpt-image-2': 0.053,
  'gpt-image-1': 0.042,
} as const
const DEFAULT_IMAGE_GENERATION_ESTIMATED_COST_USD = 0.04

export type OpenAIImageGenerationUsage = {
  inputTokens: number
  inputImageTokens: number
  inputTextTokens: number
  outputTokens: number
}

const OPENAI_GPT_IMAGE_2_PRICE_PER_MILLION_TOKENS = {
  inputImage: 8,
  inputText: 5,
  outputImage: 30,
} as const

const OPENAI_GPT_IMAGE_1_PRICE_PER_MILLION_TOKENS = {
  inputImage: 10,
  inputText: 5,
  outputImage: 40,
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

/**
 * Estimates image generation cost as a per-request fixed price.
 *
 * The provider does not always return token counts for image generation,
 * so request-level estimation is used for dashboard consistency.
 */
export function estimateImageGenerationCost(model: string, requestCount = 1): number {
  const safeRequestCount = Math.max(0, requestCount)
  if (safeRequestCount === 0) {
    return 0
  }
  const perRequest =
    (IMAGE_GENERATION_ESTIMATED_COST_PER_REQUEST_USD as Record<string, number>)[model] ??
    DEFAULT_IMAGE_GENERATION_ESTIMATED_COST_USD
  return perRequest * safeRequestCount
}

/**
 * Calculates GPT Image 2 cost from token usage returned by the Images API.
 * Falls back to the request-level estimate when usage is unavailable.
 */
export function calculateOpenAIImageGenerationCost(
  model: string,
  usage?: OpenAIImageGenerationUsage,
): number {
  if (!usage) {
    return estimateImageGenerationCost(model, 1)
  }

  const pricing = model.startsWith('gpt-image-2')
    ? OPENAI_GPT_IMAGE_2_PRICE_PER_MILLION_TOKENS
    : model === 'gpt-image-1'
      ? OPENAI_GPT_IMAGE_1_PRICE_PER_MILLION_TOKENS
      : null

  if (!pricing) {
    return estimateImageGenerationCost(model, 1)
  }

  const inputImageTokens = Math.max(0, usage.inputImageTokens)
  const inputTextTokens = Math.max(0, usage.inputTextTokens)
  const unclassifiedInputTokens = Math.max(
    0,
    usage.inputTokens - inputImageTokens - inputTextTokens,
  )
  const outputTokens = Math.max(0, usage.outputTokens)

  return (
    ((inputImageTokens + unclassifiedInputTokens) *
      pricing.inputImage) /
      1_000_000 +
    (inputTextTokens * pricing.inputText) /
      1_000_000 +
    (outputTokens * pricing.outputImage) /
      1_000_000
  )
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
