import { NextRequest, NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"
import {
  SAMPLE_SAFETY_QUEST_CHALLENGES,
  buildSafetyQuestChallengesFromReports,
  type SafetyQuestReportRow,
} from "@/lib/safety-quest"

export const runtime = "nodejs"

const DANGER_REPORTS_BUCKET = "danger-reports"
const SIGNED_IMAGE_TTL_SECONDS = 3600

function extractDangerReportStoragePath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null
  if (!/^https?:\/\//.test(urlOrPath)) return urlOrPath
  return extractStoragePathFromPublicUrl(urlOrPath, DANGER_REPORTS_BUCKET)
}

async function createSignedDangerReportImageUrl(
  admin: ReturnType<typeof getSupabaseAdmin>,
  urlOrPath: string | null | undefined,
): Promise<string | null> {
  const path = extractDangerReportStoragePath(urlOrPath)
  if (!path) return null

  const { data, error } = await admin.storage
    .from(DANGER_REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_IMAGE_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

async function withSignedReportImages(
  admin: ReturnType<typeof getSupabaseAdmin>,
  rows: SafetyQuestReportRow[],
): Promise<SafetyQuestReportRow[]> {
  const signedRows = await Promise.all(
    rows.map(async (row) => {
      const candidates = [
        ...(row.processed_image_urls ?? []),
        row.processed_image_url,
        row.image_url,
      ]

      for (const candidate of candidates) {
        const signedUrl = await createSignedDangerReportImageUrl(admin, candidate)
        if (signedUrl) {
          return {
            ...row,
            image_url: null,
            processed_image_url: null,
            processed_image_urls: [signedUrl],
          }
        }
      }

      return {
        ...row,
        image_url: null,
        processed_image_url: null,
        processed_image_urls: null,
      }
    }),
  )

  return signedRows
}

export async function GET(_request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const admin = getSupabaseAdmin() as any
  const { data, error } = await admin
    .from("danger_reports")
    .select("id,title,status,image_url,processed_image_url,processed_image_urls,city,town,prefecture,danger_type,danger_level")
    .in("status", ["approved", "published", "resolved"])
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: "チャレンジの取得に失敗しました" }, { status: 500 })
  }

  const signedRows = await withSignedReportImages(admin, (data ?? []) as SafetyQuestReportRow[])
  const challenges = buildSafetyQuestChallengesFromReports(signedRows)

  return NextResponse.json({
    challenges: challenges.length > 0 ? challenges : SAMPLE_SAFETY_QUEST_CHALLENGES,
    progress: {
      userId: user.id,
      completedChallengeIds: [],
      dailyMissionProgress: {
        hazardFinds: 0,
        quizCorrect: 0,
        clearedStages: 0,
      },
    },
  })
}
