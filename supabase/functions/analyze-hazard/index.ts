import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")

interface AnalyzeHazardRequest {
  image_url: string
  report_id: string
  additional_context?: string
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Parse request
    const { image_url, report_id, additional_context = "" }: AnalyzeHazardRequest =
      await req.json()

    // Validate inputs
    if (!image_url || !report_id) {
      return new Response(
        JSON.stringify({ error: "image_url and report_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured")
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
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
                  url: image_url,
                },
              },
              {
                type: "text",
                text: `あなたは通学路の安全分析の専門家です。添付された写真を分析し、子供の通学における危険要因を詳細に評価してください。

追加情報: ${additional_context || "なし"}

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

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error("Claude API error:", errorText)
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errorText }),
        { status: claudeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const claudeData = await claudeResponse.json()

    // Extract JSON from Claude's response
    const responseText = claudeData.content[0].text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.error("Failed to parse JSON from Claude response:", responseText)
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const analysis = JSON.parse(jsonMatch[0])

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        analysis_id: crypto.randomUUID(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error("Edge Function error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
