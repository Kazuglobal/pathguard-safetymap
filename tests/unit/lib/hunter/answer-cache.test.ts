import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { setSpy, getSpy } = vi.hoisted(() => ({
  setSpy: vi.fn(),
  getSpy: vi.fn(),
}))

vi.mock("@upstash/redis", () => ({
  Redis: class {
    set = setSpy
    get = getSpy
  },
}))

import {
  getAnswerKey,
  putAnswerKey,
  type HunterAnswerKey,
} from "@/lib/hunter/answer-cache"

const sampleKey: HunterAnswerKey = {
  hazards: [
    { id: "s-0", region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, severity: "high", confidence: 0.9 },
  ],
  quiz: [{ id: "q-choice-0", kind: "choice", correctChoiceId: "c0" }],
}

const ENV_URL = "https://example.upstash.io"
const ENV_TOKEN = "token-abc"

let savedUrl: string | undefined
let savedToken: string | undefined

beforeEach(() => {
  vi.clearAllMocks()
  savedUrl = process.env.UPSTASH_REDIS_REST_URL
  savedToken = process.env.UPSTASH_REDIS_REST_TOKEN
})

afterEach(() => {
  if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
  else process.env.UPSTASH_REDIS_REST_URL = savedUrl
  if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken
})

function configure() {
  process.env.UPSTASH_REDIS_REST_URL = ENV_URL
  process.env.UPSTASH_REDIS_REST_TOKEN = ENV_TOKEN
}

function unconfigure() {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
}

describe("answer-cache (unconfigured = no-op / backward compatible)", () => {
  it("putAnswerKey does not call redis when Upstash is unconfigured", async () => {
    unconfigure()
    await putAnswerKey("sess", sampleKey)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it("getAnswerKey returns null when Upstash is unconfigured", async () => {
    unconfigure()
    expect(await getAnswerKey("sess")).toBeNull()
    expect(getSpy).not.toHaveBeenCalled()
  })
})

describe("answer-cache (configured)", () => {
  it("putAnswerKey stores the JSON with a 30-minute TTL", async () => {
    configure()
    await putAnswerKey("sess", sampleKey)
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith(
      "hunter:answer:sess",
      JSON.stringify(sampleKey),
      { ex: 1800 },
    )
  })

  it("getAnswerKey restores the key from a JSON string", async () => {
    configure()
    getSpy.mockResolvedValueOnce(JSON.stringify(sampleKey))
    expect(await getAnswerKey("sess")).toEqual(sampleKey)
    expect(getSpy).toHaveBeenCalledWith("hunter:answer:sess")
  })

  it("getAnswerKey restores the key when Upstash auto-deserializes to an object", async () => {
    configure()
    getSpy.mockResolvedValueOnce(sampleKey)
    expect(await getAnswerKey("sess")).toEqual(sampleKey)
  })

  it("getAnswerKey returns null on a cache miss", async () => {
    configure()
    getSpy.mockResolvedValueOnce(null)
    expect(await getAnswerKey("sess")).toBeNull()
  })

  it("getAnswerKey returns null (never throws) when redis errors", async () => {
    configure()
    getSpy.mockRejectedValueOnce(new Error("redis down"))
    await expect(getAnswerKey("sess")).resolves.toBeNull()
  })

  it("putAnswerKey resolves (never throws) when redis errors", async () => {
    configure()
    setSpy.mockRejectedValueOnce(new Error("redis down"))
    await expect(putAnswerKey("sess", sampleKey)).resolves.toBeUndefined()
  })

  it("does nothing when sessionId is empty", async () => {
    configure()
    await putAnswerKey("", sampleKey)
    expect(await getAnswerKey("")).toBeNull()
    expect(setSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()
  })
})
