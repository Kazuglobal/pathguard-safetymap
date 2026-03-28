/**
 * 防災用プロンプト 一括画像生成スクリプト
 * lib/disaster-scenario-prompts.ts に定義された全プロンプトを
 * 入力画像に対して一括適用し、PNG ファイルとして出力する。
 *
 * 使い方:
 *   tsx scripts/generate-disaster-prompt-images.ts --input <画像パス> [オプション]
 *
 * オプション:
 *   --input <path>          入力画像ファイルパス（必須）
 *   --audience <value>      対象を絞る: children | parents | administration | all（デフォルト: all）
 *   --prompts <id1,id2>     カンマ区切りでプロンプトIDを指定（例: child-1,parent-3）
 *   --output <dir>          出力ディレクトリ（デフォルト: output/disaster-images/<timestamp>）
 *   --delay <ms>            リクエスト間の待機時間ミリ秒（デフォルト: 3000）
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import {
  allPrompts,
  getPromptsByCategory,
  type DisasterPrompt,
  type TargetAudience,
} from "../lib/disaster-scenario-prompts"

dotenv.config({ path: ".env.local" })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation"

// ファイル名として安全な文字列に変換
function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
}

// CLI 引数をパース
function parseArgs(argv: string[]): {
  input: string | null
  audience: TargetAudience | "all"
  prompts: string[] | null
  output: string | null
  delay: number
} {
  const args = argv.slice(2)
  let input: string | null = null
  let audience: TargetAudience | "all" = "all"
  let prompts: string[] | null = null
  let output: string | null = null
  let delay = 3000

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        input = args[++i] ?? null
        break
      case "--audience":
        audience = (args[++i] as TargetAudience | "all") ?? "all"
        break
      case "--prompts":
        prompts = (args[++i] ?? "").split(",").filter(Boolean)
        break
      case "--output":
        output = args[++i] ?? null
        break
      case "--delay":
        delay = parseInt(args[++i] ?? "3000", 10) || 3000
        break
    }
  }

  return { input, audience, prompts, output, delay }
}

// 使い方を表示して終了
function printUsageAndExit(): never {
  console.error(`
使い方:
  tsx scripts/generate-disaster-prompt-images.ts --input <画像パス> [オプション]

オプション:
  --input <path>          入力画像ファイルパス（必須）
  --audience <value>      children | parents | administration | all（デフォルト: all）
  --prompts <id1,id2>     カンマ区切りのプロンプトID（例: child-1,parent-3）
  --output <dir>          出力ディレクトリ（デフォルト: output/disaster-images/<timestamp>）
  --delay <ms>            リクエスト間の待機時間ミリ秒（デフォルト: 3000）

例:
  tsx scripts/generate-disaster-prompt-images.ts --input ./photo.jpg
  tsx scripts/generate-disaster-prompt-images.ts --input ./photo.jpg --audience children
  tsx scripts/generate-disaster-prompt-images.ts --input ./photo.jpg --prompts child-1,parent-3
`)
  process.exit(1)
}

// 使用するプロンプト一覧を解決
function resolvePrompts(
  audience: TargetAudience | "all",
  promptIds: string[] | null
): DisasterPrompt[] {
  if (promptIds && promptIds.length > 0) {
    return allPrompts.filter((p) => promptIds.includes(p.id))
  }
  if (audience === "all") {
    return allPrompts
  }
  return getPromptsByCategory(audience)
}

// 入力画像を base64 に変換し MIME タイプを推定
function loadImage(inputPath: string): { base64: string; mimeType: string } {
  const ext = path.extname(inputPath).toLowerCase()
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  }
  const mimeType = mimeMap[ext] ?? "image/jpeg"
  const base64 = fs.readFileSync(inputPath).toString("base64")
  return { base64, mimeType }
}

// Gemini API を呼び出して画像を生成（image-to-image）
async function generateImage(
  prompt: string,
  imageBase64: string,
  imageMimeType: string
): Promise<{ success: boolean; pngBase64?: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY が設定されていません" }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: imageMimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["image", "text"],
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const message =
        (err as { error?: { message?: string } }).error?.message ?? response.statusText
      return { success: false, error: `API エラー: ${message}` }
    }

    const data = await response.json()
    const parts = data?.candidates?.[0]?.content?.parts

    if (!parts) {
      return { success: false, error: "レスポンスに content.parts がありません" }
    }

    const imagePart = (
      parts as Array<{ inlineData?: { data: string; mimeType: string } }>
    ).find((p) => p.inlineData)

    if (!imagePart?.inlineData) {
      return { success: false, error: "レスポンスに画像データがありません" }
    }

    return { success: true, pngBase64: imagePart.inlineData.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const { input, audience, prompts: promptIds, output, delay } = parseArgs(process.argv)

  // --input は必須
  if (!input) {
    console.error("エラー: --input オプションが必要です\n")
    printUsageAndExit()
  }

  // 入力ファイルの存在確認
  if (!fs.existsSync(input)) {
    console.error(`エラー: 入力ファイルが見つかりません: ${input}`)
    process.exit(1)
  }

  // GEMINI_API_KEY チェック
  if (!GEMINI_API_KEY) {
    console.error("エラー: GEMINI_API_KEY が設定されていません (.env.local を確認してください)")
    process.exit(1)
  }

  // プロンプト一覧を解決
  const targets = resolvePrompts(audience, promptIds)

  if (targets.length === 0) {
    console.error("エラー: 対象のプロンプトが見つかりません")
    process.exit(1)
  }

  // 出力ディレクトリ
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const outputDir = output ?? path.join(process.cwd(), "output", "disaster-images", timestamp)
  fs.mkdirSync(outputDir, { recursive: true })

  // 入力画像の読み込み
  const { base64: imageBase64, mimeType: imageMimeType } = loadImage(input)

  console.log(`\n=== 防災用プロンプト 一括画像生成 ===`)
  console.log(`入力画像 : ${input}`)
  console.log(`モデル   : ${GEMINI_MODEL}`)
  console.log(`対象     : ${audience === "all" ? "全プロンプト" : audience}`)
  console.log(`件数     : ${targets.length} 件`)
  console.log(`出力先   : ${outputDir}`)
  console.log(`待機時間 : ${delay} ms\n`)

  let successCount = 0
  let failCount = 0
  const failures: string[] = []

  for (let i = 0; i < targets.length; i++) {
    const prompt = targets[i]
    const label = `[${i + 1}/${targets.length}] ${prompt.id}: ${prompt.name}`

    process.stdout.write(`${label} ... 生成中\n`)

    const result = await generateImage(prompt.prompt, imageBase64, imageMimeType)

    if (result.success && result.pngBase64) {
      const filename = `${prompt.id}_${sanitizeFilename(prompt.shortName)}.png`
      const outputPath = path.join(outputDir, filename)
      fs.writeFileSync(outputPath, Buffer.from(result.pngBase64, "base64"))
      console.log(`  ✓ 保存: ${outputPath}`)
      successCount++
    } else {
      console.error(`  ✗ 失敗: ${result.error}`)
      failCount++
      failures.push(`${prompt.id} (${prompt.name}): ${result.error}`)
    }

    // 最後の1件以外は待機
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // サマリー
  console.log(`\n=== 完了 ===`)
  console.log(`成功: ${successCount} 件 / 失敗: ${failCount} 件`)
  if (failures.length > 0) {
    console.error("\n失敗一覧:")
    for (const f of failures) {
      console.error(`  - ${f}`)
    }
  }
  console.log(`出力先: ${outputDir}\n`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("予期しないエラー:", err)
  process.exit(1)
})
