"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Award,
  Bell,
  BookOpen,
  Camera,
  Check,
  CircleHelp,
  Flag,
  Gift,
  Heart,
  Home,
  Lock,
  Map,
  Pause,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SAMPLE_SAFETY_QUEST_CHALLENGES, type SafetyQuestChallenge } from "@/lib/safety-quest"
import { HAZARD_TARGET_COUNT, getDailyMissions, type DailyProgress } from "@/lib/safety-quest-daily-missions"
import { buildSafetyQuestAttemptMarkers, getChallengeHazardPoints } from "@/lib/safety-quest-hazard-points"
import {
  BattleHp,
  GameHeader,
  ItemChip,
  ProgressBar,
  RewardStat,
  SAFETY_QUEST_HELP_EVENT,
  StatusPill,
} from "@/components/safety-quest/quest-primitives"
import { DangerCloud, Mascot, PlayerFace } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"
import { PatrolScreen } from "@/components/safety-quest/patrol-screen"
import { TeamMissionScreen } from "@/components/safety-quest/team-mission-screen"
import { MysteryScreen } from "@/components/safety-quest/mystery-screen"
import { CollectionScreen } from "@/components/safety-quest/collection-screen"
import { RankingScreen } from "@/components/safety-quest/ranking-screen"
import { AvatarScreen } from "@/components/safety-quest/avatar-screen"
import { DefendTownScreen } from "@/components/safety-quest/defend-town-screen"
import { ArPhotoScreen } from "@/components/safety-quest/ar-photo-screen"
import { HeroEncyclopediaScreen } from "@/components/safety-quest/hero-encyclopedia-screen"
import { RoomScreen } from "@/components/safety-quest/room-screen"

type Screen =
  | "map"
  | "challenge"
  | "patrol"
  | "team"
  | "rewards"
  | "daily"
  | "quiz"
  | "mystery"
  | "collection"
  | "ranking"
  | "avatar"
  | "defend"
  | "ar"
  | "encyclopedia"
  | "room"

