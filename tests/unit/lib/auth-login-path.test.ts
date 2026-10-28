import { describe, expect, it } from "vitest"

import { LOGGED_OUT_PATH, loginPathFor } from "@/lib/auth/login-path"
import { isProtectedPath } from "@/lib/auth/protected-paths"
import { getDisplayName } from "@/lib/user-display-name"

describe("loginPathFor", () => {
  it("保護ページの戻り先を next に付けてログインへ送る", () => {
    expect(loginPathFor("/routes")).toBe("/login?next=%2Froutes")
    expect(loginPathFor("/map?reportId=abc&x=1")).toBe("/login?next=%2Fmap%3FreportId%3Dabc%26x%3D1")
  })

  it("アプリ外へ出る戻り先は付けない(open redirect 防止)", () => {
    expect(loginPathFor("//evil.example.com")).toBe("/login")
    expect(loginPathFor("https://evil.example.com/map")).toBe("/login")
    expect(loginPathFor("/\\evil")).toBe("/login")
  })

  it("自分でログアウトしたあとの行き先は全画面で同じ", () => {
    expect(LOGGED_OUT_PATH).toBe("/login?loggedOut=1")
  })
})

describe("isProtectedPath", () => {
  it("ログインが必要な画面を判定する", () => {
    expect(isProtectedPath("/routes")).toBe(true)
    expect(isProtectedPath("/map")).toBe(true)
    expect(isProtectedPath("/admin/reports")).toBe(true)
  })

  it("公開ページや接頭辞が似ているだけのパスは保護しない", () => {
    expect(isProtectedPath("/landing")).toBe(false)
    expect(isProtectedPath("/lp")).toBe(false)
    expect(isProtectedPath("/safety-quest/hunter")).toBe(false)
    expect(isProtectedPath("/mapping")).toBe(false)
  })
})

describe("getDisplayName", () => {
  it("表示名だけを呼び名にする(前後の空白は除く)", () => {
    expect(getDisplayName({ display_name: "  さくら  " })).toBe("さくら")
  })

  it("表示名が無ければ null(メールアドレスから呼び名を作らない)", () => {
    expect(getDisplayName({ display_name: null })).toBeNull()
    expect(getDisplayName({ display_name: "   " })).toBeNull()
    expect(getDisplayName(null)).toBeNull()
    expect(getDisplayName({ display_name: null, email: "taro.yamada@example.com" } as never)).toBeNull()
  })
})
