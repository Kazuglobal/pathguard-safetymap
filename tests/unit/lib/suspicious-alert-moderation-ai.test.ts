import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/gemini-hazard", () => ({
  callGeminiVision: vi.fn(),
}))

import { callGeminiVision } from "@/lib/gemini-hazard"
import { moderateSuspiciousAlertWithAi } from "@/lib/suspicious-alert-moderation-ai"

/** Gemini REST 応答の形（candidates[0].content.parts[].text）を組み立てる。 */
function geminiTextResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  }
}

function mockTextLlm(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(geminiTextResponse(payload))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const CLEAN_IMAGE_VERDICT = {
  identifiableFaces: false,
  readableLicensePlates: false,
  readableNameOrAddress: false,
  childrenVisible: false,
  otherRisks: [],
  summary: "人通りのない路地の風景写真です。",
}

describe("moderateSuspiciousAlertWithAi", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key")
    vi.stubEnv("GOOGLE_API_KEY", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("APIキー未設定ならヒューリスティック判定をそのまま返す（fetchしない）", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "下校時間に声かけ事案がありました。",
      hasImage: false,
    })

    expect(verdict.status).toBe("approved")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("正規表現をすり抜ける婉曲的な中傷をLLMが検出したら needs_review に倒す", async () => {
    // ヒューリスティック（NGワード照合）では approved になる文面
    mockTextLlm({
      risk: "high",
      categories: ["defamation"],
      reason: "指示語による特定人物の犯人扱いが含まれます。",
      confidence: 0.9,
    })

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "例の家の人、また出たみたいですね。皆さんお察しの通りの方ですよ。",
      hasImage: false,
    })

    expect(verdict.status).toBe("needs_review")
    expect(verdict.score).toBeGreaterThanOrEqual(0.9)
    expect(verdict.reason).toContain("AIテキスト審査")
  })

  it("LLMが低リスク・高確信ならヒューリスティックの approved を維持する", async () => {
    mockTextLlm({
      risk: "low",
      categories: [],
      reason: "客観的な状況共有で問題ありません。",
      confidence: 0.95,
    })

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "黒い服の男性に声をかけられました。",
      hasImage: false,
    })

    expect(verdict.status).toBe("approved")
    expect(verdict.reason).toContain("AIテキスト審査")
  })

  it("LLMが低リスクでも確信度が低ければ needs_review に倒す", async () => {
    mockTextLlm({
      risk: "low",
      categories: [],
      reason: "判断材料が少ないです。",
      confidence: 0.2,
    })

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "あー、またか。",
      hasImage: false,
    })

    expect(verdict.status).toBe("needs_review")
    expect(verdict.reason).toContain("確信度が低い")
  })

  it("LLM呼び出しが失敗したらヒューリスティック判定へフォールバックする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "下校時間に声かけ事案がありました。",
      hasImage: false,
    })

    expect(verdict.status).toBe("approved")
    expect(verdict.reason).toContain("低リスク")
  })

  it("LLM応答が破損JSONならヒューリスティックへフォールバックする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "これはJSONではありません" }] } }],
        }),
      }),
    )

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "下校時間に声かけ事案がありました。",
      hasImage: false,
    })

    expect(verdict.status).toBe("approved")
  })

  it("ヒューリスティックが needs_review（電話番号）ならLLMが低リスクでも緩めない", async () => {
    mockTextLlm({
      risk: "low",
      categories: [],
      reason: "問題ありません。",
      confidence: 0.95,
    })

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "連絡先 090-1234-5678 に電話してください。",
      hasImage: false,
    })

    expect(verdict.status).toBe("needs_review")
  })

  it("画像のVision審査がナンバープレートを検出したら理由とスコアに反映する", async () => {
    mockTextLlm({ risk: "low", categories: [], reason: "問題なし。", confidence: 0.9 })
    vi.mocked(callGeminiVision).mockResolvedValue(
      JSON.stringify({
        ...CLEAN_IMAGE_VERDICT,
        readableLicensePlates: true,
        summary: "駐車中の車のナンバーが判読できます。",
      }),
    )

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "白い車が停まっていました。",
      hasImage: true,
      imageDataUrls: ["data:image/jpeg;base64,QUJD"],
    })

    expect(verdict.status).toBe("needs_review")
    expect(verdict.score).toBeGreaterThanOrEqual(0.85)
    expect(verdict.reason).toContain("ナンバープレート")
  })

  it("Vision審査がクリーンでも画像付き投稿は自動公開しない（needs_review 維持）", async () => {
    mockTextLlm({ risk: "low", categories: [], reason: "問題なし。", confidence: 0.9 })
    vi.mocked(callGeminiVision).mockResolvedValue(JSON.stringify(CLEAN_IMAGE_VERDICT))

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "見通しの悪い角です。",
      hasImage: true,
      imageDataUrls: ["data:image/jpeg;base64,QUJD"],
    })

    expect(verdict.status).toBe("needs_review")
    expect(verdict.reason).toContain("AI画像審査")
    expect(verdict.reason).toContain("検出されませんでした")
  })

  it("Vision審査が全滅しても画像付きは従来どおり needs_review（理由はヒューリスティック）", async () => {
    mockTextLlm({ risk: "low", categories: [], reason: "問題なし。", confidence: 0.9 })
    vi.mocked(callGeminiVision).mockRejectedValue(new Error("vision down"))

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "声かけ事案",
      hasImage: true,
      imageDataUrls: ["data:image/jpeg;base64,QUJD"],
    })

    expect(verdict.status).toBe("needs_review")
    expect(verdict.reason).toContain("写真添付のため内容確認が必要")
  })

  it("複数画像はOR集約し、上限3枚までしかVisionを呼ばない", async () => {
    mockTextLlm({ risk: "low", categories: [], reason: "問題なし。", confidence: 0.9 })
    vi.mocked(callGeminiVision)
      .mockResolvedValueOnce(JSON.stringify(CLEAN_IMAGE_VERDICT))
      .mockResolvedValueOnce(
        JSON.stringify({ ...CLEAN_IMAGE_VERDICT, identifiableFaces: true, summary: "顔が判別できます。" }),
      )
      .mockResolvedValue(JSON.stringify(CLEAN_IMAGE_VERDICT))

    const verdict = await moderateSuspiciousAlertWithAi({
      text: "気になる人がいました。",
      hasImage: true,
      imageDataUrls: [
        "data:image/jpeg;base64,QQ==",
        "data:image/jpeg;base64,Qg==",
        "data:image/jpeg;base64,Qw==",
        "data:image/jpeg;base64,RA==",
      ],
    })

    expect(vi.mocked(callGeminiVision)).toHaveBeenCalledTimes(3)
    expect(verdict.status).toBe("needs_review")
    expect(verdict.reason).toContain("識別可能な顔")
  })
})