type ModeItem = {
  screen?: Screen
  href?: string
  concept: "UI 01" | "UI 02" | "UI 03"
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const modeItems: ModeItem[] = [
  { screen: "map", concept: "UI 01", label: "ぼうけんマップ", icon: Map },
  { href: "/safety-quest/hunter", concept: "UI 03", label: "きけんハンター", icon: Camera },
  { screen: "challenge", concept: "UI 01", label: "危険さがし", icon: Target },
  { screen: "patrol", concept: "UI 01", label: "パトロール", icon: Shield },
  { screen: "team", concept: "UI 01", label: "協力ミッション", icon: Users },
  { screen: "rewards", concept: "UI 01", label: "クリア報酬", icon: Gift },
  { screen: "daily", concept: "UI 02", label: "デイリーたんけん", icon: Check },
  { screen: "quiz", concept: "UI 02", label: "クイズバトル", icon: Zap },
  { screen: "mystery", concept: "UI 02", label: "なぞとき", icon: Search },
  { screen: "collection", concept: "UI 02", label: "ガチャ・コレクション", icon: Award },
  { screen: "ranking", concept: "UI 02", label: "ランキング", icon: Trophy },
  { screen: "avatar", concept: "UI 03", label: "アバター", icon: User },
  { screen: "defend", concept: "UI 03", label: "まちをまもろう", icon: Shield },
  { screen: "ar", concept: "UI 03", label: "ARフォト", icon: Camera },
  { screen: "encyclopedia", concept: "UI 03", label: "ヒーロー図鑑", icon: BookOpen },
  { screen: "room", concept: "UI 03", label: "マイルーム", icon: Home },
]

const mapNodes = [
  { id: 1, x: 26, y: 69, stars: 3, label: "スタート", locked: false },
  { id: 2, x: 40, y: 47, stars: 3, label: "みまもり坂", locked: false },
  { id: 3, x: 61, y: 25, stars: 2, label: "交差点", locked: false },
  { id: 4, x: 71, y: 55, stars: 1, label: "公園前", locked: false },
  { id: 5, x: 86, y: 36, stars: 0, label: "商店街", locked: true },
]

export default function SafetyQuestClient() {
  const [screen, setScreen] = useState<Screen>("map")
  const [foundHazards, setFoundHazards] = useState<string[]>([])
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [points, setPoints] = useState(2840)
  const [coins, setCoins] = useState(1250)
  const [avatarColor, setAvatarColor] = useState("#22c55e")
  const [equippedHat, setEquippedHat] = useState("ぼうし")
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({ hazardFinds: 0, quizCorrect: 0, clearedStages: 0 })
  const [unlockedRewards, setUnlockedRewards] = useState<string[]>([])
  const [challenges, setChallenges] = useState<readonly SafetyQuestChallenge[]>(SAMPLE_SAFETY_QUEST_CHALLENGES)
  const [selectedChallenge, setSelectedChallenge] = useState<SafetyQuestChallenge>(SAMPLE_SAFETY_QUEST_CHALLENGES[0])
  const [notificationMessage, setNotificationMessage] = useState("")

  const foundCount = foundHazards.length
  const quizIsCorrect = quizAnswer === "danger"
  const dailyMissions = useMemo(() => getDailyMissions(dailyProgress), [dailyProgress])

  useEffect(() => {
    if (typeof fetch !== "function") return

    let cancelled = false

    fetch("/api/safety-quest/challenges", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !Array.isArray(body?.challenges) || body.challenges.length === 0) return

        setChallenges(body.challenges)
        setSelectedChallenge(body.challenges[0])
      })
      .catch(() => {
        // The sample challenge keeps the game playable when the API is unavailable.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const showHelp = () => setNotificationMessage("画面の青いボタンを押すと、次の安全アクションに進めます。")

    window.addEventListener(SAFETY_QUEST_HELP_EVENT, showHelp)
    return () => window.removeEventListener(SAFETY_QUEST_HELP_EVENT, showHelp)
  }, [])

  const handleHazardMark = (id: string) => {
    if (foundHazards.includes(id)) return
    setFoundHazards((current) => [...current, id])
    setPoints((current) => current + 50)
    setCoins((current) => current + 10)
    setDailyProgress((current) => ({
      ...current,
      hazardFinds: Math.min(HAZARD_TARGET_COUNT, current.hazardFinds + 1),
    }))
  }

  const openChallenge = (challenge = selectedChallenge) => {
    setSelectedChallenge(challenge)
    setFoundHazards([])
    setQuizAnswer(null)
    setScreen("challenge")
  }

  const navigateToScreen = (nextScreen: Screen) => {
    if (nextScreen === "challenge") {
      openChallenge()
      return
    }

    setScreen(nextScreen)
  }

  const returnToMap = () => {
    setQuizAnswer(null)
    setScreen("map")
  }

  const handleQuizAnswer = (answer: string) => {
    setQuizAnswer(answer)

    if (answer === "danger" && quizAnswer !== "danger") {
      setPoints((current) => current + 80)
      setCoins((current) => current + 20)
      setDailyProgress((current) => ({
        ...current,
        quizCorrect: Math.min(2, current.quizCorrect + 1),
      }))
    }
  }

  const submitSelectedChallengeAttempt = () => {
    if (typeof fetch !== "function") return

    const userMarkers = buildSafetyQuestAttemptMarkers(selectedChallenge, foundHazards)

    void fetch("/api/safety-quest/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: selectedChallenge.id,
        mode: "quiz-battle",
        userMarkers,
        answerPayload: { answer: "danger", correct: true },
        durationMs: 45_000,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const rewardKeys = body?.result?.rewardKeys
        if (!Array.isArray(rewardKeys) || rewardKeys.length === 0) return

        setUnlockedRewards((current) => Array.from(new Set([...current, ...rewardKeys])))
      })
      .catch(() => {
        // Local rewards keep the loop responsive when the API is unavailable.
      })
  }

  const openRewardsFromQuiz = () => {
    if (!quizIsCorrect) return

    submitSelectedChallengeAttempt()
    setPoints((current) => current + 250)
    setCoins((current) => current + 90)
    setDailyProgress((current) => ({
      ...current,
      clearedStages: Math.max(1, current.clearedStages),
    }))
    setUnlockedRewards((current) => (current.includes("lookout-master") ? current : [...current, "lookout-master"]))
    setScreen("rewards")
  }

  const resetCoreLoop = () => {
    setFoundHazards([])
    setQuizAnswer(null)
    setScreen("map")
  }

  const renderedScreen = useMemo(() => {
    switch (screen) {
      case "map":
        return (
          <AdventureMapScreen
            challenges={challenges}
            selectedChallenge={selectedChallenge}
            onStart={openChallenge}
            onJump={navigateToScreen}
          />
        )
      case "challenge":
        return (
          <HazardChallengeScreen
            challenge={selectedChallenge}
            foundHazards={foundHazards}
            onMark={handleHazardMark}
            onNext={() => setScreen("quiz")}
          />
        )
      case "patrol":
        return <PatrolScreen onBack={returnToMap} onReward={() => setScreen("rewards")} />
      case "team":
        return <TeamMissionScreen />
      case "rewards":
        return <RewardsScreen onMap={resetCoreLoop} onNext={() => setScreen("daily")} />
      case "daily":
        return <DailyScreen missions={dailyMissions} onMission={() => openChallenge(selectedChallenge)} />
      case "quiz":
        return (
          <QuizBattleScreen
            answer={quizAnswer}
            isCorrect={quizIsCorrect}
            onAnswer={handleQuizAnswer}
            onBack={returnToMap}
            onRetry={() => setQuizAnswer(null)}
            onReward={openRewardsFromQuiz}
          />
        )
      case "mystery":
        return <MysteryScreen onBack={returnToMap} />
      case "collection":
        return <CollectionScreen unlockedRewards={unlockedRewards} onBack={returnToMap} />
      case "ranking":
        return <RankingScreen onBack={returnToMap} />
      case "avatar":
        return (
          <AvatarScreen
            avatarColor={avatarColor}
            equippedHat={equippedHat}
            onColor={setAvatarColor}
            onHat={setEquippedHat}
            onBack={returnToMap}
          />
        )
      case "defend":
        return <DefendTownScreen onBack={returnToMap} />
      case "ar":
        return <ArPhotoScreen onBack={returnToMap} />
      case "encyclopedia":
        return <HeroEncyclopediaScreen onBack={returnToMap} />
      case "room":
        return <RoomScreen onBack={returnToMap} onExplore={() => setScreen("map")} />
    }
  }, [
    avatarColor,
    challenges,
    dailyMissions,
    equippedHat,
    foundHazards,
    points,
    quizAnswer,
    quizIsCorrect,
    screen,
    selectedChallenge,
    unlockedRewards,
  ])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7fbff] px-3 py-4 text-[#0b2551] sm:px-5 lg:px-8">
      <div className="pointer-events-none fixed left-0 top-0 h-32 w-32 rounded-br-[72px] bg-[#0e7cc8]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-32 w-40 rounded-tl-[96px] bg-[#14b8a6]" />
      <div className="pointer-events-none fixed right-8 top-6 grid grid-cols-6 gap-3 opacity-40">
        {Array.from({ length: 24 }).map((_, index) => (
          <span key={index} className="h-2 w-2 rounded-full bg-[#7da7c5]" />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1210px]">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-gradient-to-br from-[#0f62b8] via-[#11a5a5] to-[#ff9f1c] shadow-lg shadow-blue-900/15">
              <Shield className="h-7 w-7 fill-white/20 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1586a2]">PathGuardian</p>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">
                SafetyMap <span className="text-[#12a7a2]">Safety Quest</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm font-black">
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#f59e0b]" />} value={`${points.toLocaleString()} pt`} />
            <StatusPill icon={<Shield className="h-4 w-4 text-[#2563eb]" />} value="レベル 12" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="120" />
            <button
              type="button"
              onClick={() => setNotificationMessage("今日の安全通知: 夕方は見通しの悪い交差点に気をつけよう")}
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#cfe7fb] bg-white shadow-sm"
              aria-label="通知"
            >
              <Bell className="h-5 w-5 text-[#0b4e91]" />
            </button>
          </div>
        </header>

        {notificationMessage && (
          <div className="mb-3 rounded-[18px] border-2 border-[#bfe5ff] bg-white px-4 py-3 text-sm font-black text-[#0b4e91] shadow-sm" role="status">
            {notificationMessage}
          </div>
        )}

        <nav className="mb-4 overflow-hidden rounded-[22px] border border-[#c7ddf2] bg-white/90 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modeItems.map((item) => {
              const Icon = item.icon
              const active = item.screen != null && item.screen === screen
              const className = cn(
                "flex min-w-max items-center gap-2 rounded-[16px] border px-3 py-2 text-xs font-black transition",
                active
                  ? "border-[#1067c8] bg-[#1067c8] text-white shadow-md"
                  : "border-[#d8e8f7] bg-[#f8fbff] text-[#12355d] hover:bg-[#eaf5ff]",
              )
              const content = (
                <>
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] opacity-75">{item.concept}</span>
                  {item.label}
                </>
              )

              if (item.href) {
                return (
                  <Link key={item.href} href={item.href} className={className}>
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.screen}
                  type="button"
                  onClick={() => item.screen && navigateToScreen(item.screen)}
                  className={className}
                >
                  {content}
                </button>
              )
            })}
          </div>
        </nav>

        <section className="relative overflow-hidden rounded-[34px] border-[9px] border-[#111827] bg-[#111827] shadow-[0_28px_60px_rgba(10,33,64,0.28)]">
          <div className="relative h-[760px] overflow-hidden rounded-[23px] bg-white md:h-auto md:aspect-[16/9]">
            {renderedScreen}
          </div>
        </section>
      </div>
    </main>
  )
}

