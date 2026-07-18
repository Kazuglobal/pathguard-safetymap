#!/usr/bin/env node

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

function printHelp() {
  console.log(`危険箇所レポートAI一次審査 バックテスト

Usage:
  pnpm moderation:backtest -- --limit 100

Required environment keys:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GEMINI_API_KEY (or GOOGLE_API_KEY)

投稿本文は出力せず、混同行列とロールアウト判定指標だけを表示します。`)
}

function parseLimit(argv) {
  const index = argv.indexOf("--limit")
  if (index < 0) return DEFAULT_LIMIT
  const value = Number.parseInt(argv[index + 1] ?? "", 10)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("--limit must be a positive integer")
  }
  return Math.min(value, MAX_LIMIT)
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp()
  process.exit(0)
}

const limit = parseLimit(process.argv.slice(2))
const { getSupabaseAdmin } = await import("../lib/supabase-admin.ts")
const { moderateDangerReportWithAi } = await import(
  "../lib/danger-report-moderation-ai.ts"
)
const { evaluateDangerModeration } = await import(
  "../lib/danger-report-moderation-eval.ts"
)

const supabaseAdmin = getSupabaseAdmin()
const { data: reports, error } = await supabaseAdmin
  .from("danger_reports")
  .select(
    "id, title, description, danger_type, danger_level, latitude, longitude, geocode_confidence, prefecture, city, image_url, processed_image_urls, status",
  )
  .in("status", ["approved", "rejected"])
  .order("created_at", { ascending: false })
  .limit(limit)

if (error) {
  throw new Error("バックテスト対象の取得に失敗しました")
}

const samples = []
let processed = 0

// Geminiのレート制限と費用を有界化するため、必ず並列度1で実行する。
for (const report of reports ?? []) {
  const hasImage =
    Boolean(report.image_url) ||
    (Array.isArray(report.processed_image_urls) &&
      report.processed_image_urls.length > 0)
  const verdict = await moderateDangerReportWithAi({
    title: report.title ?? "",
    description: report.description ?? null,
    dangerType: report.danger_type ?? "other",
    dangerLevel: report.danger_level ?? 1,
    latitude: report.latitude,
    longitude: report.longitude,
    geocodeConfidence: report.geocode_confidence ?? null,
    prefecture: report.prefecture ?? null,
    city: report.city ?? null,
    hasImage,
    recentReportsByUserLastHour: 0,
    nearbyDuplicateCount: 0,
    userRejectedCountLast30d: 0,
    imageDataUrls: [],
  })

  samples.push({
    humanStatus: report.status,
    aiStatus: verdict.status,
    fallback: verdict.fallback,
  })
  processed += 1
  if (processed % 10 === 0) {
    console.log(`processed ${processed}/${reports.length}`)
  }
}

const evaluation = evaluateDangerModeration(samples)
console.log(
  JSON.stringify(
    {
      sampleLimit: limit,
      ...evaluation,
      dangerousErrorRatePercent: evaluation.dangerousErrorRate * 100,
      approveRecallPercent: evaluation.approveRecall * 100,
      fallbackRatePercent: evaluation.fallbackRate * 100,
    },
    null,
    2,
  ),
)
