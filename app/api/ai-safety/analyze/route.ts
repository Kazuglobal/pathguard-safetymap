import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

import { createServerClient } from "@/lib/supabase-server"
import { analyzeRouteSafety, type RouteContext } from "@/lib/ai/safe-route-advisor"
import { generateParentSafetyReport, type ParentReportContext } from "@/lib/ai/parent-safety-report"
import { analyzeInfrastructureFromImage } from "@/lib/ai/infrastructure-analyzer"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const { analysisType } = body

    switch (analysisType) {
      case "route-safety": {
        const context: RouteContext = {
          startAddress: body.startAddress,
          endAddress: body.endAddress,
          distanceMeters: body.distanceMeters,
          estimatedTimeMinutes: body.estimatedTimeMinutes,
          dangerReports: body.dangerReports,
          timeOfDay: body.timeOfDay,
          weatherCondition: body.weatherCondition,
        }
        const result = await analyzeRouteSafety(context)
        return NextResponse.json({ success: true, analysisType: "route-safety", data: result })
      }

      case "parent-report": {
        const context: ParentReportContext = {
          routeName: body.routeName,
          startAddress: body.startAddress,
          endAddress: body.endAddress,
          distanceMeters: body.distanceMeters,
          estimatedTimeMinutes: body.estimatedTimeMinutes,
          childAge: body.childAge,
          childGrade: body.childGrade,
          dangerReports: body.dangerReports,
          safetyScore: body.safetyScore,
        }
        const result = await generateParentSafetyReport(context)
        return NextResponse.json({ success: true, analysisType: "parent-report", data: result })
      }

      case "infrastructure": {
        if (!body.imageBase64) {
          return NextResponse.json({ error: "画像データが必要です" }, { status: 400 })
        }
        const result = await analyzeInfrastructureFromImage(body.imageBase64)
        return NextResponse.json({ success: true, analysisType: "infrastructure", data: result })
      }

      default:
        return NextResponse.json(
          { error: `不明な分析タイプ: ${analysisType}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("AI Safety Analysis error:", error)
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
