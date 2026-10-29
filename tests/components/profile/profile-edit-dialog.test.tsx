import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProfileEditDialog } from "@/components/profile/profile-edit-dialog"

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))

type FetchCall = { url: string; init?: RequestInit }

function setupFetch(profile: { display_name: string | null; avatar_url: string | null }) {
  const calls: FetchCall[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url === "/api/profile/avatar") {
      return { ok: true, json: async () => ({ avatar_url: "/api/media/avatars/u/new.webp" }) }
    }
    if (url === "/api/profile" && init?.method === "PATCH") {
      return { ok: true, json: async () => ({ profile: { ...profile, ...JSON.parse(String(init.body)) } }) }
    }
    return { ok: true, json: async () => ({ profile }) }
  })
  vi.stubGlobal("fetch", fetchMock)
  return calls
}

function renderDialog() {
  const onProfileUpdated = vi.fn()
  const onOpenChange = vi.fn()
  render(<ProfileEditDialog open onOpenChange={onOpenChange} onProfileUpdated={onProfileUpdated} />)
  return { onProfileUpdated, onOpenChange }
}

describe("ProfileEditDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => "blob:preview")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("氏名の欄は無く、表示名がほかの人に見えることを添える", async () => {
    setupFetch({ display_name: "さくらママ", avatar_url: null })
    renderDialog()

    expect(await screen.findByDisplayValue("さくらママ")).toBeInTheDocument()
    expect(screen.queryByLabelText(/氏名/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("full-name-input")).not.toBeInTheDocument()
    expect(screen.getByText(/本名ではなくニックネーム/)).toBeInTheDocument()
  })

  it("表示名が未設定でも、アイコンだけを変えて保存できる(プロフィールの PATCH は送らない)", async () => {
    const calls = setupFetch({ display_name: null, avatar_url: null })
    const { onProfileUpdated } = renderDialog()
    const user = userEvent.setup()

    await screen.findByTestId("profile-edit-form")
    expect(screen.getByTestId("profile-save-button")).toBeDisabled()

    await user.upload(screen.getByTestId("avatar-file-input"), new File(["icon"], "icon.png", { type: "image/png" }))
    const save = screen.getByTestId("profile-save-button")
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => expect(onProfileUpdated).toHaveBeenCalledTimes(1))
    expect(calls.map((call) => call.url)).toEqual(["/api/profile", "/api/profile/avatar"])
    expect(screen.queryByText("表示名を入力してください")).not.toBeInTheDocument()
  })

  it("表示名を変えたら、表示名だけを送る(氏名は送らない)", async () => {
    const calls = setupFetch({ display_name: "前の名前", avatar_url: null })
    const { onProfileUpdated } = renderDialog()
    const user = userEvent.setup()

    const input = await screen.findByDisplayValue("前の名前")
    await user.clear(input)
    await user.type(input, "  さくらママ ")
    await user.click(screen.getByTestId("profile-save-button"))

    await waitFor(() => expect(onProfileUpdated).toHaveBeenCalledTimes(1))
    const patch = calls.find((call) => call.init?.method === "PATCH")
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ display_name: "さくらママ" })
    expect(calls.some((call) => call.url === "/api/profile/avatar")).toBe(false)
  })

  it("入っていた表示名を消したら保存せずに知らせる", async () => {
    const calls = setupFetch({ display_name: "前の名前", avatar_url: null })
    renderDialog()
    const user = userEvent.setup()

    await user.clear(await screen.findByDisplayValue("前の名前"))
    await user.click(screen.getByTestId("profile-save-button"))

    expect(await screen.findByText("表示名を入力してください")).toBeInTheDocument()
    expect(calls.filter((call) => call.init?.method === "PATCH")).toHaveLength(0)
  })
})