function AdventureMapScreen({
  challenges,
  selectedChallenge,
  onStart,
  onJump,
}: {
  challenges: readonly SafetyQuestChallenge[]
  selectedChallenge: SafetyQuestChallenge
  onStart: (challenge: SafetyQuestChallenge) => void
  onJump: (screen: Screen) => void
}) {
  return (
    <div className="h-full bg-gradient-to-b from-[#b9e8ff] via-[#e8f8ff] to-[#d7f4d8]">
      <GameHeader
        title="ぼうけんマップ"
        subtitle="まちの安全をまもる ぼうけんに出発しよう!"
        right={
          <>
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="128/150" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="1,250" />
          </>
        }
      />
      <div className="grid h-[calc(100%-70px)] gap-4 p-4 lg:grid-cols-[0.78fr_1.22fr] lg:p-5">
        <section className="relative overflow-hidden rounded-[26px] border-4 border-white/80 bg-white/78 p-4 shadow-xl">
          <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#9be7ff]/70" />
          <div className="relative z-10 flex items-start gap-4">
            <Mascot size="lg" pose="point" />
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-[#0b66c3] px-3 py-1 text-xs font-black text-white">レベル 12</span>
              <h3 className="mt-3 text-3xl font-black leading-tight text-[#0b2b62]">安全たんけんへ<br />出発!</h3>
              <button
                type="button"
                onClick={() => onStart(selectedChallenge)}
                className="mt-3 whitespace-nowrap rounded-full bg-[#ff8b18] px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/15 transition hover:scale-[1.02]"
              >
                出発する
              </button>
              <p className="mt-3 rounded-[18px] border-2 border-[#cbe5f8] bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#31516f] shadow-sm">
                今日のミッションをクリアして、次のステージをひらこう。
              </p>
              <div className="mt-3 rounded-[18px] border-2 border-[#9bd8d3] bg-[#f0fffd] px-4 py-3 shadow-sm">
                <p className="text-[11px] font-black text-[#087c78]">今日の投稿チャレンジ</p>
                <p className="mt-1 text-sm font-black leading-tight text-[#0b2b62]">{selectedChallenge.title}</p>
                <p className="mt-1 text-xs font-bold text-[#52708f]">{selectedChallenge.areaLabel}</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border-2 border-[#c8e5fb] bg-white p-3 shadow-sm">
              <p className="text-xs font-black text-[#41718f]">エリア1</p>
              <p className="text-sm font-black text-[#0b2b62]">学校のまわり</p>
              <div className="mt-2 flex items-center gap-2 text-xs font-black">
                <Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />12/15
              </div>
            </div>
            <div className="rounded-[18px] border-2 border-[#ffd49a] bg-[#fff6df] p-3 shadow-sm">
              <p className="text-xs font-black text-[#995b00]">今日のミッション</p>
              <p className="mt-2 text-2xl font-black text-[#0f8f73]">3/3</p>
            </div>
          </div>
        </section>

        <section className="relative min-h-[430px] overflow-hidden rounded-[26px] border-4 border-white/90 bg-[#bdecb6] shadow-xl">
          <MapIllustration />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M26 69 C34 62 35 53 40 47 C48 36 55 33 61 25 C66 34 65 46 71 55 C76 47 80 40 86 36"
              fill="none"
              stroke="#1677c6"
              strokeDasharray="3 2"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
          {mapNodes.map((node) => {
            const challenge = challenges[(node.id - 1) % challenges.length] ?? selectedChallenge

            return (
              <StageNode
                key={node.id}
                node={node}
                onClick={node.locked ? undefined : () => onStart(challenge)}
              />
            )
          })}
          <button
            type="button"
            onClick={() => onJump("defend")}
            className="absolute right-4 top-4 grid h-16 w-16 place-items-center rounded-[20px] border-4 border-white bg-[#ffb020] text-[#8a4a00] shadow-lg"
            aria-label="たからばこ"
          >
            <Gift className="h-8 w-8" />
          </button>
        </section>
      </div>
    </div>
  )
}

function MapIllustration() {
  const houses = [
    ["12%", "18%", "#f9b44d"],
    ["28%", "30%", "#72c6ef"],
    ["70%", "20%", "#ff8c66"],
    ["82%", "63%", "#facc15"],
    ["18%", "74%", "#f7a3b5"],
  ]
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.75),transparent_16%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,.75),transparent_12%),linear-gradient(135deg,#c8f2b8,#eaf8b4_45%,#a9e5c9)]" />
      <div className="absolute -left-12 top-[54%] h-16 w-[120%] rotate-[-18deg] rounded-full bg-[#f4e7a5]" />
      <div className="absolute left-[48%] top-[-8%] h-[120%] w-20 rotate-[22deg] rounded-full bg-[#f4e7a5]" />
      <div className="absolute left-[4%] top-[42%] h-14 w-[92%] rotate-[9deg] rounded-full bg-[#89d0f0]/80" />
      {houses.map(([left, top, color], index) => (
        <div key={`${left}-${top}`} className="absolute h-14 w-16" style={{ left, top }}>
          <div className="absolute bottom-0 h-10 w-16 rounded-[6px] border-2 border-white shadow" style={{ background: color }} />
          <div className="absolute left-1 top-0 h-9 w-14 rotate-45 rounded-[4px] border-l-2 border-t-2 border-white bg-[#cf6f3d]" />
          <span className="absolute bottom-3 left-3 h-3 w-3 rounded-sm bg-white/80" />
          <span className="absolute bottom-3 right-3 h-3 w-3 rounded-sm bg-white/80" />
          {index === 2 && <Flag className="absolute -right-1 -top-3 h-5 w-5 fill-[#ef4444] text-[#ef4444]" />}
        </div>
      ))}
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-5 w-4 rounded-full bg-[#54b96d] shadow-sm"
          style={{
            left: `${8 + ((index * 17) % 84)}%`,
            top: `${12 + ((index * 23) % 76)}%`,
            transform: `scale(${0.75 + (index % 4) * 0.08})`,
          }}
        />
      ))}
    </div>
  )
}

