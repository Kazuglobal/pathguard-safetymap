import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * HunterGame(オーケストレータ)の特性テスト。
 * 重い子コンポーネント(マスク/地図/写真キャンバス)はスタブに差し替え、
 * 画面遷移・fetch 契約・結果画面の導線(ポイント/ミッション/ほかの あそびかた/採点失敗)を固定する。
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mutate: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("next/image", () => ({ default: (props: any) => <img {...props} /> }))
vi.mock("swr", () => ({ mutate: mocks.mutate }))

// next/dynamic: きろく画面(DangerMapScreen)とピン画面(LocationPinPicker)を同じスタブで受ける
vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicStub(props: any) {
      return (
        <div data-testid="dynamic-stub">
          <button type="button" onClick={() => props.onConfirm?.({ latitude: 33.59, longitude: 130.4 })}>
            pin-confirm
          </button>
          <button type="button" onClick={() => void props.onReplay?.("22222222-2222-4222-8222-222222222222")}>
            replay
          </button>
        </div>
      )
    },
}))

vi.mock("framer-motion", () => {
  const strip =
    (Tag: any) =>
    ({ children, layoutId, initial, animate, exit, transition, whileTap, whileHover, variants, custom, layout, ...props }: any) => (
      <Tag {...props}>{children}</Tag>
    )
  return {
    // どのタグ(motion.div/header/main/…)でも素通しの要素にする
    motion: new Proxy({}, { get: (_target, tag) => strip(String(tag)) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => true,
  }
})

vi.mock("@/components/safety-quest/hunter/onboarding", () => ({
  Onboarding: () => null,
  hasSeenOnboarding: () => true,
  markOnboardingSeen: vi.fn(),
}))
vi.mock("@/components/safety-quest/hunter/mask-confirm", () => ({
  MaskConfirm: (props: any) => (
    <button type="button" onClick={() => props.onConfirm("data:image/webp;base64,masked", 1)}>
      mask-confirm
    </button>
  ),
}))
vi.mock("@/components/safety-quest/hunter/explore-canvas", () => ({
  ExploreCanvas: (props: any) => (
    <button type="button" onClick={() => props.onTap({ x: 0.45, y: 0.55 })}>
      canvas-tap
    </button>
  ),
}))
vi.mock("@/components/safety-quest/hunter/safe-hunt-canvas", () => ({ SafeHuntCanvas: () => <div>safe-hunt</div> }))
vi.mock("@/components/safety-quest/hunter/quiz-panel", () => ({ HunterQuizPanel: () => <div>quiz-panel</div> }))
vi.mock("@/components/safety-quest/hunter/care-card", () => ({ CareCard: () => null }))

import { HunterGame } from "@/components/safety-quest/hunter/hunter-game"
import { SESSION_FAILURE_COPY } from "@/lib/hunter/session-client"

const hazard = {
  id: "sess-1-0",
  type: "見通しの悪い角",
  region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
  severity: "high",
  kidExplanation: "みぎの かどが 見えないよ",
  safeAction: "とまって みぎを 見よう",
  confidence: 0.9,
  kind: "blind_corner",
  accidentLink: null,
}

const analyzeBody = {
  sessionId: "sess-1",
  mode: "explore",
  hazards: [hazard],
  quiz: [],
  safePoints: [{ id: "sp-0", type: "ガードレール", region: { x: 0.1, y: 0.6, w: 0.2, h: 0.1 }, whyGood: "まもってくれる" }],
  accident: null,
  usedFallback: false,
  fallbackReason: null,
  noHazardFollow: null,
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

function installFetch(sessionResponse: Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/hunter/analyze")) return jsonResponse(200, analyzeBody)
    if (url.includes("/api/hunter/session")) return sessionResponse
    return jsonResponse(404, { error: "unexpected" })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

/** home → select → mask → pin → consent → analyzing → mode → explore(全発見) まで進める。 */
async function playThroughToExplore() {
  fireEvent.click(screen.getByRole("button", { name: /ぼうけんスタート/ }))
  const input = screen.getByLabelText("カメラで とる")
  fireEvent.change(input, { target: { files: [new File(["x"], "road.jpg", { type: "image/jpeg" })] } })
  fireEvent.click(await screen.findByText("mask-confirm"))
  fireEvent.click(await screen.findByText("pin-confirm"))
  fireEvent.click(await screen.findByRole("button", { name: /OK！はじめる/ }))
  fireEvent.click(await screen.findByText("たんけんモード"))
  fireEvent.click(await screen.findByText("canvas-tap"))
  await screen.findByText("ぜんぶ みつけた！けっかを みる")
}

describe("HunterGame — 結果画面の導線と採点契約", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it("sends the session with sessionId/taps, shows +pt and missions, and can return to other modes", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, {
        mode: "explore", score: 150, matches: 1, total: 1, comboMax: 1,
        pointsAwarded: 5, persistError: false,
        missionsCompleted: [{ title: "はじめての たんけん", rewardPoints: 50 }],
      }),
    )
    render(<HunterGame />)
    await playThroughToExplore()

    fireEvent.click(screen.getByText("ぜんぶ みつけた！けっかを みる"))
    await screen.findByText("+5pt")
    expect(screen.getByText("ミッション たっせい！")).toBeInTheDocument()
    expect(screen.getByText("はじめての たんけん")).toBeInTheDocument()
    expect(mocks.mutate).toHaveBeenCalledWith("user_points")
    expect(mocks.mutate).toHaveBeenCalledWith("missions")

    const sessionCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/hunter/session"))
    expect(sessionCall).toBeTruthy()
    const body = JSON.parse(String((sessionCall![1] as RequestInit).body))
    expect(body).toMatchObject({ mode: "explore", sessionId: "sess-1", taps: [{ x: 0.45, y: 0.55 }] })
    expect(body.photoId).toBeUndefined()

    // 同じ写真で ほかの あそびかた(安全さがし)へ戻れる = 解析結果を捨てない
    fireEvent.click(screen.getByRole("button", { name: /ほかの あそびかた/ }))
    expect(await screen.findByText("あんぜん さがし")).toBeInTheDocument()
    expect(screen.getByText("たんけんモード")).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/hunter/analyze"))).toHaveLength(1)
  })

  it("does not fabricate a 0-point result when scoring fails: explains and offers re-analysis", async () => {
    installFetch(jsonResponse(409, { error: "expired", code: "session_expired" }))
    render(<HunterGame />)
    await playThroughToExplore()

    fireEvent.click(screen.getByText("ぜんぶ みつけた！けっかを みる"))
    await screen.findByText(SESSION_FAILURE_COPY.expired)
    expect(screen.queryByText("がんばりポイント")).not.toBeInTheDocument()
    expect(screen.getByText("1こ みつけた がんばりは そのままだよ")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /もういちど AIに 見てもらう/ })).toBeInTheDocument()
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it("keeps the explore back button on the mode screen instead of discarding the analysis", async () => {
    installFetch(jsonResponse(200, { mode: "explore", score: 0, matches: 0, total: 1, comboMax: 0, pointsAwarded: 0 }))
    render(<HunterGame />)
    await playThroughToExplore()
    fireEvent.click(screen.getByRole("button", { name: /もどる/ }))
    expect(await screen.findByText("あんぜん さがし")).toBeInTheDocument()
  })
})
