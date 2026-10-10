// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }))
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create }
    constructor(options: unknown) { mocks.options(options) }
  },
}))
import { callClaudeVision, CLAUDE_VISION_DEFAULT_MODEL } from "@/lib/claude-vision"

const input = { base64: "test-image", mediaType: "image/png" as const, prompt: "Return JSON" }

describe("Claude vision JSON analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
    vi.stubEnv("CLAUDE_VISION_MODEL", "")
    mocks.create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"hazards":[]}' }] })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("uses Haiku 5.5 without spending the JSON budget on thinking or retrying beyond the route deadline", async () => {
    await expect(callClaudeVision(input)).resolves.toBe('{"hazards":[]}')
    expect(CLAUDE_VISION_DEFAULT_MODEL).toBe("claude-haiku-5-5")
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, timeout: 45_000 }))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-haiku-5-5", max_tokens: 8192, thinking: { type: "disabled" },
    }))
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("temperature")
  })

  it("honors the configured model and caller token budget", async () => {
    vi.stubEnv("CLAUDE_VISION_MODEL", " claude-haiku-5-5 ")
    await callClaudeVision({ ...input, maxTokens: 8000 })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ model: "claude-haiku-5-5", max_tokens: 8000 }))
  })

  it.each(["max_tokens", "refusal"])("rejects %s instead of treating incomplete output as analysis", async (reason) => {
    mocks.create.mockResolvedValue({ stop_reason: reason, content: [{ type: "text", text: "{}" }] })
    await expect(callClaudeVision(input)).rejects.toThrow()
  })
})
