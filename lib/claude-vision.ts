// WorkersではNode用のnode-fetch/https.Agentを使わず、標準Fetch APIで通信する。
import "@anthropic-ai/sdk/shims/web"
import Anthropic from "@anthropic-ai/sdk"

/** 画像解析に使う既定モデル。環境変数 CLAUDE_VISION_MODEL で上書きできる。 */
export const CLAUDE_VISION_DEFAULT_MODEL = "claude-haiku-5-5"

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp"

export function hasClaudeApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

/** 実際に呼ぶモデル名(座標の基準になる画像の大きさもモデルで決まる)。 */
export function claudeVisionModel(): string {
  return process.env.CLAUDE_VISION_MODEL?.trim() || CLAUDE_VISION_DEFAULT_MODEL
}

/** 既定の 1 コールの上限。Route Handlers の60秒枠を、リトライなしで超えないようにする。 */
const DEFAULT_TIMEOUT_MS = 45_000

/**
 * Claude Haiku 5.5 に画像とプロンプトを渡し、返答テキストを返す。
 * - Haiku 5.5 は temperature の既定外の値を 400 で拒否するため送らない。
 * - JSON 抽出用途では思考を無効にし、回答前に出力予算を使い切らないようにする。
 * - 失敗(断り・打ち切り・空・通信エラー)は throw する。呼び出し側が別の手段へ切り替える。
 */
export async function callClaudeVision(params: {
  base64: string
  mediaType: ImageMediaType
  prompt: string
  maxTokens?: number
  /** 1 コールの上限ミリ秒(既定 45 秒)。 */
  timeoutMs?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY")

  const client = new Anthropic({
    apiKey,
    fetch: globalThis.fetch,
    maxRetries: 0,
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  const response = await client.messages.create({
    model: claudeVisionModel(),
    max_tokens: params.maxTokens ?? 8192,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: params.mediaType, data: params.base64 } },
          { type: "text", text: params.prompt },
        ],
      },
    ],
  })

  if ((response.stop_reason as string) === "refusal") throw new Error("Claude declined the request")
  if (response.stop_reason === "max_tokens") throw new Error("Claude response was truncated")

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
  if (!text.trim()) throw new Error("Claude returned no text")
  return text
}
