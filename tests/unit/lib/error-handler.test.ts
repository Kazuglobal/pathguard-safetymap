import { describe, expect, it } from "vitest"

import { handleError } from "@/lib/error-handler"

describe("handleError", () => {
  it("maps browser 'Load failed' errors to a user-friendly network message", () => {
    const message = handleError(new Error("Load failed"), "fallback")

    expect(message).toBe("ネットワークエラーが発生しました。インターネット接続を確認してください。")
  })

  it("keeps meaningful non-network messages intact", () => {
    const message = handleError(new Error("画像生成に失敗しました (500)"), "fallback")

    expect(message).toBe("画像生成に失敗しました (500)")
  })
})
