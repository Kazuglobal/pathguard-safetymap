import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")

const DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
const MAX_ADDITIONAL_CONTEXT_LENGTH = Number(Deno.env.get("VLM_MAX_CONTEXT_LENGTH") ?? "1200")
const RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get("VLM_RATE_LIMIT_WINDOW_SECONDS") ?? "300")
const RATE_LIMIT_MAX_REQUESTS = Number(Deno.env.get("VLM_RATE_LIMIT_MAX_REQUESTS") ?? "10")

const IS_PRODUCTION =
  Deno.env.get("NODE_ENV") === "production" || Deno.env.get("DENO_ENV") === "production"

const ALLOWED_ORIGINS = (() => {
  const configured = parseCsvEnv(Deno.env.get("VLM_ALLOWED_ORIGINS"))
  if (configured.length > 0) {
    return configured
  }
  return IS_PRODUCTION ? [] : DEFAULT_DEV_ORIGINS
})()

const ALLOWED_IMAGE_HOSTS = parseCsvEnv(Deno.env.get("VLM_ALLOWED_IMAGE_HOSTS")).map((host) =>
  host.toLowerCase()
)

const HAZARD_CATEGORIES = new Set([
  "traffic",
  "visibility",
  "pedestrian_space",
  "barriers",
  "lighting",
  "terrain",
  "infrastructure",
  "crossings",
  "signage",
  "environmental",
  "social",
  "emergency",
  "behavioral",
  "surveillance",
  "maintenance",
])

const rateLimitStore = new Map<string, { count: number; windowStartMs: number }>()

interface AnalyzeHazardRequest {
  image_url: string
  report_id: string
  additional_context?: string
}

interface VlmHazardPayload {
  category: string
  severity: number
  description_ja: string
  description_en: string
  child_specific_risk: string
  recommendation: string
}

interface VlmAnalysisResultPayload {
  hazards: VlmHazardPayload[]
  overall_safety_score: number
  overall_risk_level: number
  child_perspective_summary: string
  time_weather_risks: {
    morning_commute?: string
    evening_return?: string
    rainy_conditions?: string
    winter_conditions?: string
  }
  improvement_suggestions: {
    immediate_actions?: string[]
    medium_term_improvements?: string[]
    community_involvement?: string[]
  }
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function resolveCorsOrigin(origin: string | null): string | null {
  if (!origin) {
    return null
  }
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

function buildCorsHeaders(allowedOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  }
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin
  }
  return headers
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      ...(extraHeaders ?? {}),
      "Content-Type": "application/json",
    },
  })
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) {
    return null
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim()
  }
  return req.headers.get("cf-connecting-ip") ?? "unknown"
}

function checkRateLimit(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStartMs >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStartMs: now })
    return { allowed: true }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStartMs + windowMs - now) / 1000))
    return { allowed: false, retryAfterSeconds }
  }

  entry.count += 1
  rateLimitStore.set(key, entry)
  return { allowed: true }
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".")
  if (parts.length !== 4) {
    return null
  }
  const numbers = parts.map((part) => Number(part))
  const valid = numbers.every((num) => Number.isInteger(num) && num >= 0 && num <= 255)
  return valid ? numbers : null
}

function isPrivateIpv4Address(parts: number[]): boolean {
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  )
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host === "::1" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true
  }
  const ipv4 = parseIpv4(host)
  return ipv4 ? isPrivateIpv4Address(ipv4) : false
}

function validateImageUrl(imageUrl: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(imageUrl)
  } catch {
    return "image_url must be a valid HTTPS URL"
  }

  if (parsed.protocol !== "https:") {
    return "image_url must use HTTPS"
  }

  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return "image_url host is not allowed"
  }

  if (ALLOWED_IMAGE_HOSTS.length > 0) {
    const host = parsed.hostname.toLowerCase()
    const isAllowed = ALLOWED_IMAGE_HOSTS.some((allowedHost) => {
      return host === allowedHost || host.endsWith(`.${allowedHost}`)
    })
    if (!isAllowed) {
      return "image_url host is not allowed"
    }
  }

  return null
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength
}

function isStringArray(value: unknown, maxItems: number, itemMaxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= itemMaxLength)
  )
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
}

