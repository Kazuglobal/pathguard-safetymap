import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockGenerateImage = vi.fn()
  const mockGenerateImageWithOpenAI = vi.fn()
  const mockLogApiUsage = vi.fn()
  const mockCalculateImageGenerationCost = vi.fn(() => 0.01)
  const mockCalculateCost = vi.fn(() => 0)
  const mockCalculateOpenAICost = vi.fn(() => 0.053)
  const mockSetContext = vi.fn()
  const mockAddBreadcrumb = vi.fn()
  const mockReadFileWithSentryContext = vi.fn(async () => new ArrayBuffer(4))
  const mockVerifyOrRegenerate = vi.fn()
  const mockCheckImageGenRateLimit = vi.fn()

  return {
    mockGetUser,
    mockGenerateImage,
    mockGenerateImageWithOpenAI,
    mockLogApiUsage,
    mockCalculateImageGenerationCost,
    mockCalculateCost,
    mockCalculateOpenAICost,
    mockSetContext,
    mockAddBreadcrumb,
    mockReadFileWithSentryContext,
    mockVerifyOrRegenerate,
    mockCheckImageGenRateLimit,
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/gemini-image", () => ({
  generateImageWithGeminiWithModel: mocks.mockGenerateImage,
  FORCED_GEMINI_IMAGE_MODEL: "gemini-3.1-flash-lite-image",
}))

vi.mock("@/lib/openai-image", () => ({
  generateImageWithOpenAIWithModel: mocks.mockGenerateImageWithOpenAI,
  FORCED_OPENAI_IMAGE_MODEL: "gpt-image-2",
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: mocks.mockLogApiUsage,
}))

vi.mock("@/lib/api-cost-calculator", () => ({
  estimateImageGenerationCost: mocks.mockCalculateImageGenerationCost,
  calculateCost: mocks.mockCalculateCost,
  calculateOpenAIImageGenerationCost: mocks.mockCalculateOpenAICost,
}))

vi.mock("@/lib/sentry-upload-context", () => ({
  readFileWithSentryContext: mocks.mockReadFileWithSentryContext,
}))

vi.mock("@/lib/upstash-rate-limiter", () => ({
  checkImageGenerationRateLimit: mocks.mockCheckImageGenRateLimit,
  rateLimitedResponse: () =>
    new Response(JSON.stringify({ error: "リクエストが多すぎます。しばらく後にお試しください。" }), {
      status: 429,
    }),
}))

// 検証レイヤーは既定で素通し(実物の「画像なし」パスと同じ形状を返す)。
// ガード/是正サフィックスの合成順テストではケース内で実装を差し替える。
vi.mock("@/lib/disaster-image-verification", () => ({
  verifyOrRegenerateImages: mocks.mockVerifyOrRegenerate,
}))

vi.mock("@sentry/nextjs", () => ({
  setContext: mocks.mockSetContext,
  addBreadcrumb: mocks.mockAddBreadcrumb,
  captureException: vi.fn(),
}))

async function loadRoute() {
  vi.resetModules()
  return import("@/app/api/gemini/generate-image/route")
}

function buildMultipartRequest(generationMode: "standard" | "disaster") {
  const form = new FormData()
  form.append("prompt", "test prompt")
  form.append("generationMode", generationMode)
  return new Request("http://localhost/api/gemini/generate-image", {
    method: "POST",
    body: form,
  })
}

