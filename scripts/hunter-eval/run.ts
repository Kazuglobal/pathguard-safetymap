// =============================================
// きけんハンター AI 評価: 旧形式(region)と box_2d の比較を実写真で回す
//
// 使い方(写真フォルダを指定して実行する。Gemini を写真 1 枚 × 形式ごとに 1 回呼ぶ):
//   npx tsx --env-file=.env.local scripts/hunter-eval/run.ts --dir "C:\写真のフォルダ"
//   npx tsx --env-file=.env.local scripts/hunter-eval/run.ts --dir "C:\写真のフォルダ" --variants box2d --limit 5
// 保存済みの応答を数え直すだけ(API 代 0):
//   npx tsx scripts/hunter-eval/run.ts --offline .tmp/hunter-eval/<実行フォルダ>
//
// 出力: .tmp/hunter-eval/<日時>/raw/*.txt(生の応答)・summary.json・report.html(枠を重ねた一覧)
// 写真は顔やナンバーが写っていないもの(アプリと同じく、ぼかし済み)を使うこと。
// 鍵や環境変数の値は出力しない。失敗は HTTP の状態コードだけを表示する。
// =============================================

import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"

import { callGeminiVision } from "@/lib/gemini-hazard"
import { REALTIME_VISION_DEFAULT_MODEL } from "@/lib/gemini-util"
import { buildHunterGenerationConfig, type HunterCoordFormat } from "@/lib/hunter/ai-request-schema"
import { buildHunterPrompt } from "@/lib/hunter/hunter-ai"
import type { HunterAccidentSummary } from "@/lib/hunter/types"

import { evaluateRaw, renderReport, summarize, type PhotoMetrics } from "./evaluate"

const NO_ACCIDENT: HunterAccidentSummary = {
  hasData: false,
  riskScore: 0,
  riskLevel: "low",
  riskLabel: "",
  riskEmoji: "",
  totalAccidents: 0,
  childInvolved: 0,
  topAccidentType: null,
  peakTimeSlot: null,
  kidMessage: "",
}

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}

function listPhotos(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => MIME[path.extname(f).toLowerCase()])
    .sort()
    .map((f) => path.join(dir, f))
}

/** エラーから HTTP の状態コードだけを取り出す(本文や URL は出さない)。 */
function statusOf(err: unknown): string {
  const msg = err instanceof Error ? err.message : ""
  const m = msg.match(/failed:\s*(\d{3})/)
  if (m) return `HTTP ${m[1]}`
  return err instanceof Error ? err.name : "error"
}

async function callOnce(file: string, format: HunterCoordFormat): Promise<string | null> {
  const dataUrl = `data:${MIME[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString("base64")}`
  try {
    return await callGeminiVision(
      dataUrl,
      buildHunterPrompt(undefined, NO_ACCIDENT, format),
      buildHunterGenerationConfig(format),
      REALTIME_VISION_DEFAULT_MODEL,
    )
  } catch (err) {
    process.stdout.write(`  ${path.basename(file)} [${format}] 失敗: ${statusOf(err)}\n`)
    return null
  }
}

function photoEntries(runDir: string, variants: readonly string[], files: readonly string[]) {
  const sources: Record<string, string> = JSON.parse(fs.readFileSync(path.join(runDir, "sources.json"), "utf8"))
  return files.map((name) => {
    const byVariant: Record<string, PhotoMetrics> = {}
    for (const v of variants) {
      const rawPath = path.join(runDir, "raw", `${name}.${v}.txt`)
      if (fs.existsSync(rawPath)) byVariant[v] = evaluateRaw(fs.readFileSync(rawPath, "utf8") || null)
    }
    return { name, fileUrl: pathToFileURL(sources[name] ?? name).href, byVariant }
  })
}

function writeReport(runDir: string, variants: readonly string[]) {
  const sources: Record<string, string> = JSON.parse(fs.readFileSync(path.join(runDir, "sources.json"), "utf8"))
  const photos = photoEntries(runDir, variants, Object.keys(sources))
  const summaries = Object.fromEntries(
    variants.map((v) => [v, summarize(photos.flatMap((p) => (p.byVariant[v] ? [p.byVariant[v]] : [])))]),
  )
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summaries, null, 2))
  fs.writeFileSync(path.join(runDir, "report.html"), renderReport(photos, summaries))
  for (const [v, s] of Object.entries(summaries)) {
    process.stdout.write(
      `${v}: 写真${s.photos} 読めない${s.parseFailures} 危険なし${s.guideEmpty} 危険${s.meanHazards.toFixed(2)} ` +
        `旧の当たり${Math.round(s.meanLegacyCoverage * 100)}% 新の当たり${Math.round(s.meanHitCoverage * 100)}% ` +
        `focus枠内${s.focusInsideRate === null ? "-" : Math.round(s.focusInsideRate * 100) + "%"}\n`,
    )
  }
  process.stdout.write(`レポート: ${path.join(runDir, "report.html")}\n`)
}

async function main() {
  const variants = (arg("variants") ?? "region,box2d").split(",").filter((v): v is HunterCoordFormat => v === "region" || v === "box2d")
  const offline = arg("offline")
  if (offline) return writeReport(path.resolve(offline), variants)

  const dir = arg("dir")
  if (!dir || !fs.existsSync(dir)) throw new Error("--dir に写真のフォルダを指定してください")
  const limit = Number(arg("limit") ?? "0")
  const files = listPhotos(dir).slice(0, limit > 0 ? limit : undefined)
  const runDir = path.resolve(".tmp", "hunter-eval", new Date().toISOString().replace(/[:.]/g, "-"))
  fs.mkdirSync(path.join(runDir, "raw"), { recursive: true })
  const sources = Object.fromEntries(files.map((f) => [path.basename(f), f]))
  fs.writeFileSync(path.join(runDir, "sources.json"), JSON.stringify(sources, null, 2))

  for (const file of files) {
    for (const format of variants) {
      process.stdout.write(`${path.basename(file)} [${format}]\n`)
      const text = await callOnce(file, format)
      fs.writeFileSync(path.join(runDir, "raw", `${path.basename(file)}.${format}.txt`), text ?? "")
    }
  }
  writeReport(runDir, variants)
}

main().catch((err) => {
  process.stderr.write(`評価を中断しました: ${err instanceof Error ? err.message : "error"}\n`)
  process.exit(1)
})
