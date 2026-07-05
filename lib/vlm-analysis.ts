import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_IMAGE_URL_LENGTH = 2048
const MAX_REPORT_ID_LENGTH = 128
const MAX_ADDITIONAL_CONTEXT_LENGTH = 1200

/**
 * 15 hazard categories with Japanese labels, Lucide icon names, and Tailwind colors
 */
export const HAZARD_CATEGORY_MAP = {
  traffic: { label: "交通量/スピード", icon: "Car", color: "blue" },
  visibility: { label: "見通し", icon: "Eye", color: "yellow" },
  pedestrian_space: { label: "歩行空間", icon: "Footprints", color: "green" },
  barriers: { label: "バリア/分離", icon: "ShieldCheck", color: "indigo" },
  lighting: { label: "照明", icon: "Lightbulb", color: "amber" },
  terrain: { label: "路面/地形", icon: "Mountain", color: "stone" },
  infrastructure: { label: "インフラ状態", icon: "Construction", color: "orange" },
  crossings: { label: "横断施設", icon: "CornerDownRight", color: "teal" },
  signage: { label: "標識", icon: "TrafficCone", color: "red" },
  environmental: { label: "環境要因", icon: "Cloud", color: "sky" },
  social: { label: "社会的要因", icon: "Users", color: "purple" },
  emergency: { label: "緊急対応", icon: "AlertCircle", color: "rose" },
  behavioral: { label: "行動誘発", icon: "Brain", color: "pink" },
  surveillance: { label: "監視/防犯", icon: "Camera", color: "slate" },
  maintenance: { label: "維持管理", icon: "Wrench", color: "zinc" },
} as const

export type HazardCategory = keyof typeof HAZARD_CATEGORY_MAP

/**
 * Individual hazard detected by VLM analysis
 */
export interface VlmHazard {
  category: HazardCategory
  severity: 1 | 2 | 3 | 4 | 5
  description_ja: string
  description_en: string
  child_specific_risk: string
  recommendation: string
}

/**
 * Complete VLM analysis result
 */
export interface VlmAnalysisResult {
  hazards: VlmHazard[]
  overall_safety_score: number // 1-100 (100 = safest)
  overall_risk_level: 1 | 2 | 3 | 4 | 5 // 1 = low risk, 5 = very dangerous
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

export interface SimulationQuickSummaryData {
  summary: string
  action: string | null
  hazardKey?: SimulationHazardKey | null
}

export type SimulationHazardKey = "earthquake" | "typhoon" | "flood" | "fire"

/**
 * Request to analyze hazard image
 */
export interface AnalyzeHazardRequest {
  image_url: string
  report_id: string
  additional_context?: string
}

/**
 * Response from analyze-hazard Edge Function
 */
export interface AnalyzeHazardResponse {
  success: boolean
  analysis?: VlmAnalysisResult
  analysis_id?: string
  error?: string
}

interface ParsedFunctionError {
  message: string
  status?: number
  statusText?: string
  responseBody?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function extractErrorMessageFromBody(body: string): string | null {
  if (!body) {
    return null
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
      return parsed.error
    }
    if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
      return parsed.message
    }
    return null
  } catch {
    return null
  }
}

async function parseFunctionInvokeError(error: unknown): Promise<ParsedFunctionError> {
  const fallbackMessage = error instanceof Error ? error.message : "分析に失敗しました"

  if (!isRecord(error)) {
    return { message: fallbackMessage }
  }

  const directMessage =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  const context = error.context
  if (!(context instanceof Response)) {
    return { message: directMessage }
  }

  const status = context.status
  const statusText = context.statusText
  let responseBody = ""
  try {
    responseBody = await context.clone().text()
  } catch {
    responseBody = ""
  }

  const bodyMessage = extractErrorMessageFromBody(responseBody)
  const message =
    bodyMessage ||
    (status ? `Edge Function error (${status}${statusText ? ` ${statusText}` : ""})` : directMessage)

  return {
    message,
    status,
    statusText,
    responseBody,
  }
}

function isHazardCategory(value: unknown): value is HazardCategory {
  return typeof value === "string" && value in HAZARD_CATEGORY_MAP
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
}

function isOptionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= maxLength)
}

function isStringArray(value: unknown, maxItems: number, itemMaxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= itemMaxLength)
  )
}

