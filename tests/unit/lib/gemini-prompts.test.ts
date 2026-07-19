import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generateDisasterPrompts } from "@/lib/gemini-prompts"
import { FALLBACK_SIMULATION_PROMPTS, FALLBACK_VIZ_PROMPT } from "@/lib/disaster-image-prompt-fallbacks"

const VALID_RESULT = {
  riskObservation: { elements: ["concrete block wall (right, foreground)"], tableMarkdown: "| a |" },
  structureConditions: [
    { object: "concrete block wall (right, foreground)", conditionTier: "aging", maxDamage: "a few visible cracks" },
  ],
  vizPrompt: "Using the provided photo as the immutable base image, add overlays.",
  simulationPrompts: {
    earthquake: "Edit the provided photo. eq",
    typhoon: "Edit the provided photo. ty",
    flood: "Edit the provided photo. fl",
    fire: "Edit the provided photo. fi",
  },
}

function mockFetchWith(text: string) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const IMAGE = `data:image/png;base64,${"a".repeat(80)}`

describe("generateDisasterPrompts", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GEMINI_API_KEY
  })

  it("構造化出力(temperature 0.2 / responseMimeType / propertyOrdering)で呼び出し、maxOutputTokens は設定しない", async () => {
    const fetchMock = mockFetchWith(JSON.stringify(VALID_RESULT))

    await generateDisasterPrompts(IMAGE)

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    expect(body.generationConfig.temperature).toBe(0.2)
    expect(body.generationConfig.responseMimeType).toBe("application/json")
    expect(body.generationConfig.responseSchema.propertyOrdering).toEqual([
      "riskObservation",
      "structureConditions",
      "vizPrompt",
      "simulationPrompts",
    ])
    // thinking トークンとの出力予算競合で切断を誘発するため、明示キャップは置かない
    expect(body.generationConfig.maxOutputTokens).toBeUndefined()
  })

  it("instruction は edit 指示・condition-first 台帳・英語 LANGUAGE RULE を含む", async () => {
    const fetchMock = mockFetchWith(JSON.stringify(VALID_RESULT))

    await generateDisasterPrompts(IMAGE)

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    const instruction: string = body.contents[0].parts.find((p: any) => p.text).text
    expect(instruction).toContain("Using the provided photo as the immutable base image")
    expect(instruction).toContain("Edit the provided photo")
    expect(instruction).toContain("structureConditions")
    expect(instruction).toContain("LANGUAGE RULE")
    expect(instruction).toContain("EXECUTION FACT")
  })

  it("injects objective accident context only as vizPrompt prioritization", async () => {
    const fetchMock = mockFetchWith(JSON.stringify(VALID_RESULT))
    const context = "[objective accident context] 12 accidents, morning peak"

    await generateDisasterPrompts(IMAGE, { accidentContext: context } as any)

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    const instruction: string = body.contents[0].parts.find((p: any) => p.text).text
    expect(instruction).toContain(context)
    expect(instruction).toContain("apply only to prioritization in vizPrompt")
    expect(instruction).toContain("do not add objects absent from the photo")
    expect(instruction).toContain("do not alter the four disaster simulation prompts")
  })

  it("instruction は可視化・4シミュレーションへ未確認の安全標識追加禁止を要求する", async () => {
    const fetchMock = mockFetchWith(JSON.stringify(VALID_RESULT))

    await generateDisasterPrompts(IMAGE)

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    const instruction: string = body.contents[0].parts.find((p: any) => p.text).text
    const guard =
      "Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign"

    expect(instruction.match(new RegExp(guard, "g"))).toHaveLength(2)
    expect(instruction).toContain(
      "Preserve any such item already visible in the source photo unchanged.",
    )
    expect(instruction).not.toContain("子ども110番")
    expect(instruction).not.toContain("110番の家")
    expect(instruction).not.toContain("child-refuge")
  })

  it("素のJSON応答をパースできる", async () => {
    mockFetchWith(JSON.stringify(VALID_RESULT))

    const result = await generateDisasterPrompts(IMAGE)

    expect(result.vizPrompt).toBe(VALID_RESULT.vizPrompt)
    expect(result.simulationPrompts.earthquake).toBe("Edit the provided photo. eq")
  })

  it("コードフェンス付き応答も extractFirstJson の救済でパースできる", async () => {
    mockFetchWith("```json\n" + JSON.stringify(VALID_RESULT) + "\n```")

    const result = await generateDisasterPrompts(IMAGE)

    expect(result.vizPrompt).toBe(VALID_RESULT.vizPrompt)
  })

  it("structureConditions が応答に含まれても返却型は既存キーのみ(GeneratedPrompts 形状不変)", async () => {
    mockFetchWith(JSON.stringify(VALID_RESULT))

    const result = await generateDisasterPrompts(IMAGE)

    expect(Object.keys(result).sort()).toEqual(["riskObservation", "simulationPrompts", "vizPrompt"])
  })

  it("vizPrompt / simulationPrompts の欠落・空文字は各フォールバックへ落ちる(既存挙動の維持)", async () => {
    mockFetchWith(
      JSON.stringify({
        riskObservation: { elements: [], tableMarkdown: "" },
        structureConditions: [],
        vizPrompt: "",
        simulationPrompts: { earthquake: "", typhoon: "ok typhoon", flood: "", fire: "" },
      }),
    )

    const result = await generateDisasterPrompts(IMAGE)

    expect(result.vizPrompt).toBe(FALLBACK_VIZ_PROMPT)
    expect(result.simulationPrompts.earthquake).toBe(FALLBACK_SIMULATION_PROMPTS.earthquake)
    expect(result.simulationPrompts.typhoon).toBe("ok typhoon")
    expect(result.simulationPrompts.flood).toBe(FALLBACK_SIMULATION_PROMPTS.flood)
    expect(result.simulationPrompts.fire).toBe(FALLBACK_SIMULATION_PROMPTS.fire)
  })
})
