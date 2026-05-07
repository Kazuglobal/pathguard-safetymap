import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import SafetyQuestClient from "@/app/safety-quest/safety-quest-client"

const postedChallenge = {
  id: "report-1",
  sourceType: "report",
  reportId: "1",
  title: "投稿写真の交差点",
  imageUrl: "https://example.com/route.jpg",
  thumbnailUrl: "https://example.com/route.jpg",
  areaLabel: "福岡市 中央区",
  difficulty: "hard",
  status: "active",
  aiDetections: [
    {
      category: "hazards",
      label: "見通し",
      description: "見通しが悪い",
      count: 1,
      confidence: 0.9,
      coverageRatio: 0.1,
      positions: [{ x: 0.3, y: 0.3, width: 0.2, height: 0.2 }],
    },
    {
      category: "traffic",
      label: "車のかげ",
      description: "車のかげに注意",
      count: 1,
      confidence: 0.86,
      coverageRatio: 0.08,
      positions: [{ x: 0.54, y: 0.42, width: 0.18, height: 0.18 }],
    },
    {
      category: "obstructions",
      label: "通路のせまさ",
      description: "歩く場所がせまい",
      count: 1,
      confidence: 0.8,
      coverageRatio: 0.06,
      positions: [{ x: 0.68, y: 0.58, width: 0.14, height: 0.16 }],
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openChallenge(user: ReturnType<typeof userEvent.setup>) {
  render(<SafetyQuestClient />)
  await user.click(screen.getByRole("button", { name: "出発する" }))
  expect(screen.getByText("危険なところをタップしよう!")).toBeInTheDocument()
}

async function findAllHazards(user: ReturnType<typeof userEvent.setup>) {
  const markers = screen.getAllByRole("button", { name: "危険ポイント" })
  await user.click(markers[0])
  await user.click(markers[1])
  await user.click(markers[2])
}

describe("SafetyQuestClient", () => {
  it("loads public challenge feed and starts the selected posted route challenge", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        challenges: [postedChallenge],
      }),
    }))

    render(<SafetyQuestClient />)

    expect(await screen.findByText("投稿写真の交差点")).toBeInTheDocument()
    expect(screen.getByText("福岡市 中央区")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "出発する" }))

    expect(screen.getByText("投稿写真の交差点")).toBeInTheDocument()
    expect(screen.getByText("福岡市 中央区")).toBeInTheDocument()
  })

  it("submits the selected challenge attempt with marked hazards and quiz answer", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenges: [postedChallenge] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { pointsAwarded: 300, rewardKeys: ["lookout-master"] } }),
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<SafetyQuestClient />)

    await screen.findByText("投稿写真の交差点")
    await user.click(screen.getByRole("button", { name: "出発する" }))
    await findAllHazards(user)
    await user.click(screen.getByRole("button", { name: "クイズへすすむ" }))
    await user.click(screen.getByRole("button", { name: "とてもあぶない!" }))
    await user.click(screen.getAllByRole("button", { name: "報酬へ" })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/safety-quest/attempts",
        expect.objectContaining({ method: "POST" }),
      )
    })

    const attemptCall = fetchMock.mock.calls.find(([url]) => url === "/api/safety-quest/attempts")
    expect(attemptCall).toBeDefined()
    const body = JSON.parse(String(attemptCall?.[1]?.body))
    expect(body).toMatchObject({
      challengeId: "report-1",
      mode: "quiz-battle",
      answerPayload: { answer: "danger", correct: true },
    })
    expect(body.userMarkers).toHaveLength(3)
  })

  it("requires all three hazard markers before the player can continue to quiz battle", async () => {
    const user = userEvent.setup()
    await openChallenge(user)

    const markers = screen.getAllByRole("button", { name: "危険ポイント" })
    await user.click(markers[0])
    await user.click(markers[1])

    expect(screen.getByRole("button", { name: "クイズへすすむ" })).toBeDisabled()

    await user.click(markers[2])

    expect(screen.getByRole("button", { name: "クイズへすすむ" })).toBeEnabled()
  })

  it("keeps wrong quiz answers in the quiz flow and lets the player retry instead of opening rewards", async () => {
    const user = userEvent.setup()
    await openChallenge(user)
    await findAllHazards(user)
    await user.click(screen.getByRole("button", { name: "クイズへすすむ" }))

    await user.click(screen.getByRole("button", { name: "すぐにわたる!" }))
    await user.click(screen.getAllByRole("button", { name: "もう一度" })[0])

    expect(screen.getByRole("heading", { name: "ルートクイズバトル" })).toBeInTheDocument()
    expect(screen.queryByText("ミッション クリア!")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "もう一度" })).not.toBeInTheDocument()
  })

  it("updates daily mission progress after clearing the core hazard and quiz loop", async () => {
    const user = userEvent.setup()
    await openChallenge(user)
    await findAllHazards(user)
    await user.click(screen.getByRole("button", { name: "クイズへすすむ" }))
    await user.click(screen.getByRole("button", { name: "とてもあぶない!" }))
    await user.click(screen.getAllByRole("button", { name: "報酬へ" })[0])

    expect(screen.getByText("ミッション クリア!")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "つぎのステージへ!" }))

    const hazardMission = screen.getByText("あぶない場所を3つ見つけよう").closest("button")
    expect(hazardMission).not.toBeNull()
    expect(within(hazardMission!).getByText("クリア!")).toBeInTheDocument()
  })

  it("offers a private practice photo upload with child privacy guidance", async () => {
    const user = userEvent.setup()
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: /ARフォト/ }))

    expect(screen.getByText("自分で練習")).toBeInTheDocument()
    expect(screen.getByText(/顔・名前・学校名・家の入口・車のナンバー/)).toBeInTheDocument()

    const file = new File(["route-photo"], "practice-route.png", { type: "image/png" })
    await user.upload(screen.getByLabelText("練習写真をアップロード"), file)

    expect(screen.getByText("practice-route.png")).toBeInTheDocument()
    expect(screen.getByText("練習写真を準備しました")).toBeInTheDocument()
  })

  it("runs uploaded private practice photos through the private analysis API", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url) => {
      if (url === "/api/safety-quest/private-practice") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ score: { pointsAwarded: 80 }, private: true }),
        })
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: /ARフォト/ }))
    await user.upload(
      screen.getByLabelText("練習写真をアップロード"),
      new File(["route-photo"], "practice-route.png", { type: "image/png" }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/safety-quest/private-practice",
        expect.objectContaining({ method: "POST" }),
      )
    })

    const privatePracticeCall = fetchMock.mock.calls.find(([url]) => url === "/api/safety-quest/private-practice")
    expect(privatePracticeCall).toBeDefined()
    const body = JSON.parse(String(privatePracticeCall?.[1]?.body))
    expect(body.imageBase64).toMatch(/^data:image\/png;base64,/)
    expect(body.markers).toEqual([])
  })

  it("makes the shared back button return secondary screens to the adventure map", async () => {
    const user = userEvent.setup()
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: /クイズバトル/ }))
    await user.click(screen.getByRole("button", { name: "戻る" }))

    expect(screen.getByRole("heading", { name: "ぼうけんマップ" })).toBeInTheDocument()
  })

  it("makes side-mode controls update visible game state instead of staying decorative", async () => {
    const user = userEvent.setup()
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: /パトロール/ }))
    expect(screen.getByText("3/5")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "右へ" }))
    expect(screen.getByText("4/5")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "左へ" }))
    expect(screen.getByText("3/5")).toBeInTheDocument()
  })

  it("lets mystery, collection, ranking, and AR controls produce visible feedback", async () => {
    const user = userEvent.setup()
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: /なぞとき/ }))
    await user.click(screen.getByRole("button", { name: "こたえを決定する" }))
    expect(screen.getByText("正解!")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /ガチャ・コレクション/ }))
    await user.click(screen.getByRole("button", { name: "1回まわす 50" }))
    expect(screen.getByText("見通し名人をゲット!")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /ランキング/ }))
    await user.click(screen.getByRole("button", { name: "おともだちランキング" }))
    expect(screen.getByText("クラスの友だちと安全チャレンジ中")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /ARフォト/ }))
    await user.click(screen.getByRole("button", { name: "撮影" }))
    expect(screen.getByText("撮影しました。あぶないサイン +1")).toBeInTheDocument()
  })

  it("makes utility buttons and secondary tabs visibly respond", async () => {
    const user = userEvent.setup()
    render(<SafetyQuestClient />)

    await user.click(screen.getByRole("button", { name: "通知" }))
    expect(screen.getByText("今日の安全通知: 夕方は見通しの悪い交差点に気をつけよう")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "ヘルプ" }))
    expect(screen.getByText("画面の青いボタンを押すと、次の安全アクションに進めます。")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /協力ミッション/ }))
    await user.click(screen.getByRole("button", { name: "かぞくチーム" }))
    expect(screen.getByText("かぞくチームで安全週間に参加中")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /ランキング/ }))
    await user.click(screen.getByRole("button", { name: "イベントに参加する!" }))
    expect(screen.getByText("イベント参加中! 今日の安全チャレンジを続けよう")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /アバター/ }))
    await user.click(screen.getByRole("button", { name: "カラー" }))
    expect(screen.getByText("カラーを表示中")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "リセット" }))
    expect(screen.getByText("アバターを初期状態に戻しました")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "このアバターで けってい!" }))
    expect(screen.getByText("アバターを保存しました: ぼうし")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /ヒーロー図鑑/ }))
    await user.click(screen.getByRole("button", { name: "バッジ" }))
    expect(screen.getByText("バッジを表示中")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "すべて見る" }))
    expect(screen.getByText("すべてのバッジを表示中")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /マイルーム/ }))
    await user.click(screen.getByRole("button", { name: "ずかん" }))
    expect(screen.getByText("ずかんを開きました")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "ミッションを見る" }))
    expect(screen.getByText("今月のミッションを確認中")).toBeInTheDocument()
  })
})
