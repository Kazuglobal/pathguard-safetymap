import type { SupabaseClient } from "@supabase/supabase-js"

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
  // Input validation
  if (!request.image_url || !request.report_id) {
    throw new Error("image_url and report_id are required")
  }

  // Validate image URL format and protocol
  try {
    const parsed = new URL(request.image_url)
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
        image_url: request.image_url,
        report_id: request.report_id,
        additional_context: request.additional_context || "",
      },
    })

    if (error) {
      console.error("[VLM Analysis] Edge Function error:", error)
      return {
        success: false,
        error: error.message || "分析に失敗しました",
      }
    }

    if (!data || !data.analysis) {
      return {
        success: false,
        error: "分析結果が空です",
      }
    }

    return {
      success: true,
      analysis: data.analysis as VlmAnalysisResult,
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