function validateAnalysisPayload(payload: unknown): payload is VlmAnalysisResultPayload {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const analysis = payload as Record<string, unknown>
  if (!Array.isArray(analysis.hazards) || analysis.hazards.length > 30) {
    return false
  }

  const hazardsValid = analysis.hazards.every((hazard) => {
    if (!hazard || typeof hazard !== "object") {
      return false
    }
    const h = hazard as Record<string, unknown>
    return (
      typeof h.category === "string" &&
      HAZARD_CATEGORIES.has(h.category) &&
      isIntegerInRange(h.severity, 1, 5) &&
      isString(h.description_ja, 500) &&
      isString(h.description_en, 500) &&
      isString(h.child_specific_risk, 500) &&
      isString(h.recommendation, 500)
    )
  })

  if (!hazardsValid) {
    return false
  }

  if (!isIntegerInRange(analysis.overall_safety_score, 0, 100)) {
    return false
  }

  if (!isIntegerInRange(analysis.overall_risk_level, 1, 5)) {
    return false
  }

  if (!isString(analysis.child_perspective_summary, 2000)) {
    return false
  }

  if (!analysis.time_weather_risks || typeof analysis.time_weather_risks !== "object") {
    return false
  }

  const timeWeather = analysis.time_weather_risks as Record<string, unknown>
  const timeKeys = ["morning_commute", "evening_return", "rainy_conditions", "winter_conditions"]
  const validTimeWeather = timeKeys.every((key) => {
    const value = timeWeather[key]
    return value === undefined || isString(value, 500)
  })
  if (!validTimeWeather) {
    return false
  }

  if (!analysis.improvement_suggestions || typeof analysis.improvement_suggestions !== "object") {
    return false
  }
  const suggestions = analysis.improvement_suggestions as Record<string, unknown>
  const immediateValid =
    suggestions.immediate_actions === undefined ||
    isStringArray(suggestions.immediate_actions, 20, 300)
  const mediumValid =
    suggestions.medium_term_improvements === undefined ||
    isStringArray(suggestions.medium_term_improvements, 20, 300)
  const communityValid =
    suggestions.community_involvement === undefined ||
    isStringArray(suggestions.community_involvement, 20, 300)

  return immediateValid && mediumValid && communityValid
}

serve(async (req) => {
  const requestOrigin = req.headers.get("origin")
  const allowedOrigin = resolveCorsOrigin(requestOrigin)

  if (requestOrigin && !allowedOrigin) {
    return jsonResponse({ error: "Origin not allowed" }, 403, buildCorsHeaders(null))
  }

  const corsHeaders = buildCorsHeaders(allowedOrigin)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ANTHROPIC_API_KEY) {
      console.error("Required secrets are not configured")
      return jsonResponse({ error: "Server configuration error" }, 500, corsHeaders)
    }

    const bearerToken = extractBearerToken(req)
    if (!bearerToken) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders)
    }

    const userScopedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${bearerToken}` },
      },
    })

    const { data: authData, error: authError } = await userScopedClient.auth.getUser(bearerToken)
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders)
    }

    const rateKey = `${authData.user.id}:${getClientIp(req)}`
    const rateLimitResult = checkRateLimit(rateKey)
    if (!rateLimitResult.allowed) {
      return jsonResponse(
        { error: "Too many requests" },
        429,
        corsHeaders,
        { "Retry-After": String(rateLimitResult.retryAfterSeconds) }
      )
    }

    let requestBody: Partial<AnalyzeHazardRequest>
    try {
      const parsedBody = await req.json()
      requestBody = parsedBody && typeof parsedBody === "object" ? parsedBody : {}
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400, corsHeaders)
    }

    const imageUrl =
      typeof requestBody.image_url === "string" ? requestBody.image_url.trim() : ""
    const reportId =
      typeof requestBody.report_id === "string" ? requestBody.report_id.trim() : ""
    const additionalContext =
      typeof requestBody.additional_context === "string"
        ? requestBody.additional_context.trim()
        : ""

    if (!imageUrl || !reportId) {
      return jsonResponse({ error: "image_url and report_id are required" }, 400, corsHeaders)
    }

    if (imageUrl.length > 2048 || reportId.length > 128) {
      return jsonResponse({ error: "Invalid request payload" }, 400, corsHeaders)
    }

    if (additionalContext.length > MAX_ADDITIONAL_CONTEXT_LENGTH) {
      return jsonResponse(
        { error: `additional_context must be at most ${MAX_ADDITIONAL_CONTEXT_LENGTH} characters` },
        400,
        corsHeaders
      )
    }

    const imageUrlValidationError = validateImageUrl(imageUrl)
    if (imageUrlValidationError) {
      return jsonResponse({ error: imageUrlValidationError }, 400, corsHeaders)
    }

    const reportLookupClient = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : userScopedClient

    const { data: report, error: reportError } = await reportLookupClient
      .from("danger_reports")
      .select("id, user_id")
      .eq("id", reportId)
      .eq("user_id", authData.user.id)
      .maybeSingle()

    if (reportError) {
      console.error("Report ownership check failed:", reportError)
      return jsonResponse({ error: "Authorization check failed" }, 500, corsHeaders)
    }

    if (!report) {
      return jsonResponse({ error: "Report not found or not accessible" }, 403, corsHeaders)
    }

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 25000)
    let claudeResponse: Response

    try {
      claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "url",
                    url: imageUrl,
                  },
                },
                {
                  type: "text",
                  text: `あなたは通学路の安全分析の専門家です。添付された写真を分析し、子供の通学における危険要因を詳細に評価してください。

