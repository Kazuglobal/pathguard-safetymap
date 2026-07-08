import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"
import { SUSPICIOUS_DANGER_TYPE } from "@/lib/suspicious-alert"
import { buildModerationUpdate } from "@/lib/suspicious-alert-moderation"
import { moderateSuspiciousAlertWithAi } from "@/lib/suspicious-alert-moderation-ai"
import { buildModerationResultPushPayload } from "@/lib/notifications/builders"
import { sendPushToUser } from "@/lib/web-push"
import {
  checkApiRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

interface ModerateRequestBody {
  reportId?: unknown
}

const BUCKET_NAME = "danger-reports"
/** Vision審査のために取得する画像の上限枚数・サイズ（コスト有界化）。 */
const MAX_MODERATION_IMAGES = 3
const MAX_MODERATION_IMAGE_BYTES = 8 * 1024 * 1024

function guessImageMimeFromPath(path: string): string {
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

/**
 * レポートに紐づく画像をストレージから取得し、Vision審査用のdata URLへ変換する。
 * 取得できなかった画像はスキップする（Vision審査は「取得できた分だけ」の補助情報。
 * 1枚も取得できなくても画像付き投稿は自動公開されないため安全側）。
 */
async function collectImageDataUrls(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  report: { image_url?: unknown; processed_image_urls?: unknown },
): Promise<string[]> {
  const candidates: string[] = []
  if (typeof report.image_url === "string" && report.image_url) {
    candidates.push(report.image_url)
  }
  if (Array.isArray(report.processed_image_urls)) {
    for (const url of report.processed_image_urls) {
      if (typeof url === "string" && url) candidates.push(url)
    }
  }

  const dataUrls: string[] = []
  for (const url of candidates.slice(0, MAX_MODERATION_IMAGES)) {
    const path = extractStoragePathFromPublicUrl(url, BUCKET_NAME)
    if (!path) continue
    try {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(path)
      if (error || !data || data.size > MAX_MODERATION_IMAGE_BYTES) continue
      const buffer = Buffer.from(await data.arrayBuffer())
      const mime =
        typeof data.type === "string" && data.type.startsWith("image/")
          ? data.type
          : guessImageMimeFromPath(path)
      dataUrls.push(`data:${mime};base64,${buffer.toString("base64")}`)
    } catch (error) {
      console.error(
        "suspicious moderation image download failed:",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }
  return dataUrls
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`suspicious-moderate:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  let body: ModerateRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 })
  }

  const reportId = typeof body.reportId === "string" ? body.reportId : ""
  if (!reportId) {
    return NextResponse.json({ error: "reportId が必要です" }, { status: 400 })
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  try {
    supabaseAdmin = getSupabaseAdmin()
  } catch (error) {
    console.error("suspicious moderation admin client unavailable:", error)
    return NextResponse.json(
      {
        error:
          "サーバ審査の設定が不足しています。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を確認してください。",
      },
      { status: 503 },
    )
  }

  const { data: report, error: fetchError } = await supabaseAdmin
    .from("danger_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle()

  if (fetchError) {
    console.error("suspicious moderation fetch failed:", fetchError)
    return NextResponse.json({ error: "審査対象の取得に失敗しました" }, { status: 500 })
  }

  if (!report) {
    return NextResponse.json({ error: "審査対象が見つかりません" }, { status: 404 })
  }

  if (report.user_id !== user.id) {
    return NextResponse.json({ error: "この報告を審査できません" }, { status: 403 })
  }

  if (report.danger_type !== SUSPICIOUS_DANGER_TYPE) {
    return NextResponse.json({ error: "不審者アラートではありません" }, { status: 400 })
  }

  if (
    report.ai_moderation_status &&
    report.ai_moderation_status !== "pending"
  ) {
    return NextResponse.json(
      {
        error: "この報告はすでに審査済みです",
        report,
      },
      { status: 409 },
    )
  }

  const hasImage =
    Boolean(report.image_url) ||
    (Array.isArray(report.processed_image_urls) && report.processed_image_urls.length > 0)

  // 画像付きの場合のみストレージから画像を取得し、Vision審査へ渡す。
  const imageDataUrls = hasImage ? await collectImageDataUrls(supabaseAdmin, report) : []

  const verdict = await moderateSuspiciousAlertWithAi({
    text: report.description ?? report.title,
    hasImage,
    imageDataUrls,
  })
  const update = buildModerationUpdate(verdict, new Date().toISOString())

  const { data: updatedReport, error: updateError } = await supabaseAdmin
    .from("danger_reports")
    .update(update)
    .eq("id", reportId)
    .or("ai_moderation_status.is.null,ai_moderation_status.eq.pending")
    .select("*")
    .maybeSingle()

  if (updateError) {
    console.error("suspicious moderation update failed:", updateError)
    return NextResponse.json({ error: "審査結果の保存に失敗しました" }, { status: 500 })
  }

  if (!updatedReport) {
    return NextResponse.json(
      {
        error: "この報告はすでに審査済みです",
      },
      { status: 409 },
    )
  }

  // 審査結果を投稿者本人へPush通知する。
  // 二重送信は上の .or(ai_moderation_status is null / pending) ガードで防がれる
  // (審査確定の更新は1回しか成功しないため、この分岐も1回しか通らない)。
  // 通知の失敗で審査結果の保存(本体)を失敗扱いにしない。
  try {
    await sendPushToUser(
      report.user_id,
      buildModerationResultPushPayload({
        reportId: reportId,
        verdictStatus: verdict.status,
      }),
      "danger_reports",
    )
  } catch (error) {
    console.error("[suspicious-alert/moderate] push notify failed:", error)
  }

  return NextResponse.json({
    verdict,
    update,
    report: updatedReport,
  })
}