function isVlmHazard(value: unknown): value is VlmHazard {
  if (!isRecord(value)) {
    return false
  }
  return (
    isHazardCategory(value.category) &&
    isIntegerInRange(value.severity, 1, 5) &&
    typeof value.description_ja === "string" &&
    typeof value.description_en === "string" &&
    typeof value.child_specific_risk === "string" &&
    typeof value.recommendation === "string"
  )
}

function isVlmAnalysisResult(value: unknown): value is VlmAnalysisResult {
  if (!isRecord(value)) {
    return false
  }

  if (!Array.isArray(value.hazards) || !value.hazards.every(isVlmHazard)) {
    return false
  }

  if (!isIntegerInRange(value.overall_safety_score, 0, 100)) {
    return false
  }

  if (!isIntegerInRange(value.overall_risk_level, 1, 5)) {
    return false
  }

  if (typeof value.child_perspective_summary !== "string") {
    return false
  }

  if (!isRecord(value.time_weather_risks)) {
    return false
  }

  const timeWeather = value.time_weather_risks
  const validTimeWeather =
    isOptionalString(timeWeather.morning_commute, 500) &&
    isOptionalString(timeWeather.evening_return, 500) &&
    isOptionalString(timeWeather.rainy_conditions, 500) &&
    isOptionalString(timeWeather.winter_conditions, 500)
  if (!validTimeWeather) {
    return false
  }

  if (!isRecord(value.improvement_suggestions)) {
    return false
  }

  const suggestions = value.improvement_suggestions
  const validSuggestions =
    (suggestions.immediate_actions === undefined ||
      isStringArray(suggestions.immediate_actions, 20, 300)) &&
    (suggestions.medium_term_improvements === undefined ||
      isStringArray(suggestions.medium_term_improvements, 20, 300)) &&
    (suggestions.community_involvement === undefined ||
      isStringArray(suggestions.community_involvement, 20, 300))

  return validSuggestions
}

/**
 * Call Supabase Edge Function to analyze hazard image using Claude Haiku Vision
 *
 * @param supabase Supabase client instance
 * @param request Analysis request parameters
 * @returns Promise resolving to analysis response
 * @throws Error if network fails or validation fails
 */