describe("app/api/gemini/generate-image route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mocks.mockCheckImageGenRateLimit.mockResolvedValue({ success: true })
    mocks.mockGenerateImage.mockResolvedValue({
      images: [],
      model: "gemini-3.1-flash-lite-image",
    })
    mocks.mockVerifyOrRegenerate.mockImplementation(async ({ images }: { images: unknown[] }) => ({
      images,
      verificationRequestCount: 0,
    }))
  })

  it("レート制限超過時は 429 を返し、生成APIを呼ばない", async () => {
    mocks.mockCheckImageGenRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    const { POST } = await loadRoute()

    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(429)
    expect(mocks.mockCheckImageGenRateLimit).toHaveBeenCalledWith("user-1")
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImageWithOpenAI).not.toHaveBeenCalled()
  })

  it("APIキー未設定(サーバ設定不備)は 401 ではなく 503 を返し、生メッセージを漏らさない", async () => {
    mocks.mockGenerateImage.mockRejectedValueOnce(
      new Error("OPENAI_API_KEY environment variable is not set"),
    )
    const { POST } = await loadRoute()

    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(503)
    const body = await (res as Response).json()
    expect(body.error).not.toContain("OPENAI_API_KEY")
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is standard", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("logs usage under the gemini provider without stale token fields", async () => {
    const { POST } = await loadRoute()
    await POST(buildMultipartRequest("standard") as any)

    expect(mocks.mockLogApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        api_provider: "gemini",
        model_name: "gemini-3.1-flash-lite-image",
        success: true,
      }),
    )
    const loggedEntry = mocks.mockLogApiUsage.mock.calls[0][0]
    expect(loggedEntry.input_tokens).toBeUndefined()
    expect(loggedEntry.output_tokens).toBeUndefined()
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is disaster", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("disaster") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("clears route timeout when generation fails before timeout fires", async () => {
    const originalSetTimeout = globalThis.setTimeout
    let timerHandle: ReturnType<typeof setTimeout> | undefined
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const id = originalSetTimeout(handler as any, timeout as any, ...(args as any[]))
        timerHandle = id
        return id
      }) as any)
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")

    mocks.mockGenerateImage.mockRejectedValueOnce(new Error("upstream failure"))

    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(500)
    expect(timerHandle).toBeDefined()
    expect(
      clearTimeoutSpy.mock.calls.some(([id]) => id === timerHandle),
    ).toBe(true)

    setTimeoutSpy.mockRestore()
    clearTimeoutSpy.mockRestore()
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is omitted", async () => {
    const { POST } = await loadRoute()
    const form = new FormData()
    form.append("prompt", "test prompt")
    const request = new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    })
    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  const buildImageRequest = (generationMode?: string) => {
    const file = { name: "input.png", type: "image/png", size: 4 }
    return {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: vi.fn(async () => ({
        get: (key: string) =>
          key === "prompt" ? "test prompt"
          : key === "image" ? file
          : key === "generationMode" ? generationMode ?? null
          : null,
      })),
    }
  }

  it("standard+画像+プロンプトのとき SCENE_PRESERVATION_GUARD_SUFFIX が末尾に付与される", async () => {
    const { SCENE_PRESERVATION_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
    const { POST } = await loadRoute()

    const res = await POST(buildImageRequest("standard") as any)

    expect(res.status).toBe(200)
    const prompt: string = mocks.mockGenerateImage.mock.calls[0][0].prompt
    expect(prompt.startsWith("test prompt")).toBe(true)
    expect(prompt.endsWith(SCENE_PRESERVATION_GUARD_SUFFIX)).toBe(true)
  })

  it("generationMode='disaster' にはガードを付与しない", async () => {
    const { POST } = await loadRoute()

    await POST(buildImageRequest("disaster") as any)

    expect(mocks.mockGenerateImage.mock.calls[0][0].prompt).toBe("test prompt")
  })

  it("generationMode 未指定(/tools/image-gen 互換)にはガードを付与しない", async () => {
    const { POST } = await loadRoute()

    await POST(buildImageRequest(undefined) as any)

    expect(mocks.mockGenerateImage.mock.calls[0][0].prompt).toBe("test prompt")
  })

  it("是正再生成時のプロンプトは『基底→ガード→是正サフィックス』の順序になる", async () => {
    const { SCENE_PRESERVATION_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
    mocks.mockGenerateImage.mockResolvedValue({
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,xxxx" }],
      model: "gemini-3.1-flash-lite-image",
    })
    mocks.mockVerifyOrRegenerate.mockImplementationOnce(
      async ({ regenerate }: { regenerate: (s: string) => Promise<unknown[]> }) => {
        const regenerated = await regenerate("[CORRECTIVE-SUFFIX]")
        return { images: regenerated, verificationRequestCount: 2 }
      },
    )
    const { POST } = await loadRoute()

    const res = await POST(buildImageRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledTimes(2)
    const regenPrompt: string = mocks.mockGenerateImage.mock.calls[1][0].prompt
    const baseIdx = regenPrompt.indexOf("test prompt")
    const guardIdx = regenPrompt.indexOf(SCENE_PRESERVATION_GUARD_SUFFIX)
    const correctiveIdx = regenPrompt.indexOf("[CORRECTIVE-SUFFIX]")
    expect(baseIdx).toBe(0)
    expect(guardIdx).toBeGreaterThan(baseIdx)
    expect(correctiveIdx).toBeGreaterThan(guardIdx)
  })

  describe("textInImage=true (日本語テキスト入り素材はGPT Image 2へ)", () => {
    const buildTextInImageRequest = () => {
      const form = new FormData()
      form.append("prompt", "「とまれ」と書いたポスター")
      form.append("textInImage", "true")
      return new Request("http://localhost/api/gemini/generate-image", {
        method: "POST",
        body: form,
      })
    }

    beforeEach(() => {
      mocks.mockGenerateImageWithOpenAI.mockResolvedValue({
        images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,yyyy" }],
        model: "gpt-image-2",
        usage: { inputTokens: 100, inputImageTokens: 0, inputTextTokens: 100, outputTokens: 4000 },
      })
    })

    it("OpenAI(GPT Image 2)で生成し、Geminiは呼ばない", async () => {
      const { POST } = await loadRoute()
      const res = await POST(buildTextInImageRequest() as any)

      expect(res.status).toBe(200)
      expect(mocks.mockGenerateImageWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "「とまれ」と書いたポスター" }),
      )
      expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
      const body = await (res as Response).json()
      expect(body.images).toHaveLength(1)
    })

    it("文字入り素材にはガードサフィックスを付与しない(文字を入れる用途のため)", async () => {
      const { SCENE_PRESERVATION_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
      const { POST } = await loadRoute()

      await POST(buildTextInImageRequest() as any)

      const prompt: string = mocks.mockGenerateImageWithOpenAI.mock.calls[0][0].prompt
      expect(prompt.includes(SCENE_PRESERVATION_GUARD_SUFFIX)).toBe(false)
    })

    it("元写真つきの文字入り素材には匿名化+安全看板ガードを付与する", async () => {
      const { TEXT_ASSET_PRIVACY_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
      const { POST } = await loadRoute()

      const file = new File([new Uint8Array([1, 2, 3])], "base.png", { type: "image/png" })
      const req = {
        headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
        formData: vi.fn(async () => ({
          get: (key: string) =>
            key === "prompt" ? "「とまれ」と書いたポスター"
            : key === "image" ? file
            : key === "textInImage" ? "true"
            : null,
        })),
      }

      await POST(req as any)

      const prompt: string = mocks.mockGenerateImageWithOpenAI.mock.calls[0][0].prompt
      expect(prompt.startsWith("「とまれ」と書いたポスター")).toBe(true)
      expect(prompt.endsWith(TEXT_ASSET_PRIVACY_GUARD_SUFFIX)).toBe(true)
      // 「余計な文字禁止」条項は文字を入れる用途と矛盾するため付けない
      expect(prompt).not.toContain("Add no text beyond")
    })

    it("災害画像向けの機械検証は実行しない", async () => {
      const { POST } = await loadRoute()
      await POST(buildTextInImageRequest() as any)
      expect(mocks.mockVerifyOrRegenerate).not.toHaveBeenCalled()
    })

    it("使用量ログは openai プロバイダ・トークン実測ベースのコストで記録する", async () => {
      const { POST } = await loadRoute()
      await POST(buildTextInImageRequest() as any)

      expect(mocks.mockCalculateOpenAICost).toHaveBeenCalledWith(
        "gpt-image-2",
        expect.objectContaining({ outputTokens: 4000 }),
      )
      expect(mocks.mockLogApiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: "openai",
          api_endpoint: "generate-image",
          model_name: "gpt-image-2",
          estimated_cost_usd: 0.053,
          success: true,
        }),
      )
    })

    it("OpenAI失敗時は openai プロバイダで失敗ログを残し、5xxを返す", async () => {
      mocks.mockGenerateImageWithOpenAI.mockRejectedValueOnce(new Error("openai down"))
      const { POST } = await loadRoute()

      const res = await POST(buildTextInImageRequest() as any)

      expect(res.status).toBe(500)
      expect(mocks.mockLogApiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: "openai",
          model_name: "gpt-image-2",
          success: false,
        }),
      )
    })

    it("textInImage が無い従来リクエストは引き続き Gemini で生成する", async () => {
      const { POST } = await loadRoute()
      await POST(buildMultipartRequest("standard") as any)

      expect(mocks.mockGenerateImage).toHaveBeenCalled()
      expect(mocks.mockGenerateImageWithOpenAI).not.toHaveBeenCalled()
    })
  })

  it("reads multipart image data through the Sentry context helper", async () => {
    const { POST } = await loadRoute()
    const file = {
      name: "input.png",
      type: "image/png",
      size: 4,
    }
    const request = {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: vi.fn(async () => ({
        get: (key: string) => key === "prompt" ? "test prompt" : key === "image" ? file : null,
      })),
    }

    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockReadFileWithSentryContext).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/gemini/generate-image",
        fieldName: "image",
        file,
      }),
    )
  })
})
