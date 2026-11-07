// =============================================
// きけんハンター AI 評価: 旧形式(region)・box_2d(Gemini)・Claude(ピクセル座標)の比較を実写真で回す
//
// 使い方(写真フォルダを指定して実行する。写真 1 枚 × 形式ごとに 1 回呼ぶ):
//   npx tsx --env-file=.env.local scripts/hunter-eval/run.ts --dir "C:\写真のフォルダ"
//   npx tsx --env-file=.env.local scripts/hunter-eval/run.ts --dir "C:\写真のフォルダ" --variants box2d,claude --limit 5
// claude は ANTHROPIC_API_KEY が要る(アプリと同じモデル・同じピクセル座標のプロンプトで呼ぶ)。
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
import { callClaudeVision } from "@/lib/claude-vision"
import { buildHunterPrompt } from "@/lib/hunter/hunter-ai"
import { CLAUDE_HUNTER_MAX_TOKENS, CLAUDE_HUNTER_TIMEOUT_MS, prepareClaudeHunterImage } from "@/lib/hunter/hunter-claude"
import type { ImageSize } from "@/lib/vision/image-size"
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

/** region・box2d は Gemini、claude は Claude(ピクセル座標)。 */
type Variant = HunterCoordFormat | "claude"
const VARIANTS: readonly Variant[] = ["region", "box2d", "claude"]

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
  const status = (err as { status?: unknown })?.status
  if (typeof status === "number") return `HTTP ${status}`
  const msg = err instanceof Error ? err.message : ""
  const m = msg.match(/failed:\s*(\d{3})/)
  if (m) return `HTTP ${m[1]}`
  return err instanceof Error ? err.name : "error"
}

interface RawAnswer {
  readonly text: string | null
  /** Claude の座標の基準(Claude が見た縮小後の大きさ)。Gemini では無い。 */
  readonly pixelSize?: ImageSize
}

async function callClaude(dataUrl: string, label: string): Promise<RawAnswer> {
  const image = prepareClaudeHunterImage(dataUrl)
  if (!image) {
    process.stdout.write(`  ${label} 飛ばしました: ANTHROPIC_API_KEY が無いか、画像の大きさを読めません\n`)
    return { text: null }
  }
  const text = await callClaudeVision({
    base64: image.base64,
    mediaType: image.mediaType,
    prompt: buildHunterPrompt(undefined, NO_ACCIDENT, { pixels: image.pixelSize }),
    maxTokens: CLAUDE_HUNTER_MAX_TOKENS,
    timeoutMs: CLAUDE_HUNTER_TIMEOUT_MS,
  })
  return { text, pixelSize: image.pixelSize }
}

async function callOnce(file: string, variant: Variant): Promise<RawAnswer> {
  const dataUrl = `data:${MIME[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString("base64")}`
  const label = `${path.basename(file)} [${variant}]`
  try {
    if (variant === "claude") return await callClaude(dataUrl, label)
    const text = await callGeminiVision(
      dataUrl,
      buildHunterPrompt(undefined, NO_ACCIDENT, variant),
      buildHunterGenerationConfig(variant),
      REALTIME_VISION_DEFAULT_MODEL,
    )
    return { text }
  } catch (err) {
    process.stdout.write(`  ${label} 失敗: ${statusOf(err)}\n`)
    return { text: null }
  }
}

function readPixelSize(runDir: string, name: string, variant: string): ImageSize | undefined {
  const sizePath = path.join(runDir, "raw", `${name}.${variant}.size.json`)
  return fs.existsSync(sizePath) ? (JSON.parse(fs.readFileSync(sizePath, "utf8")) as ImageSize) : undefined
}

function photoEntries(runDir: string, variants: readonly string[], files: readonly string[]) {
  const sources: Record<string, string> = JSON.parse(fs.readFileSync(path.join(runDir, "sources.json"), "utf8"))
  return files.map((name) => {
    const byVariant: Record<string, PhotoMetrics> = {}
    for (const v of variants) {
      const rawPath = path.join(runDir, "raw", `${name}.${v}.txt`)
      if (fs.existsSync(rawPath)) byVariant[v] = evaluateRaw(fs.readFileSync(rawPath, "utf8") || null, readPixelSize(runDir, name, v))
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
  const variants = (arg("variants") ?? "region,box2d").split(",").filter((v): v is Variant => VARIANTS.includes(v as Variant))
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
    for (const variant of variants) {
      const name = path.basename(file)
      process.stdout.write(`${name} [${variant}]\n`)
      const answer = await callOnce(file, variant)
      fs.writeFileSync(path.join(runDir, "raw", `${name}.${variant}.txt`), answer.text ?? "")
      if (answer.pixelSize) {
        fs.writeFileSync(path.join(runDir, "raw", `${name}.${variant}.size.json`), JSON.stringify(answer.pixelSize))
      }
    }
  }
  writeReport(runDir, variants)
}

main().catch((err) => {
  process.stderr.write(`評価を中断しました: ${err instanceof Error ? err.message : "error"}\n`)
  process.exit(1)
})