function StageNode({
  node,
  onClick,
}: {
  node: { id: number; x: number; y: number; stars: number; label: string; locked: boolean }
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={node.locked}
      className={cn(
        "absolute grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-white text-xl font-black text-white shadow-xl transition",
        node.locked ? "bg-[#9aa8b5]" : "bg-gradient-to-b from-[#23c58b] to-[#0c91b7] hover:scale-105",
      )}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      aria-label={node.label}
    >
      {node.locked ? <Lock className="h-8 w-8" /> : node.id}
      <span className="absolute -bottom-5 flex gap-0.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Star key={index} className={cn("h-4 w-4", index < node.stars ? "fill-[#facc15] text-[#eab308]" : "fill-white text-white")} />
        ))}
      </span>
      {node.id === 1 && (
        <span className="absolute -bottom-11 rounded-full bg-[#1bb46f] px-3 py-1 text-xs font-black text-white shadow">スタート</span>
      )}
    </button>
  )
}

function HazardChallengeScreen({
  challenge,
  foundHazards,
  onMark,
  onNext,
}: {
  challenge: SafetyQuestChallenge
  foundHazards: string[]
  onMark: (id: string) => void
  onNext: () => void
}) {
  const hazardPoints = getChallengeHazardPoints(challenge)
  const complete = foundHazards.length >= Math.max(1, hazardPoints.length)

  return (
    <div className="flex h-full flex-col bg-[#eaf7ff]">
      <div className="flex h-14 items-center gap-3 bg-gradient-to-b from-[#0c75d4] to-[#0757aa] px-4 text-white">
        <StatusPill className="h-9 border-white/30 bg-white/16 text-white" icon={<CircleHelp className="h-4 w-4" />} value="00:45" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded-full bg-[#10b981] px-3 py-1 text-xs font-black">コンボ</span>
          <span className="text-4xl font-black text-[#ffcf35] drop-shadow">3</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-[#0b3a74]">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#10b981] to-[#ffd23f]" />
          </div>
        </div>
        <span className="text-lg font-black">スコア 350 pt</span>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/20" aria-label="一時停止">
          <Pause className="h-5 w-5 fill-white" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-[#a7d7ff]">
        <StreetPhotoScene imageUrl={challenge.imageUrl} />
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-[18px] border-2 border-[#d7e5f2] bg-white/95 px-6 py-2 text-center text-lg font-black shadow">
          危険なところをタップしよう!
        </div>
        <div className="absolute left-5 top-4 max-w-[310px] rounded-[18px] border-2 border-[#9bd8d3] bg-white/95 px-4 py-3 shadow-lg">
          <p className="text-xs font-black text-[#087c78]">投稿チャレンジ</p>
          <h3 className="mt-1 text-base font-black leading-tight text-[#0b2b62]">{challenge.title}</h3>
          <p className="mt-1 text-xs font-bold text-[#52708f]">{challenge.areaLabel}</p>
        </div>

        {hazardPoints.map((point) => (
          <HazardMarker
            key={point.id}
            id={point.id}
            x={point.x}
            y={point.y}
            found={foundHazards.includes(point.id)}
            onMark={onMark}
          />
        ))}

        {complete && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-5 top-24 rounded-full bg-[#ff8b18] px-6 py-3 text-base font-black text-white shadow-xl shadow-orange-900/20 transition hover:scale-[1.02]"
          >
            クイズへ
          </button>
        )}

        {foundHazards.length > 0 && (
          <div className="absolute bottom-24 right-[18%] rotate-[-8deg] text-center">
            <p className="text-5xl font-black text-[#ff6b22] drop-shadow-[0_4px_0_white]">GOOD!</p>
            <p className="text-3xl font-black text-[#ff6b22] drop-shadow-[0_3px_0_white]">+50pt</p>
            <Sparkles className="absolute -left-8 top-1 h-8 w-8 fill-[#facc15] text-[#eab308]" />
            <Sparkles className="absolute -right-7 bottom-2 h-7 w-7 fill-[#facc15] text-[#eab308]" />
          </div>
        )}

        <div className="absolute bottom-5 left-5 flex items-end gap-3">
          <Mascot pose="point" />
          <div className="rounded-[18px] border-2 border-[#cde5f9] bg-white px-4 py-3 text-sm font-bold text-[#0b2551] shadow-lg">
            よく見つけたね!<br />
            そのちょうし!
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t-4 border-[#063b75] bg-[#064d91] p-4 text-white md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-3 gap-3">
          {hazardPoints.map((point) => (
            <div key={point.id} className="rounded-[16px] border-2 border-white/35 bg-white/12 px-3 py-2 text-center text-sm font-black">
              <span className="text-[#ffd23f]">{foundHazards.includes(point.id) ? "発見!" : "未発見"}</span>
              <br />
              {point.label}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!complete}
          className={cn(
            "rounded-[18px] px-8 py-3 text-lg font-black shadow-lg",
            complete ? "bg-[#ff8b18] text-white hover:scale-[1.02]" : "bg-white/20 text-white/60",
          )}
        >
          クイズへすすむ
        </button>
      </div>
    </div>
  )
}

function HazardMarker({
  id,
  x,
  y,
  found,
  onMark,
}: {
  id: string
  x: number
  y: number
  found: boolean
  onMark: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onMark(id)}
      className={cn(
        "absolute grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] shadow-[0_0_0_5px_rgba(239,68,68,.18)] transition hover:scale-110",
        found ? "border-[#22c55e] bg-[#dcfce7]/75" : "border-[#ef4444] bg-transparent",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label="危険ポイント"
    >
      {found ? <Check className="h-8 w-8 rounded-full bg-[#22c55e] p-1 text-white" /> : <span className="h-5 w-5 rounded-full border-2 border-white bg-[#ef4444]" />}
    </button>
  )
}

function RewardsScreen({ onMap, onNext }: { onMap: () => void; onNext: () => void }) {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-b from-[#0895db] via-[#50c7ff] to-[#d9f7ff] p-5 text-[#0b2551]">
      {Array.from({ length: 44 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-3 w-2 rotate-12 rounded-sm"
          style={{
            left: `${(index * 23) % 100}%`,
            top: `${(index * 17) % 82}%`,
            background: ["#f97316", "#22c55e", "#facc15", "#ef4444", "#3b82f6"][index % 5],
          }}
        />
      ))}
      <div className="relative z-10 mx-auto flex h-full max-w-[970px] flex-col">
        <div className="mx-auto mb-3 rounded-[18px] bg-gradient-to-b from-[#ff9f1c] to-[#f06414] px-12 py-3 text-4xl font-black text-white shadow-xl">
          ミッション クリア!
        </div>
        <div className="grid flex-1 gap-4 lg:grid-cols-[0.55fr_1.45fr_.7fr]">
          <div className="flex flex-col items-center justify-center">
            <Mascot size="lg" pose="jump" />
            <div className="mt-3 rounded-[18px] border-2 border-[#cde5f9] bg-white p-3 text-center text-sm font-black shadow-lg">
              やったね!<br />安全ヒーローとして<br />大せいこう!
            </div>
          </div>
          <div className="rounded-[28px] border-4 border-white/80 bg-white/88 p-5 shadow-2xl">
            <p className="text-center text-sm font-black text-[#0d66c4]">ステージ 2-3「見通しの悪い交差点」</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <RewardStat label="獲得ポイント" value="+380 pt" icon={<Star className="h-9 w-9 fill-[#facc15] text-[#eab308]" />} />
              <RewardStat label="コイン" value="+120" icon={<Sparkles className="h-9 w-9 text-[#f59e0b]" />} />
            </div>
            <h3 className="mt-5 text-center text-sm font-black text-[#52708f]">ゲットしたアイテム</h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                ["安全バッジ", "見通し名人", Shield],
                ["アイテム", "見守りホイッスル", Zap],
                ["スキン", "まもるんキャップ", User],
              ].map(([kind, name, Icon]) => (
                <div key={name as string} className="rounded-[18px] border-2 border-[#d8e8f7] bg-[#f8fbff] p-3 text-center shadow-sm">
                  <p className="text-[11px] font-black text-[#52708f]">{kind as string}</p>
                  <div className="mx-auto my-2 grid h-16 w-16 place-items-center rounded-[16px] bg-[#e0f2fe]">
                    <Icon className="h-9 w-9 text-[#0d66c4]" />
                  </div>
                  <p className="text-xs font-black">{name as string}</p>
                  <p className="mt-1 text-xs font-black text-[#eab308]">★ x1</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-[24px] bg-[#fff4cc] p-4 text-center shadow-xl">
            <p className="text-sm font-black">つぎにすすめるルートが<br />ふえたよ!</p>
            <div className="relative mx-auto my-4 h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#a3d5ff] shadow">
              <StreetPhotoScene />
              <Lock className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b2551]/80 p-2 text-white" />
            </div>
            <div className="rounded-[18px] bg-[#f97316] px-3 py-2 text-lg font-black text-white">商店街ルートが解放!</div>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-4">
          <button type="button" onClick={onMap} className="rounded-full bg-[#0d66c4] px-8 py-3 text-lg font-black text-white shadow-lg">
            マップにもどる
          </button>
          <button type="button" onClick={onNext} className="rounded-full bg-[#ff8b18] px-10 py-3 text-xl font-black text-white shadow-lg">
            つぎのステージへ!
          </button>
        </div>
      </div>
    </div>
  )
}

function DailyScreen({ missions, onMission }: { missions: ReturnType<typeof getDailyMissions>; onMission: () => void }) {
  return (
    <div className="h-full bg-gradient-to-b from-[#9ddcff] via-[#eaffff] to-[#fff1cf] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlayerFace />
          <span className="text-sm font-black">そうた</span>
          <StatusPill icon={<Shield className="h-4 w-4 text-[#0d66c4]" />} value="レベル 12" />
        </div>
        <div className="flex gap-2">
          <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="2,840 pt" />
          <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="120" />
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#cde5f9] bg-white">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden rounded-[30px] border-4 border-white bg-white/80 p-5 shadow-xl">
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-tl-full bg-[#b4ebaa]" />
          <div className="relative z-10 flex gap-4">
            <Mascot size="lg" pose="point" />
            <div className="rounded-[26px] border-2 border-[#cde5f9] bg-white p-4 shadow">
              <p className="font-black leading-relaxed">おはよう!<br />今日もいっしょに<br />安全たんけんに出発しよう!</p>
            </div>
          </div>
          <div className="relative z-10 mt-6 rounded-[24px] bg-[#0d66c4] p-4 text-white shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-black">デイリーたんけん</h3>
              <span className="rounded-full bg-[#ff8b18] px-3 py-1 text-xs font-black">7日れんぞく中!</span>
            </div>
            <div className="flex items-center justify-between rounded-[18px] bg-white p-3 text-[#0b2551]">
              {[14, 11, 12, 13, 10, 11, 12, 13, 16].map((day, index) => (
                <div key={`${day}-${index}`} className="text-center text-xs font-black">
                  <div className={cn("mb-1 grid h-8 w-8 place-items-center rounded-full", index < 4 ? "bg-[#10b981] text-white" : index === 8 ? "bg-[#ff8b18] text-white" : "bg-[#fff1cc] text-[#0b2551]")}>
                    {index < 4 ? <Check className="h-5 w-5" /> : day}
                  </div>
                  {index === 8 ? "今日" : day}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex flex-col rounded-[30px] border-4 border-white bg-[#0d66c4] p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between text-white">
            <h3 className="text-xl font-black">今日のミッション</h3>
            <span className="font-mono text-sm font-black">のこり 14:30:25</span>
          </div>
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            {missions.map((mission) => {
              const Icon = mission.icon
              return (
                <button
                  key={mission.title}
                  type="button"
                  onClick={onMission}
                  className="rounded-[20px] border-2 border-[#d8e8f7] bg-white p-4 text-left shadow-sm transition hover:scale-[1.02]"
                >
                  <p className="min-h-[44px] text-sm font-black leading-snug">{mission.title}</p>
                  <div className="my-3 grid h-16 w-full place-items-center rounded-[18px] bg-[#eaf5ff]">
                    <Icon className={cn("h-9 w-9", mission.tint === "green" ? "text-[#22c55e]" : mission.tint === "orange" ? "text-[#f97316]" : "text-[#0d66c4]")} />
                  </div>
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>{mission.progress}</span>
                    <span className="text-[#f97316]">{mission.reward}</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="mt-4 rounded-[18px] bg-[#0a4d99] p-4 text-center text-2xl font-black text-[#ffd23f] shadow-inner">
            ぜんぶクリアでボーナス! +150pt
          </div>
        </section>
      </div>
    </div>
  )
}

function QuizBattleScreen({
  answer,
  isCorrect,
  onAnswer,
  onBack,
  onRetry,
  onReward,
}: {
  answer: string | null
  isCorrect: boolean
  onAnswer: (answer: string) => void
  onBack: () => void
  onRetry: () => void
  onReward: () => void
}) {
  const answers = [
    ["danger", "とてもあぶない!"],
    ["watch", "気をつければOK"],
    ["rush", "すぐにわたる!"],
  ]

  return (
    <div className="flex h-full flex-col bg-[#e8f5ff]">
      <GameHeader
        title="ルートクイズバトル"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Sparkles className="h-4 w-4 text-[#f59e0b]" />} value="350 pt" />}
      />
      <div className="relative flex-1 overflow-hidden">
        <StreetPhotoScene />
        <div className="absolute left-5 right-5 top-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <BattleHp name="そうた" hp="80/100" value={80} />
          <span className="rounded-full border-4 border-white bg-[#ff8b18] px-3 py-2 text-2xl font-black text-white shadow-lg">VS</span>
          <BattleHp name="あぶないゾーン" hp="60/100" value={60} align="right" />
        </div>
        <div className="absolute left-1/2 top-[23%] h-48 w-56 -translate-x-1/2">
          <DangerCloud />
        </div>
        <div className="absolute left-[21%] top-[27%] rotate-[-16deg] rounded-[16px] border-4 border-[#e35d00] bg-[#ffb43b] p-3 shadow-lg">
          <span className="text-3xl font-black text-[#7c2d12]">注意</span>
        </div>
        <div className="absolute right-[21%] top-[32%] rotate-[12deg] rounded-[14px] border-4 border-[#facc15] bg-[#1f2937] p-3 shadow-lg">
          <Target className="h-10 w-10 text-[#facc15]" />
        </div>
      </div>
      <div className="bg-[#ffbd45] p-4">
        <div className="mx-auto max-w-[920px] rounded-[22px] border-4 border-white bg-white p-4 shadow-xl">
          <p className="mb-3 rounded-full bg-[#0d66c4] px-3 py-1 text-xs font-black text-white">問題</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-black">車のかげからとび出すのは、どうかな?</p>
            {answer && (
              <button type="button" onClick={isCorrect ? onReward : onRetry} className="rounded-full bg-[#ff8b18] px-6 py-2 text-sm font-black text-white shadow">
                {isCorrect ? "報酬へ" : "もう一度"}
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {answers.map(([value, label], index) => {
              const selected = answer === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onAnswer(value)}
                  className={cn(
                    "rounded-full border-4 px-5 py-3 text-lg font-black text-white shadow transition hover:scale-[1.01]",
                    index === 0 && "border-[#93e7a6] bg-[#2fbf62]",
                    index === 1 && "border-[#9bd7ff] bg-[#1785d7]",
                    index === 2 && "border-[#ffc293] bg-[#f97316]",
                    selected && "ring-4 ring-white ring-offset-2 ring-offset-[#ffbd45]",
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <ItemChip icon={<Zap className="h-7 w-7 text-[#0ea5e9]" />} label="ひらめきヒント" value="残り2回" />
            <ItemChip icon={<Shield className="h-7 w-7 text-[#0d66c4]" />} label="まもりシールド" value="ダメージ-20!" />
            <ItemChip icon={<Heart className="h-7 w-7 fill-[#ef4444] text-[#ef4444]" />} label="かいふくハート" value="HPを20回復!" />
            {answer && (
              <button type="button" onClick={isCorrect ? onReward : onRetry} className="rounded-[16px] bg-[#ff8b18] px-6 py-3 font-black text-white shadow">
                {isCorrect ? "報酬へ" : "もう一度"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
