/**
 * 記事データ駆動の画像生成（通学路の安全ニュース / SAFE MAGAZINE 共通）
 *
 * NEWS_ITEMS / ARTICLES が参照している画像のうち、public/ に実在しないものだけを生成する。
 * 記事を追加したらスクリプトへ手書きで設定を足す必要はなく、これを実行するだけでよい。
 *
 * 使い方:
 *   npx tsx scripts/generate-missing-images.ts            # news + magazine の欠落分をすべて生成
 *   npx tsx scripts/generate-missing-images.ts news       # 通学路の安全ニュースのみ
 *   npx tsx scripts/generate-missing-images.ts magazine   # SAFE MAGAZINE のみ
 *   npx tsx scripts/generate-missing-images.ts --dry-run  # 生成対象の一覧だけ表示
 *   npx tsx scripts/generate-missing-images.ts --only <slug>
 *
 * プロンプトの解決順:
 *   news     : scripts/image-prompts/school-route-news.json の slug 指定 → カテゴリ別の自動生成
 *   magazine : content/safe-magazine/images/*.json の visual spec → title/description からの自動生成
 *
 * 既存ファイルは上書きしない（作り直す場合は該当ファイルを先に削除する）。
 * 出力は JPEG のみ受け付ける（記事側の参照が .jpg のため。PNG を .png で保存して参照切れになる事故の再発防止）。
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, "public")
const API_KEY = process.env.GEMINI_API_KEY
const MODELS = [
  ...new Set([process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-image"].filter(Boolean)),
] as string[]
const MIN_IMAGE_BYTES = 20_000
const RETRIES_PER_MODEL = 2

const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details, 16:9 landscape composition
- Japanese editorial illustration style, stylized anime/manga inspired
- Clean lines, balanced composition with clear visual hierarchy
- No watermarks, no text overlays, no signatures, no letters or numbers anywhere in the image
- Never depict injury, blood, a crash impact, or an identifiable person's face
- Warm, appropriate for family and education content
`

interface ImageJob {
  kind: "news" | "magazine"
  slug: string
  url: string
  prompt: string
}

const CATEGORY_TONE: Record<string, string> = {
  accident: "Somber but calm safety awareness. Muted tones with red warning accents. Abstract objects only (dropped yellow cap, crosswalk, signal), no people injured.",
  suspicious: "Alert but reassuring. Warm afternoon tones with orange accents. A child seen from behind at a distance, a faceless shadowy silhouette far away, and a clearly visible safe place (shop, child-safe-house sign shape) to escape to.",
  infrastructure: "Bright, reassuring. Blue and gray infrastructure, green surroundings, children walking safely.",
  policy: "Positive public-information poster mood. Purple and blue policy accents, children and community volunteers.",
  community: "Warm community mood. Greens and warm yellows, volunteers in yellow vests smiling at children.",
}

function toPublicPath(url: string): string {
  return path.join(PUBLIC_DIR, url.replace(/^\//, ""))
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T
  } catch {
    return null
  }
}

function buildNewsPrompt(item: { title: string; category: string; location: { prefecture: string; city?: string } }): string {
  const topic = item.title.replace(/^【[^】]*】/, "").trim()
  const place = [item.location.prefecture, item.location.city].filter(Boolean).join(" ")
  const tone = CATEGORY_TONE[item.category] ?? CATEGORY_TONE.policy
  return `Create a Japanese safety awareness illustration for a school-route news article.

Topic: ${topic}
Regional flavor: typical streetscape of ${place}, Japan (do not write the place name in the image).
Mood and palette: ${tone}

Scene rules:
- Elementary school children wear yellow caps and randoseru backpacks, always seen from behind or small in the frame
- Abstract, NOT depicting any actual person, injury or incident; focus on what a family can do to stay safe
- No text, no letters, no kanji, no numbers of any kind (signs and road surfaces use plain shapes only)
${QUALITY_SUFFIX}`
}

function buildNewsFigurePrompt(item: { category: string }, description: string): string {
  const tone = CATEGORY_TONE[item.category] ?? CATEGORY_TONE.policy
  return `Create a clean, pictogram-style Japanese explanatory illustration (an instructional figure, not a scene) for a parent-facing school-route safety article.

Figure to depict: ${description}
Layout: 2 to 4 simple panels or icons arranged left to right with arrows, each panel showing one step or one object.
Mood and palette: ${tone}

Rules:
- Children wear yellow caps and randoseru backpacks and are seen from behind or drawn as faceless simple figures
- Never depict any threatening person, injury or incident; show only the safe action
- Purely pictorial: no text, no letters, no kanji, no numbers anywhere (the caption is added separately)
${QUALITY_SUFFIX}`
}

function loadNewsOverrides(): Record<string, string> {
  return readJson<Record<string, string>>(path.join(ROOT, "scripts", "image-prompts", "school-route-news.json")) ?? {}
}

async function collectNewsJobs(): Promise<ImageJob[]> {
  const { NEWS_ITEMS } = await import("../lib/school-route-news")
  const overrides = loadNewsOverrides()
  const jobs: ImageJob[] = []
  for (const item of NEWS_ITEMS) {
    if (item.thumbnailUrl) {
      jobs.push({ kind: "news", slug: item.slug, url: item.thumbnailUrl, prompt: overrides[item.slug] ?? buildNewsPrompt(item) })
    }
    for (const image of item.contentImages ?? []) {
      const key = `${item.slug}/${image.id}`
      jobs.push({ kind: "news", slug: key, url: image.url, prompt: overrides[key] ?? buildNewsFigurePrompt(item, image.description) })
    }
  }
  return jobs
}

interface VisualSpec {
  articleSlug: string
  thumbnailPrompt?: string
  contentImages?: Array<{ id: string; prompt: string }>
}

function loadVisualSpecs(): Map<string, VisualSpec> {
  const dir = path.join(ROOT, "content", "safe-magazine", "images")
  const specs = new Map<string, VisualSpec>()
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : []) {
    const data = readJson<VisualSpec | VisualSpec[]>(path.join(dir, file))
    for (const spec of Array.isArray(data) ? data : data ? [data] : []) {
      if (spec?.articleSlug) specs.set(spec.articleSlug, spec)
    }
  }
  return specs
}

async function collectMagazineJobs(): Promise<ImageJob[]> {
  const { ARTICLES } = await import("../lib/safe-magazine")
  const specs = loadVisualSpecs()
  const jobs: ImageJob[] = []
  for (const article of ARTICLES) {
    const spec = specs.get(article.slug)
    if (article.thumbnailUrl) {
      jobs.push({
        kind: "magazine",
        slug: article.slug,
        url: article.thumbnailUrl,
        prompt:
          spec?.thumbnailPrompt ??
          `Create a warm Japanese editorial illustration as the thumbnail of a parent-facing school-route safety article.\nTitle: ${article.title}\nSummary: ${article.excerpt}\nShow a calm, hopeful scene with children (yellow caps, randoseru) and a Japanese residential street. Never use fear-based imagery.\n${QUALITY_SUFFIX}`,
      })
    }
    for (const image of article.contentImages ?? []) {
      const base = path.basename(image.url, path.extname(image.url))
      const match = spec?.contentImages?.find((c) => c.id === image.id || c.id === base)
      jobs.push({
        kind: "magazine",
        slug: `${article.slug}/${image.id}`,
        url: image.url,
        prompt:
          match?.prompt ??
          `Create a clean Japanese educational infographic-style illustration.\nSubject: ${image.description}\nArticle: ${article.title}\nFriendly icons, clear hierarchy, minimal text.\n${QUALITY_SUFFIX}`,
      })
    }
  }
  return jobs
}

const sanitize = (text: string): string => (API_KEY ? text.split(API_KEY).join("<key>") : text)

async function requestImage(model: string, prompt: string): Promise<Buffer> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY as string },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  })
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${sanitize(await response.text()).slice(0, 200)}`), { status: response.status })
  }
  const data = await response.json()
  const part = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)
  if (!part) throw new Error("no image part in response (possibly blocked by safety filter)")
  if (part.inlineData.mimeType !== "image/jpeg") throw new Error(`expected image/jpeg but received ${part.inlineData.mimeType}`)
  const buffer = Buffer.from(part.inlineData.data, "base64")
  if (buffer.length < MIN_IMAGE_BYTES || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("response is not a valid JPEG")
  return buffer
}

async function generateWithFallback(prompt: string): Promise<{ buffer: Buffer; model: string }> {
  const errors: string[] = []
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        return { buffer: await requestImage(model, prompt), model }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${model}#${attempt}: ${message}`)
        const retryable = !(error as { status?: number }).status || [429, 500, 502, 503, 504].includes((error as { status?: number }).status as number)
        if (!retryable) break
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      }
    }
  }
  throw new Error(errors.join(" | "))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const onlyIndex = args.indexOf("--only")
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : undefined
  const scope = args.find((a) => a === "news" || a === "magazine") ?? "all"

  const jobs = [
    ...(scope !== "magazine" ? await collectNewsJobs() : []),
    ...(scope !== "news" ? await collectMagazineJobs() : []),
  ].filter((job) => !only || job.slug === only || job.slug.startsWith(`${only}/`))

  const missing = jobs.filter((job) => !fs.existsSync(toPublicPath(job.url)))
  console.log(`参照画像 ${jobs.length} 件 / 欠落 ${missing.length} 件（モデル候補: ${MODELS.length} 種）`)
  for (const job of missing) console.log(`  - [${job.kind}] ${job.url}`)
  if (dryRun || missing.length === 0) return
  if (!API_KEY) throw new Error("GEMINI_API_KEY が未設定です（.env.local に設定してください）")

  const failures: string[] = []
  for (const job of missing) {
    const target = toPublicPath(job.url)
    try {
      const { buffer, model } = await generateWithFallback(job.prompt)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const tmp = `${target}.tmp`
      fs.writeFileSync(tmp, buffer)
      fs.renameSync(tmp, target)
      console.log(`  ✓ ${job.url} (${Math.round(buffer.length / 1024)}KB, ${model})`)
    } catch (error) {
      failures.push(job.url)
      console.error(`  ✗ ${job.url}: ${sanitize(error instanceof Error ? error.message : String(error))}`)
    }
  }
  if (failures.length > 0) {
    console.error(`失敗 ${failures.length} 件。記事が参照する画像が欠落したままです。`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(sanitize(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
})
