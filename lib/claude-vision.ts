import Anthropic from "@anthropic-ai/sdk"

/** 画像解析に使う既定モデル。環境変数 CLAUDE_VISION_MODEL で上書きできる。 */
export const CLAUDE_VISION_DEFAULT_MODEL = "claude-haiku-5-5"

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp"

export function hasClaudeApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

/**
 * Claude Haiku 5.5 に画像とプロンプトを渡し、返答テキストを返す。
 * - Haiku 5.5 は temperature の既定外の値を 400 で拒否するため送らない。
 * - 思考は既定でオン。JSON を返すだけの用途なので effort を low にして出力トークンを抑える。
 */
export async function callClaudeVision(params: {
  base64: string
  mediaType: ImageMediaType
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY")

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 })
  const response = await client.messages.create({
    model: process.env.CLAUDE_VISION_MODEL?.trim() || CLAUDE_VISION_DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 4096,
    // SDK の型定義が output_config より古いため、型だけ緩めて送る。
    ...({ output_config: { effort: "low" } } as Record<string, unknown>),
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
