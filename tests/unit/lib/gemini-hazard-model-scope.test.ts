/**
 * Vision解析モデルのスコープ回帰テスト
 *
 * 要件: gemini-3.5-flash への移行は「きけんハンター / ハザードゲーム」だけ。
 * analyzeImagePipeline は safety-quest/private-practice とも共有されるため、
 * visionModelDefault を明示的に渡した呼び出しだけが新モデルへ移行し、
 * それ以外(レガシー位置引数形式・省略時)は gemini-2.5-flash 既定に留まることを固定する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { analyzeImagePipeline, callGeminiVision } from "@/lib/gemini-hazard"
import { REALTIME_VISION_DEFAULT_MODEL } from "@/lib/gemini-util"

const VALID_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUg".repeat(10)

/** callGeminiVision が期待する最小のGemini応答(テキストpartにJSONを含む)。 */
function geminiResponse(jsonText: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: jsonText }] } }],
    }),
  }
}

describe("Vision解析モデルのスコープ", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(geminiResponse("{}"))
    vi.stubGlobal("fetch", fetchMock)
    // ダミーのAPIキーを注入し、GEMINI_VISION_MODEL 上書きは無効化(既定パスを再現)。
    vi.stubEnv("GEMINI_API_KEY", "test-dummy-key")
    vi.stubEnv("GEMINI_VISION_MODEL", "")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function requestedModel(): string {
    const url = String(fetchMock.mock.calls[0][0])
    const match = url.match(/\/models\/([^:?]+):generateContent/)
    return match ? decodeURIComponent(match[1]) : ""
  }

  it("visionModelDefault を渡したハザードゲーム形式の呼び出しはリアルタイム用モデルを使う", async () => {
    await analyzeImagePipeline(VALID_IMAGE_BASE64, {
      userMarkers: undefined,
      promptType: "default",
      visionModelDefault: REALTIME_VISION_DEFAULT_MODEL,
    })
    expect(requestedModel()).toBe(REALTIME_VISION_DEFAULT_MODEL)
  })

  it("レガシー位置引数形式(safety-quest/private-practice と同形)は gemini-2.5-flash 既定に留まる", async () => {
    await analyzeImagePipeline(VALID_IMAGE_BASE64, [], "child")
    expect(requestedModel()).toBe("gemini-2.5-flash")
  })

  it("オプション省略時も gemini-2.5-flash 既定に留まる", async () => {
    await analyzeImagePipeline(VALID_IMAGE_BASE64)
    expect(requestedModel()).toBe("gemini-2.5-flash")
  })

  it("callGeminiVision の defaultModel 省略時(モデレーション/生成画像検証)は gemini-2.5-flash", async () => {
    await callGeminiVision(VALID_IMAGE_BASE64, "test prompt")
    expect(requestedModel()).toBe("gemini-2.5-flash")
  })
})