追加情報: ${additionalContext || "なし"}

以下のJSON形式で回答してください：

{
  "hazards": [
    {
      "category": "traffic|visibility|pedestrian_space|barriers|lighting|terrain|infrastructure|crossings|signage|environmental|social|emergency|behavioral|surveillance|maintenance",
      "severity": 1-5,
      "description_ja": "危険要因の説明（日本語）",
      "description_en": "Description in English",
      "child_specific_risk": "子供特有のリスク",
      "recommendation": "改善提案"
    }
  ],
  "overall_safety_score": 0-100,
  "overall_risk_level": 1-5,
  "child_perspective_summary": "子供視点での総合評価（日本語）",
  "time_weather_risks": {
    "morning_commute": "朝の通学時リスク",
    "evening_return": "夕方の下校時リスク",
    "rainy_conditions": "雨天時リスク",
    "winter_conditions": "冬季リスク"
  },
  "improvement_suggestions": {
    "immediate_actions": ["即座に実施すべき対策"],
    "medium_term_improvements": ["中期的な改善案"],
    "community_involvement": ["地域での取り組み"]
  }
}

重要な観点：
- 子供の身長（110-140cm）からの視点
- ランドセルや傘を持った状態での動き
- 注意力の散漫さ
- 複数の子供が同時に通行する状況
- 登下校時間帯（朝7:30-8:30、午後3:00-5:00）の特性

JSON以外の文章は出力しないでください。`,
                },
              ],
            },
          ],
        }),
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error("Claude API error:", {
        status: claudeResponse.status,
        body: errorText.slice(0, 500),
      })
      return jsonResponse({ error: "AI analysis failed" }, 502, corsHeaders)
    }

    const claudeData = await claudeResponse.json()
    const responseText =
      typeof claudeData?.content?.[0]?.text === "string" ? claudeData.content[0].text : ""
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.error("Failed to extract JSON from Claude response")
      return jsonResponse({ error: "Invalid AI response format" }, 502, corsHeaders)
    }

    let analysis: unknown
    try {
      analysis = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error("Failed to parse Claude JSON:", parseError)
      return jsonResponse({ error: "Invalid AI response format" }, 502, corsHeaders)
    }

    if (!validateAnalysisPayload(analysis)) {
      console.error("AI response schema validation failed")
      return jsonResponse({ error: "Invalid AI response schema" }, 502, corsHeaders)
    }

    return jsonResponse(
      {
        success: true,
        analysis,
        analysis_id: crypto.randomUUID(),
      },
      200,
      corsHeaders
    )
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonResponse({ error: "AI analysis timeout" }, 504, corsHeaders)
    }
    console.error("Edge Function error:", error)
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders)
  }
})
