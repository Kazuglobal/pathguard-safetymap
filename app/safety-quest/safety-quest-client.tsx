"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Award,
  Bell,
  BookOpen,
  Camera,
  Check,
  Gift,
  Home,
  Map,
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
import { buildSafetyQuestAttemptMarkers } from "@/lib/safety-quest-hazard-points"
import { SAFETY_QUEST_HELP_EVENT, StatusPill } from "@/components/safety-quest/quest-primitives"
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
import { AdventureMapScreen } from "@/components/safety-quest/adventure-map-screen"
import { HazardChallengeScreen } from "@/components/safety-quest/hazard-challenge-screen"
import { QuizBattleScreen } from "@/components/safety-quest/quiz-battle-screen"
import { RewardsScreen } from "@/components/safety-quest/rewards-screen"
import { DailyScreen } from "@/components/safety-quest/daily-screen"
import type { Screen } from "@/components/safety-quest/screen-types"

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