export async function analyzeHazardWithVLM(
  supabase: SupabaseClient,
  request: AnalyzeHazardRequest
): Promise<AnalyzeHazardResponse> {
  const imageUrl = request.image_url?.trim()
  const reportId = request.report_id?.trim()
  const additionalContext = (request.additional_context || "").trim()

  // Input validation
  if (!imageUrl || !reportId) {
    throw new Error("image_url and report_id are required")
  }

  if (imageUrl.length > MAX_IMAGE_URL_LENGTH || reportId.length > MAX_REPORT_ID_LENGTH) {
    throw new Error("image_url or report_id is too long")
  }

  if (additionalContext.length > MAX_ADDITIONAL_CONTEXT_LENGTH) {
    throw new Error(
      `additional_context must be at most ${MAX_ADDITIONAL_CONTEXT_LENGTH} characters`
    )
  }

  // Validate image URL format and protocol
  try {
    const parsed = new URL(imageUrl)
    if (parsed.protocol !== "https:") {
      throw new Error("image_url must use HTTPS")
    }
  } catch (err) {
    // Re-throw protocol errors, convert URL parsing errors to generic message
    if (err instanceof Error && err.message === "image_url must use HTTPS") {
      throw err
    }
    throw new Error("image_url must be a valid HTTPS URL")
  }

  // 🔧 Development mode: Return mock data when Edge Function is not deployed
  // Set NEXT_PUBLIC_VLM_USE_MOCK=true in .env.local for development
  // Deploy Edge Function: npx supabase functions deploy analyze-hazard
  const USE_MOCK_DATA = process.env.NEXT_PUBLIC_VLM_USE_MOCK === "true"

  if (USE_MOCK_DATA) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("VLM mock mode is disabled in production")
    }

    // Mock data for development only
    if (process.env.NODE_ENV === "development") {
      console.log("[VLM Mock] Using mock data for development")
    }

    // 3秒待ってモックレスポンスを返す（実際のAPI呼び出しをシミュレート）
    await new Promise((resolve) => setTimeout(resolve, 3000))

    return {
      success: true,
      analysis: {
        hazards: [
          {
            category: "traffic",
            severity: 4,
            description_ja: "交通量が多く、車のスピードが速い区間です",
            description_en: "High traffic volume with fast vehicle speeds",
            child_specific_risk: "背の低い子供は運転手から見えにくく、横断時に危険です",
            recommendation: "速度制限標識の追加と、横断歩道への信号機設置を検討してください",
          },
          {
            category: "visibility",
            severity: 3,
            description_ja: "見通しの悪い交差点があります",
            description_en: "Poor visibility at intersection",
            child_specific_risk: "曲がり角で子供が車に気づかれにくい",
            recommendation: "カーブミラーの設置と、路面標示の追加が必要です",
          },
          {
            category: "pedestrian_space",
            severity: 5,
            description_ja: "歩道が狭く、車道に近接しています",
            description_en: "Narrow sidewalk close to roadway",
            child_specific_risk: "ランドセルが車道にはみ出す危険性があります",
            recommendation: "歩道の拡幅、またはガードレールの設置が急務です",
          },
        ],
        overall_safety_score: 45,
        overall_risk_level: 4,
        child_perspective_summary:
          "この通学路は交通量が多く、歩道が狭いため子供にとって非常に危険です。特に登下校時間帯は車の往来が激しく、注意が必要です。ランドセルを背負った子供が安全に通行できるよう、早急な改善が求められます。",
        time_weather_risks: {
          morning_commute: "朝7:30-8:30は通勤ラッシュで交通量が倍増します",
          evening_return: "夕方17:00以降は薄暗くなり、視認性が低下します",
          rainy_conditions: "雨天時は傘で視界が遮られ、路面も滑りやすくなります",
          winter_conditions: "冬季は日没が早く、下校時に暗くなるため特に注意が必要です",
        },
        improvement_suggestions: {
          immediate_actions: [
            "通学時間帯の見守り活動を強化する",
            "警察に速度取締りを依頼する",
            "反射材付きランドセルカバーの配布",
          ],
          medium_term_improvements: [
            "横断歩道への押しボタン信号機の設置",
            "歩道の拡幅工事",
            "ガードレールの増設",
            "LED街灯の追加設置",
          ],
          community_involvement: [
            "地域住民による定期的なパトロール",
            "PTA主導の交通安全教室の開催",
            "自治体への改善要望書の提出",
          ],
        },
      },
      analysis_id: "mock-analysis-" + Date.now(),
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("analyze-hazard", {
      body: {
        image_url: imageUrl,
        report_id: reportId,
        additional_context: additionalContext,
      },
    })

    if (error) {
      const parsedError = await parseFunctionInvokeError(error)
      console.error("[VLM Analysis] Edge Function error:", {
        originalError: error,
        status: parsedError.status,
        statusText: parsedError.statusText,
        responseBody: parsedError.responseBody?.slice(0, 500),
      })
      return {
        success: false,
        error: parsedError.message || "分析に失敗しました",
      }
    }

    if (!data || !data.analysis) {
      return {
        success: false,
        error: "分析結果が空です",
      }
    }

    if (!isVlmAnalysisResult(data.analysis)) {
      console.error("[VLM Analysis] Invalid analysis schema:", data.analysis)
      return {
        success: false,
        error: "分析結果の形式が不正です",
      }
    }

    return {
      success: true,
      analysis: data.analysis,
      analysis_id: data.analysis_id,
    }
  } catch (err) {
    console.error("[VLM Analysis] Network error:", err)
    throw new Error(
      err instanceof Error ? err.message : "ネットワークエラーが発生しました"
    )
  }
}

/**
 * Get Badge variant based on severity level
 *
 * @param severity Severity level (1-5)
 * @returns Badge variant string
 */
export function getSeverityVariant(
  severity: 1 | 2 | 3 | 4 | 5
): "default" | "secondary" | "destructive" {
  if (severity >= 4) return "destructive"
  if (severity >= 3) return "secondary"
  return "default"
}

/**
 * Get risk level label in Japanese
 *
 * @param level Risk level (1-5)
 * @returns Japanese label
 */
export function getRiskLevelLabel(level: 1 | 2 | 3 | 4 | 5): string {
  const labels = {
    1: "低リスク",
    2: "やや注意",
    3: "要注意",
    4: "高リスク",
    5: "非常に危険",
  }
  return labels[level]
}

function getFirstNonEmptyText(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim()
      if (normalized.length > 0) {
        return normalized
      }
    }
  }
  return null
}

