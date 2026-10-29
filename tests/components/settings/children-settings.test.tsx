import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ChildrenSettings } from "@/components/settings/children-settings"
import type { ChildJson } from "@/lib/children-api"

function child(overrides: Partial<ChildJson>): ChildJson {
  return {
    id: "child-1", nickname: "さくちゃん", grade: null, school_district_id: null, school_district: null, nickname_confirmed: true,
    ...overrides,
  }
}

type Call = { url: string; method: string; body: unknown }

function setupApi(initial: ChildJson[], options: { failCreateWith?: string } = {}) {
  let current = [...initial]
  const calls: Call[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body })
    if (url.startsWith("/api/school-districts")) {
      return new Response(JSON.stringify({ cities: [], districts: [] }), { status: 200 })
    }
    if (method === "POST") {
      if (options.failCreateWith) return new Response(JSON.stringify({ error: options.failCreateWith }), { status: 400 })
      current = [...current, child({ id: `child-${current.length + 1}`, nickname: body.nickname, grade: body.grade })]
      return new Response(JSON.stringify({ child: current[current.length - 1] }), { status: 201 })
    }
    if (method === "PATCH") {
      const id = decodeURIComponent(url.split("/").pop() ?? "")
      current = current.map((item) => (item.id === id ? { ...item, ...body, nickname_confirmed: true } : item))
      return new Response(JSON.stringify({ child: current.find((item) => item.id === id) }), { status: 200 })
    }
    if (method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "")
      current = current.filter((item) => item.id !== id)
      return new Response(JSON.stringify({ deleted: true }), { status: 200 })
    }
    return new Response(JSON.stringify({ children: current }), { status: 200 })
  }))
  return calls
}

describe("ChildrenSettings(お子さまの登録)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("呼び名と学年・学区を一覧に出し、本名ではなく呼び名でと添える", async () => {
    setupApi([child({ grade: 3, school_district_id: "d1", school_district: { name: "第一小学校区", city: "新宿区", prefecture: "東京都" } })])
    render(<ChildrenSettings />)

    expect(await screen.findByText("さくちゃん")).toBeInTheDocument()
    expect(screen.getByText("3年生 · 新宿区 第一小学校区")).toBeInTheDocument()
    expect(screen.getByText(/本名ではなく呼び名で登録します/)).toBeInTheDocument()
  })

  it("呼び名を入れて登録できる(本名ではなく呼び名で、を入力欄に添える)", async () => {
    const calls = setupApi([])
    const user = userEvent.setup()
    render(<ChildrenSettings />)

    await user.click(await screen.findByRole("button", { name: "お子さまを追加" }))
    const input = screen.getByLabelText("呼び名")
    expect(input).toHaveAccessibleDescription(/本名ではなく、家族で使う呼び名/)
    await user.type(input, "だいくん")
    await user.selectOptions(screen.getByLabelText("学年(任意)"), "2")
    await user.click(screen.getByRole("button", { name: "登録する" }))

    expect(await screen.findByText("だいくん")).toBeInTheDocument()
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ nickname: "だいくん", grade: 2, school_district_id: null })
  })

  it("呼び名が空なら送らずに知らせ、API の日本語のエラーはそのまま出す", async () => {
    const calls = setupApi([], { failCreateWith: "同じ呼び名がすでに登録されています" })
    const user = userEvent.setup()
    render(<ChildrenSettings />)

    await user.click(await screen.findByRole("button", { name: "お子さまを追加" }))
    await user.click(screen.getByRole("button", { name: "登録する" }))
    expect(screen.getByRole("alert")).toHaveTextContent("呼び名を入力してください")
    expect(calls.some((call) => call.method === "POST")).toBe(false)

    await user.type(screen.getByLabelText("呼び名"), "さくちゃん")
    await user.click(screen.getByRole("button", { name: "登録する" }))
    expect(await screen.findByText("同じ呼び名がすでに登録されています")).toBeInTheDocument()
  })

  it("通学路から移した呼び名は、本名でないか確かめる案内を出し、「このままでよい」で閉じる", async () => {
    const calls = setupApi([child({ id: "child-1", nickname: "さくら", nickname_confirmed: false })])
    const user = userEvent.setup()
    render(<ChildrenSettings />)

    const review = await screen.findByTestId("child-nickname-review")
    expect(review).toHaveTextContent("呼び名が本名になっていないか確かめてください")
    expect(review).toHaveTextContent("さくら")
    await user.click(within(review).getByRole("button", { name: "このままでよい" }))

    await waitFor(() => expect(screen.queryByTestId("child-nickname-review")).not.toBeInTheDocument())
    expect(calls.find((call) => call.method === "PATCH")).toEqual({ url: "/api/children/child-1", method: "PATCH", body: { confirm_nickname: true } })
  })

  it("消すときは画面の中で確かめ、通学路は残ることを伝える(ブラウザの確認ダイアログは使わない)", async () => {
    const calls = setupApi([child({ id: "child-1", nickname: "さくちゃん" })])
    const confirmSpy = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    render(<ChildrenSettings />)

    await user.click(await screen.findByRole("button", { name: "さくちゃんを消す" }))
    expect(screen.getByText(/通学路は残り/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "消す" }))

    await waitFor(() => expect(screen.queryByText("さくちゃん")).not.toBeInTheDocument())
    expect(calls.some((call) => call.method === "DELETE" && call.url === "/api/children/child-1")).toBe(true)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it("読み込めなかったら理由と「もう一度読み込む」を出す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })))
    render(<ChildrenSettings />)

    expect(await screen.findByText("お子さまの登録を読み込めませんでした。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "もう一度読み込む" })).toBeInTheDocument()
  })
})