function parseMarkdownTableRow(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => {
      if (index === 0 || index === cells.length - 1) {
        return cell.length > 0
      }
      return true
    })
}

function isMarkdownSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isMarkdownHeaderRow(cells: string[]): boolean {
  const normalizedCells = cells.map((cell) => cell.replace(/\s+/g, ""))
  if (
    normalizedCells.includes("ハザード") ||
    normalizedCells.includes("想定リスク(例)") ||
    normalizedCells.includes("想定リスク")
  ) {
    return true
  }
  // 英語表のヘッダー行（| Hazard | Expected Risks | ... |）もデータ行として
  // 取り込まないようにスキップする。
  const lowerCells = normalizedCells.map((cell) => cell.toLowerCase())
  return lowerCells.includes("hazard") || lowerCells.some((cell) => cell.startsWith("expectedrisk"))
}

function normalizeSimulationHazardKey(value: string | null | undefined): SimulationHazardKey | null {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.includes("earthquake") || normalizedValue.includes("地震")) {
    return "earthquake"
  }
  if (
    normalizedValue.includes("typhoon") ||
    normalizedValue.includes("台風") ||
    normalizedValue.includes("強風") ||
    normalizedValue.includes("strong wind")
  ) {
    return "typhoon"
  }
  if (
    normalizedValue.includes("flood") ||
    normalizedValue.includes("冠水") ||
    normalizedValue.includes("洪水") ||
    normalizedValue.includes("heavy rain") ||
    normalizedValue.includes("heavyrain")
  ) {
    return "flood"
  }
  if (normalizedValue.includes("fire") || normalizedValue.includes("火災") || normalizedValue.includes("延焼")) {
    return "fire"
  }

  return null
}

export function extractPreSubmitSimulationQuickSummary(
  tableMarkdown: string | null | undefined
): SimulationQuickSummaryData | null {
  if (!tableMarkdown) {
    return null
  }

  const lines = tableMarkdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))

  for (const line of lines) {
    const cells = parseMarkdownTableRow(line)
    if (cells.length < 3 || isMarkdownSeparatorRow(cells) || isMarkdownHeaderRow(cells)) {
      continue
    }

    const [hazardCandidate, summaryCandidate, actionCandidate] = cells
    const summary = getFirstNonEmptyText([summaryCandidate])
    const action = getFirstNonEmptyText([actionCandidate])
    const hazardKey = normalizeSimulationHazardKey(hazardCandidate)

    if (!summary) {
      continue
    }

    return {
      summary,
      action,
      hazardKey,
    }
  }

  return null
}

function isSimulationFileName(fileName: string): boolean {
  return /(earthquake|typhoon|flood|fire)/i.test(fileName)
}

export function selectSimulationQuickSummaryImage(
  files: Array<Pick<File, "name"> | null | undefined>,
  previews: Array<string | null | undefined>,
  preferredHazardKey?: SimulationHazardKey | null
): string | null {
  const itemCount = Math.min(files.length, previews.length)

  if (preferredHazardKey) {
    for (let index = 0; index < itemCount; index += 1) {
      const file = files[index]
      const preview = previews[index]
      if (!file || !preview) {
        continue
      }

      const normalizedName = file.name.trim().toLowerCase()
      if (!normalizedName || !normalizedName.includes(preferredHazardKey)) {
        continue
      }

      return preview
    }
  }

  for (let index = 0; index < itemCount; index += 1) {
    const file = files[index]
    const preview = previews[index]
    if (!file || !preview) {
      continue
    }

    const normalizedName = file.name.trim().toLowerCase()
    if (!normalizedName || !isSimulationFileName(normalizedName)) {
      continue
    }

    return preview
  }

  return null
}

export function extractSimulationQuickSummary(
  result: VlmAnalysisResult | null | undefined
): SimulationQuickSummaryData | null {
  if (!result) {
    return null
  }

  const summary = getFirstNonEmptyText([
    result.child_perspective_summary,
    ...result.hazards.flatMap((hazard) => [hazard.child_specific_risk, hazard.description_ja]),
  ])

  const action = getFirstNonEmptyText([
    result.improvement_suggestions.immediate_actions?.[0],
    ...result.hazards.map((hazard) => hazard.recommendation),
  ])

  if (!summary) {
    return null
  }

  return {
    summary,
    action,
  }
}
