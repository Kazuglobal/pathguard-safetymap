"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Crown,
  Flag,
  Gift,
  Heart,
  Home,
  Image as ImageIcon,
  Lock,
  Map,
  Palette,
  Pause,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Upload,
  User,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SAMPLE_SAFETY_QUEST_CHALLENGES, type SafetyQuestChallenge } from "@/lib/safety-quest"

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
  screen: Screen
  concept: "UI 01" | "UI 02" | "UI 03"
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const modeItems: ModeItem[] = [
  { screen: "map", concept: "UI 01", label: "ぼうけんマップ", icon: Map },
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

const HAZARD_TARGET_COUNT = 3

type DailyProgress = {
  hazardFinds: number
  quizCorrect: number
  clearedStages: number
}

function getDailyMissions(progress: DailyProgress) {
  const hazardFinds = Math.min(progress.hazardFinds, HAZARD_TARGET_COUNT)
  const quizCorrect = Math.min(progress.quizCorrect, 2)

  return [
    {
      title: "あぶない場所を3つ見つけよう",
      progress: hazardFinds >= HAZARD_TARGET_COUNT ? "クリア!" : `${hazardFinds}/${HAZARD_TARGET_COUNT}`,
      reward: "+100pt",
      icon: Target,
      tint: "blue",
    },
    {
      title: "横断歩道をわたろう",
      progress: progress.clearedStages > 0 ? "クリア!" : "0/1",
      reward: "+80pt",
      icon: Shield,
      tint: "green",
    },
    {
      title: "クイズに2問こたえよう",
      progress: quizCorrect >= 2 ? "クリア!" : `${quizCorrect}/2`,
      reward: "+120pt",
      icon: CircleHelp,
      tint: "orange",
    },
  ]
}

const teamMembers = [
  ["そうた", "1,250 pt"],
  ["ゆい", "1,120 pt"],
  ["たくみ", "950 pt"],
  ["あおい", "780 pt"],
  ["はると", "750 pt"],
]

const collectionItems = [
  { key: "school-guard", name: "スクールガード", rarity: "★★★", color: "#f7c948", locked: false },
  { key: "route-guide", name: "みちしるべくん", rarity: "★★", color: "#7bd88f", locked: false },
  { key: "signal-ranger", name: "シグナルレンジャー", rarity: "★★★", color: "#2f80ed", locked: false },
  { key: "lookout-master", name: "見通し名人", rarity: "★★★", color: "#14b8a6", locked: true },
  { key: "secret", name: "ひみつ", rarity: "", color: "#dbeafe", locked: true },
]

const heroCards = [
  { name: "ライトガード", accent: "#2f80ed", stars: 2, locked: false },
  { name: "サインレンジャー", accent: "#f59e0b", stars: 3, locked: false },
  { name: "ミチミチ", accent: "#22c55e", stars: 1, locked: false },
  { name: "マモルン", accent: "#94a3b8", stars: 0, locked: true },
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
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#cfe7fb] bg-white shadow-sm"
              aria-label="通知"
            >
              <Bell className="h-5 w-5 text-[#0b4e91]" />
            </button>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[34px] border-[9px] border-[#111827] bg-[#111827] shadow-[0_28px_60px_rgba(10,33,64,0.28)]">
          <div className="relative h-[900px] overflow-hidden rounded-[23px] bg-white sm:h-[760px] md:h-auto md:aspect-[16/9]">
            {renderedScreen}
          </div>
        </section>

        <nav className="mt-4 overflow-hidden rounded-[22px] border border-[#c7ddf2] bg-white/90 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modeItems.map((item) => {
              const Icon = item.icon
              const active = item.screen === screen
              return (
                <button
                  key={item.screen}
                  type="button"
                  onClick={() => navigateToScreen(item.screen)}
                  className={cn(
                    "flex min-w-max items-center gap-2 rounded-[16px] border px-3 py-2 text-xs font-black transition",
                    active
                      ? "border-[#1067c8] bg-[#1067c8] text-white shadow-md"
                      : "border-[#d8e8f7] bg-[#f8fbff] text-[#12355d] hover:bg-[#eaf5ff]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] opacity-75">{item.concept}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </main>
  )
}

function GameHeader({
  title,
  subtitle,
  compact = false,
  onBack,
  right,
}: {
  title: string
  subtitle?: string
  compact?: boolean
  onBack?: () => void
  right?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/60 bg-gradient-to-b from-white/95 to-white/72 px-4 backdrop-blur",
        compact ? "h-14" : "h-[70px]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#c9e5fb] bg-white text-[#0d4f92] shadow-sm"
          aria-label="戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black leading-tight text-[#0b2551] sm:text-xl">{title}</h2>
          {subtitle && <p className="truncate text-xs font-bold text-[#52708f]">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#c9e5fb] bg-white text-[#0d4f92] shadow-sm"
          aria-label="ヘルプ"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function StatusPill({ icon, value, className }: { icon: React.ReactNode; value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#d5e9fb] bg-white px-3 text-[#102a55] shadow-sm",
        className,
      )}
    >
      {icon}
      {value}
    </span>
  )
}

function ProgressBar({ value, color = "#17b26a" }: { value: number; color?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#d7e9f7] shadow-inner">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

function PlayerFace({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-[#ffe2bd] shadow-md",
        size === "sm" && "h-9 w-9",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-16 w-16",
        className,
      )}
    >
      <div className="absolute left-1/2 top-0 h-[34%] w-[84%] -translate-x-1/2 rounded-b-full bg-[#243142]" />
      <span className="absolute left-[29%] top-[45%] h-1.5 w-1.5 rounded-full bg-[#1f2937]" />
      <span className="absolute right-[29%] top-[45%] h-1.5 w-1.5 rounded-full bg-[#1f2937]" />
      <span className="absolute left-1/2 top-[62%] h-1.5 w-4 -translate-x-1/2 rounded-b-full border-b-2 border-[#ef6f6c]" />
    </div>
  )
}

function Mascot({ size = "md", className, pose = "happy" }: { size?: "sm" | "md" | "lg"; className?: string; pose?: "happy" | "point" | "jump" }) {
  return (
    <div
      className={cn(
        "relative shrink-0",
        size === "sm" && "h-20 w-16",
        size === "md" && "h-28 w-24",
        size === "lg" && "h-40 w-32",
        className,
      )}
    >
      <div className="absolute bottom-[8%] left-[5%] h-[36%] w-[24%] rotate-[-18deg] rounded-full bg-[#174b87]" />
      <div className="absolute bottom-[8%] right-[5%] h-[36%] w-[24%] rotate-[18deg] rounded-full bg-[#174b87]" />
      <div
        className="absolute left-1/2 top-[8%] h-[78%] w-[76%] -translate-x-1/2 border-[4px] border-[#0f4d8c] bg-gradient-to-b from-[#5ed1ff] to-[#1f73c9] shadow-lg"
        style={{ clipPath: "polygon(50% 0%, 91% 15%, 80% 77%, 50% 100%, 20% 77%, 9% 15%)" }}
      />
      <div className="absolute left-1/2 top-[25%] h-[34%] w-[50%] -translate-x-1/2 rounded-full border-2 border-[#0f4d8c] bg-[#fff3dd]">
        <span className="absolute left-[27%] top-[40%] h-1.5 w-1.5 rounded-full bg-[#111827]" />
        <span className="absolute right-[27%] top-[40%] h-1.5 w-1.5 rounded-full bg-[#111827]" />
        <span className="absolute left-1/2 top-[62%] h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#ef6f6c]" />
      </div>
      <div
        className={cn(
          "absolute top-[39%] h-[9%] w-[32%] rounded-full bg-[#fff7d6] shadow",
          pose === "point" ? "right-[-8%] -rotate-12" : "left-[-8%] rotate-12",
        )}
      />
      <div
        className={cn(
          "absolute top-[39%] h-[9%] w-[32%] rounded-full bg-[#fff7d6] shadow",
          pose === "point" ? "left-[4%] rotate-[35deg]" : "right-[-8%] -rotate-12",
        )}
      />
      {pose === "jump" && <div className="absolute bottom-0 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-black/10 blur-sm" />}
    </div>
  )
}

function KidAvatar({ color = "#22c55e", hat = "ぼうし", className }: { color?: string; hat?: string; className?: string }) {
  const hatColor = hat === "ヘルメット" ? "#facc15" : hat === "キャップ" ? "#3b82f6" : hat === "ねこ耳" ? "#f5b7c8" : color
  return (
    <div className={cn("relative h-64 w-40", className)}>
      <div className="absolute left-1/2 top-12 h-24 w-24 -translate-x-1/2 rounded-full border-4 border-[#9a6a43] bg-[#ffe0bd] shadow-md">
        <div className="absolute left-1/2 top-0 h-8 w-20 -translate-x-1/2 rounded-b-full bg-[#523525]" />
        <span className="absolute left-[28%] top-[47%] h-2 w-2 rounded-full bg-[#111827]" />
        <span className="absolute right-[28%] top-[47%] h-2 w-2 rounded-full bg-[#111827]" />
        <span className="absolute left-1/2 top-[68%] h-2 w-8 -translate-x-1/2 rounded-b-full border-b-[3px] border-[#ef6f6c]" />
      </div>
      <div className="absolute left-1/2 top-7 h-12 w-28 -translate-x-1/2 rounded-t-[48px] rounded-b-[18px] border-4 border-[#31583b] shadow" style={{ background: hatColor }} />
      {hat === "ねこ耳" && (
        <>
          <span className="absolute left-8 top-3 h-8 w-7 rotate-[-20deg] rounded-t-full bg-[#f5b7c8]" />
          <span className="absolute right-8 top-3 h-8 w-7 rotate-[20deg] rounded-t-full bg-[#f5b7c8]" />
        </>
      )}
      <div className="absolute left-1/2 top-[132px] h-20 w-28 -translate-x-1/2 rounded-[24px] border-4 border-[#31583b]" style={{ background: color }} />
      <div className="absolute left-5 top-[140px] h-16 w-8 rotate-[18deg] rounded-full border-4 border-[#31583b] bg-[#ffe0bd]" />
      <div className="absolute right-5 top-[140px] h-16 w-8 rotate-[-18deg] rounded-full border-4 border-[#31583b] bg-[#ffe0bd]" />
      <div className="absolute bottom-0 left-10 h-16 w-8 rounded-full bg-[#2563eb]" />
      <div className="absolute bottom-0 right-10 h-16 w-8 rounded-full bg-[#2563eb]" />
      <div className="absolute bottom-[-4px] left-7 h-5 w-12 rounded-full bg-[#27563b]" />
      <div className="absolute bottom-[-4px] right-7 h-5 w-12 rounded-full bg-[#27563b]" />
    </div>
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

function getChallengeHazardPoints(challenge: SafetyQuestChallenge) {
  const points = challenge.aiDetections.flatMap((detection, detectionIndex) =>
    detection.positions.map((position, positionIndex) => ({
      id: `${challenge.id}-${detectionIndex}-${positionIndex}`,
      label: detection.label,
      description: detection.description,
      x: Math.min(92, Math.max(8, (position.x + position.width / 2) * 100)),
      y: Math.min(88, Math.max(12, (position.y + position.height / 2) * 100)),
    })),
  )

  if (points.length > 0) return points

  return [
    { id: `${challenge.id}-fallback-1`, label: "見通し", description: "見通しに注意しましょう。", x: 41, y: 31 },
    { id: `${challenge.id}-fallback-2`, label: "飛び出し", description: "飛び出しに注意しましょう。", x: 70, y: 41 },
    { id: `${challenge.id}-fallback-3`, label: "車のかげ", description: "車のかげに注意しましょう。", x: 55, y: 58 },
  ]
}

function buildSafetyQuestAttemptMarkers(challenge: SafetyQuestChallenge, foundHazards: readonly string[]) {
  return getChallengeHazardPoints(challenge)
    .filter((point) => foundHazards.includes(point.id))
    .map((point, index) => ({
      id: point.id,
      x: Math.max(0, Math.min(0.95, point.x / 100 - 0.06)),
      y: Math.max(0, Math.min(0.95, point.y / 100 - 0.06)),
      width: 0.12,
      height: 0.12,
      label: point.label,
      category: "hazard",
      timestamp: index + 1,
    }))
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

function StreetPhotoScene({ ar = false, imageUrl }: { ar?: boolean; imageUrl?: string }) {
  const displayImage = imageUrl && !imageUrl.startsWith("/placeholder")

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#89d0ff] via-[#cceeff] to-[#8dc68d]">
      {displayImage && <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
      {!displayImage && (
        <>
      <div className="absolute left-10 top-8 h-16 w-28 rounded-full bg-white/80 blur-sm" />
      <div className="absolute right-20 top-12 h-12 w-24 rounded-full bg-white/80 blur-sm" />
      <div className="absolute bottom-[43%] left-0 h-28 w-full bg-[#7fc77d]" />
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="absolute bottom-[43%] h-28 w-20 rounded-t-[28px] border-2 border-white/40 shadow"
          style={{
            left: `${index * 14 - 4}%`,
            background: index % 2 ? "#d5eefc" : "#f7d9a1",
          }}
        >
          <div className="mx-auto mt-5 grid w-12 grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, child) => (
              <span key={child} className="h-4 rounded-sm bg-white/70" />
            ))}
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-1/2 h-[58%] w-[96%] -translate-x-1/2 bg-[#53585f]" style={{ clipPath: "polygon(36% 0,64% 0,100% 100%,0 100%)" }} />
      <div className="absolute bottom-0 left-1/2 h-[58%] w-[14%] -translate-x-1/2 bg-[#f8fafc]/70" style={{ clipPath: "polygon(42% 0,58% 0,78% 100%,22% 100%)" }} />
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-white"
          style={{ bottom: `${10 + index * 9}%`, width: `${80 - index * 6}px` }}
        />
      ))}
      <div className="absolute left-[23%] top-[30%] h-[38%] w-3 rounded-full bg-[#5b4636]" />
      <div className="absolute left-[21%] top-[27%] h-16 w-16 rounded-full border-4 border-[#ff742f] bg-white/70" />
      <div className="absolute right-[24%] top-[35%] h-[34%] w-3 rounded-full bg-[#4b5563]" />
      <div className="absolute right-[20%] top-[28%] h-14 w-14 rotate-45 rounded-sm border-4 border-[#ffce2e] bg-[#1f2937]" />
        </>
      )}
      {ar && <div className="absolute inset-5 rounded-[28px] border-2 border-white/60 shadow-[inset_0_0_0_9999px_rgba(4,20,40,.08)]" />}
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Could not read the selected file."))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected file."))
    reader.readAsDataURL(file)
  })
}

function PatrolScreen({ onBack, onReward }: { onBack: () => void; onReward: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#d8f6ff]">
      <GameHeader
        title="まもるんとパトロール"
        subtitle="公園通りルート"
        onBack={onBack}
        right={<StatusPill icon={<Sparkles className="h-4 w-4 text-[#f59e0b]" />} value="ステージ 2/5" />}
      />
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#6ec7ff] via-[#b9ecff] to-[#1b6ea8]">
        <div className="absolute left-10 right-10 top-4">
          <div className="flex items-center gap-2">
            <Flag className="h-6 w-6 fill-[#ef4444] text-[#ef4444]" />
            <ProgressBar value={70} color="#22c55e" />
            <Flag className="h-6 w-6 fill-[#ef4444] text-[#ef4444]" />
          </div>
        </div>
        <div className="absolute left-10 top-20 rounded-[18px] border-2 border-[#d7e7f8] bg-white p-4 shadow-lg">
          <p className="rounded-full bg-[#0b66c3] px-3 py-1 text-xs font-black text-white">ミッション</p>
          <p className="mt-2 text-sm font-black text-[#0b2551]">あぶない場所を<br />みつけて通報しよう!</p>
        </div>
        <div className="absolute bottom-[24%] left-0 h-24 w-full bg-[#deb887]" />
        <div className="absolute bottom-[24%] left-0 h-5 w-full bg-[#f7e4b3]" />
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="absolute bottom-[32%] h-28 w-20 rounded-t-full bg-[#3fb36e]" style={{ left: `${index * 13}%` }}>
            <span className="absolute bottom-0 left-1/2 h-20 w-4 -translate-x-1/2 bg-[#8b5a2b]" />
          </div>
        ))}
        <Mascot size="lg" pose="jump" className="absolute bottom-[25%] left-[18%]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="absolute bottom-[39%] grid h-14 w-14 place-items-center rounded-[16px] border-4 border-[#ffd23f] bg-[#fff7cc] text-[#f59e0b] shadow-lg"
            style={{ left: `${42 + index * 10}%` }}
          >
            <Shield className="h-7 w-7 fill-[#facc15]" />
          </div>
        ))}
        <div className="absolute bottom-[34%] right-[15%] grid h-20 w-20 place-items-center rounded-full bg-[#111827] shadow-lg">
          <span className="h-10 w-10 rounded-full bg-[#0f172a]" />
          <span className="absolute -top-8 rounded-[14px] bg-white px-3 py-1 text-sm font-black text-[#ef4444] shadow">あぶない!</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 bg-[#064d91] p-4">
        <div className="flex gap-3">
          <button className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white/70 bg-[#16b8a6] text-white shadow" type="button" aria-label="左へ">
            <ArrowLeft className="h-9 w-9" />
          </button>
          <button className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white/70 bg-[#16b8a6] text-white shadow" type="button" aria-label="右へ">
            <ChevronRight className="h-9 w-9" />
          </button>
        </div>
        <div className="min-w-[190px] rounded-[18px] bg-[#063b75] px-5 py-3 text-center text-white">
          <p className="text-xs font-black">安全パワー</p>
          <ProgressBar value={60} color="#ffd23f" />
          <p className="mt-1 text-xl font-black">3/5</p>
        </div>
        <button type="button" onClick={onReward} className="rounded-[18px] bg-[#1e88e5] px-8 py-4 text-xl font-black text-white shadow-lg">
          ジャンプ
        </button>
      </div>
    </div>
  )
}

function TeamMissionScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-[#0757aa] to-[#052e78] p-5 text-[#0b2551]">
      <div className="mb-4 flex items-center justify-between text-white">
        <div>
          <h2 className="text-2xl font-black">きょうりょくミッション</h2>
          <p className="text-sm font-bold text-blue-100">みんなで力を合わせて、まちをもっと安全にしよう!</p>
        </div>
        <div className="rounded-[18px] bg-white px-5 py-3 text-[#0b2551] shadow-lg">
          <p className="text-xs font-black text-[#52708f]">チームポイント</p>
          <p className="text-3xl font-black">4,850 pt</p>
        </div>
      </div>
      <div className="grid h-[calc(100%-92px)] gap-4 lg:grid-cols-[0.58fr_1.42fr]">
        <section className="rounded-[24px] bg-white/95 p-4 shadow-xl">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button className="rounded-[14px] bg-[#0d66c4] py-2 text-sm font-black text-white" type="button">クラスチーム</button>
            <button className="rounded-[14px] border-2 border-[#d8e8f7] bg-white py-2 text-sm font-black" type="button">かぞくチーム</button>
          </div>
          <div className="space-y-2">
            {teamMembers.map(([name, point], index) => (
              <div key={name} className="flex items-center gap-3 rounded-[14px] border border-[#e0ecf8] bg-[#f8fbff] p-2">
                <PlayerFace size="sm" />
                <span className="font-black">{name}</span>
                <span className="ml-auto text-sm font-black text-[#31516f]">{point}</span>
                {index === 0 && <Crown className="h-5 w-5 fill-[#facc15] text-[#eab308]" />}
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-4 rounded-[24px] bg-white p-5 shadow-xl lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#fff7dd] p-4">
            <p className="text-sm font-black text-[#52708f]">みんなの進み具合</p>
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid h-12 flex-1 place-items-center rounded-[10px] border-2 border-[#e8c06d] bg-[#ffe2a1]">
                  {index < 4 ? <Check className="h-7 w-7 rounded-full bg-[#18b56c] p-1 text-white" /> : <Flag className="h-7 w-7 fill-[#ef4444] text-[#ef4444]" />}
                </div>
              ))}
            </div>
            <div className="relative mt-7 grid place-items-center">
              <div className="h-36 w-48 rounded-[28px] border-[7px] border-[#a85f21] bg-gradient-to-b from-[#f7b94d] to-[#c96d23] shadow-2xl" />
              <div className="absolute top-9 h-14 w-56 rounded-t-[80px] border-[7px] border-[#a85f21] bg-[#facc15]" />
              <Lock className="absolute top-[76px] h-16 w-16 rounded-full bg-[#7c3f12] p-3 text-[#ffd23f]" />
              <Sparkles className="absolute left-[20%] top-8 h-8 w-8 fill-[#22c55e] text-[#22c55e]" />
            </div>
            <div className="mt-3 rounded-[16px] bg-white px-4 py-3 text-center text-lg font-black text-[#e57200]">
              次のチーム報酬まで あと 1,150 pt
            </div>
          </div>
          <div className="rounded-[22px] border-2 border-[#d8e8f7] p-4">
            <h3 className="mb-3 text-center text-lg font-black">ミッション</h3>
            {[
              ["危険さがしにちょうせん", 100],
              ["あぶない場所を通報する", 60],
              ["パトロールでコインをあつめる", 80],
            ].map(([label, value]) => (
              <div key={label as string} className="mb-4 rounded-[14px] bg-[#f8fbff] p-3">
                <p className="mb-2 text-sm font-black">{label}</p>
                <ProgressBar value={value as number} color="#f59e0b" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
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

function RewardStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-sm">
      {icon}
      <div>
        <p className="text-xs font-black text-[#52708f]">{label}</p>
        <p className="text-3xl font-black text-[#f97316]">{value}</p>
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

function BattleHp({ name, hp, value, align = "left" }: { name: string; hp: string; value: number; align?: "left" | "right" }) {
  return (
    <div className={cn("rounded-[18px] border-2 border-white bg-white/88 p-2 shadow-lg", align === "right" && "text-right")}>
      <div className={cn("mb-1 flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <PlayerFace size="sm" className={align === "right" ? "bg-[#c4b5fd]" : undefined} />
        <span className="text-sm font-black">{name}</span>
      </div>
      <ProgressBar value={value} color={align === "right" ? "#22c55e" : "#ef4444"} />
      <p className="mt-1 text-xs font-black text-[#52708f]">HP {hp}</p>
    </div>
  )
}

function DangerCloud() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-8 top-8 h-28 rounded-full bg-[#7e3fa4]" />
      <div className="absolute left-4 top-12 h-24 w-24 rounded-full bg-[#7e3fa4]" />
      <div className="absolute right-4 top-12 h-24 w-24 rounded-full bg-[#7e3fa4]" />
      <div className="absolute left-1/2 top-14 h-24 w-28 -translate-x-1/2 rounded-full bg-[#612b84]" />
      <span className="absolute left-[38%] top-[42%] h-3 w-3 rounded-full bg-[#facc15]" />
      <span className="absolute right-[38%] top-[42%] h-3 w-3 rounded-full bg-[#facc15]" />
      <span className="absolute left-1/2 top-[56%] h-5 w-12 -translate-x-1/2 rounded-b-full border-b-[5px] border-[#ff6b6b]" />
      <div className="absolute bottom-10 left-7 h-12 w-5 -rotate-12 rounded-full bg-[#612b84]" />
      <div className="absolute bottom-10 right-7 h-12 w-5 rotate-12 rounded-full bg-[#612b84]" />
    </div>
  )
}

function ItemChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[16px] border-2 border-[#0d66c4] bg-[#f8fbff] p-3">
      {icon}
      <div>
        <p className="text-xs font-black text-[#31516f]">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  )
}

function MysteryScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#f6f0e5]">
      <GameHeader title="なぞときミッション" compact onBack={onBack} />
      <div className="relative flex-1 overflow-hidden bg-[#efe6d5]">
        <StreetPhotoScene />
        <div className="absolute inset-y-0 left-0 w-10 bg-[repeating-linear-gradient(to_bottom,#c9a67c_0_10px,transparent_10px_30px)] opacity-70" />
        <div className="absolute left-12 right-8 top-8 rounded-[24px] bg-white/92 p-5 shadow-xl">
          <div className="flex justify-between gap-5">
            <div>
              <span className="rounded-full bg-[#0d66c4] px-3 py-1 text-xs font-black text-white">ケース 03</span>
              <h3 className="mt-3 text-2xl font-black">「かげから ひょっこりはん!」</h3>
              <p className="mt-3 max-w-[470px] text-sm font-bold leading-relaxed text-[#31516f]">
                公園のまわりの道で、とてもあぶないことが起きているみたい...ヒントを集めて、なぞを解こう!
              </p>
            </div>
            <KidDetective />
          </div>
        </div>
        <div className="absolute bottom-28 left-8 right-8 rounded-[22px] border-4 border-[#d7edf8] bg-[#e8f8ff]/95 p-4 shadow-xl">
          <p className="mb-3 rounded-full bg-[#4cb5e8] px-3 py-1 text-xs font-black text-white">ヒントを集めよう!</p>
          <div className="grid grid-cols-4 gap-3">
            {["ポスター", "足あと", "かげの写真", "?"].map((hint, index) => (
              <div key={hint} className="grid h-24 place-items-center rounded-[16px] border-2 border-[#d8e8f7] bg-white p-2 text-center text-xs font-black">
                {index < 3 ? <ImageIcon className="h-10 w-10 text-[#0d66c4]" /> : <span className="text-4xl text-[#cbd5e1]">?</span>}
                {hint}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-8 right-8 rounded-[22px] border-4 border-[#a7f3d0] bg-white p-4 shadow-xl">
          <p className="mb-2 rounded-full bg-[#36bca5] px-3 py-1 text-xs font-black text-white">なぞを解こう!</p>
          <div className="grid items-center gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-2 text-sm font-black">車のかげからとび出すとどうなる?</p>
              <div className="flex gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span key={index} className="grid h-9 w-9 place-items-center rounded-[8px] border-2 border-[#b7c9d8] bg-[#f8fbff] text-sm font-black">
                    {index === 6 ? "険" : ""}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" className="rounded-[16px] bg-[#0d66c4] px-10 py-3 text-lg font-black text-white shadow">
              こたえを決定する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function KidDetective() {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <PlayerFace size="lg" className="absolute left-7 top-4" />
      <div className="absolute left-8 top-0 h-8 w-20 rounded-full bg-[#a96b2d]" />
      <div className="absolute left-11 top-[70px] h-24 w-20 rounded-[24px] bg-[#b87935]" />
      <Search className="absolute right-0 top-10 h-12 w-12 rounded-full border-4 border-[#895022] bg-white/80 p-1 text-[#895022]" />
    </div>
  )
}

function CollectionScreen({ unlockedRewards, onBack }: { unlockedRewards: string[]; onBack: () => void }) {
  return (
    <div className="h-full bg-gradient-to-b from-[#dff6ff] to-[#f8fcff] p-5">
      <GameHeader
        title="ガチャ・コレクション"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Gift className="h-4 w-4 text-[#f59e0b]" />} value="5" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="120" />
          </>
        }
      />
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[0.62fr_1.38fr]">
        <section className="relative overflow-hidden rounded-[28px] border-4 border-[#0d66c4] bg-[#79d4ff] p-4 shadow-xl">
          <div className="rounded-[22px] bg-[#0d66c4] p-3 text-center text-2xl font-black text-[#ffe066] shadow">
            セーフティ<br />ヒーローガチャ
          </div>
          <div className="relative mx-auto mt-3 h-[310px] max-w-[300px]">
            <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full border-[12px] border-[#e6f6ff] bg-white/60 shadow-inner" />
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-12 w-12 rounded-full border-4 border-white shadow"
                style={{
                  left: `${26 + Math.cos(index) * 34}%`,
                  top: `${30 + Math.sin(index * 1.7) * 26}%`,
                  background: ["#ef4444", "#22c55e", "#60a5fa", "#facc15", "#f472b6"][index % 5],
                }}
              />
            ))}
            <div className="absolute bottom-0 left-1/2 h-32 w-64 -translate-x-1/2 rounded-[28px] border-[8px] border-[#a33428] bg-[#f05a42]" />
            <button type="button" className="absolute bottom-8 left-1/2 grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full border-8 border-[#0d66c4] bg-[#ffd23f] shadow-lg" aria-label="ガチャを回す">
              <Gift className="h-10 w-10 text-[#0d66c4]" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-[18px] bg-[#14b8a6] py-3 text-lg font-black text-white shadow" type="button">1回まわす<br /><span className="text-sm">50</span></button>
            <button className="rounded-[18px] bg-[#ef4444] py-3 text-lg font-black text-white shadow" type="button">10回まわす<br /><span className="text-sm">450</span></button>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <div className="grid rounded-[24px] bg-gradient-to-r from-[#f0526f] to-[#ffb067] p-4 text-white shadow-xl md:grid-cols-[0.34fr_1fr]">
            <div className="grid place-items-center rounded-[18px] bg-white/22">
              <Mascot pose="point" />
            </div>
            <div className="pl-4">
              <h3 className="text-2xl font-black">新しいヒーローをゲット!</h3>
              <div className="mt-4 rounded-[18px] bg-white p-4 text-[#0b2551] shadow">
                <span className="rounded-full bg-[#ef4444] px-2 py-1 text-xs font-black text-white">NEW!</span>
                <h4 className="mt-2 text-xl font-black">ガードマン</h4>
                <p className="text-sm font-bold text-[#31516f]">みんなを守る、まちのヒーロー! 危険を見つけてお知らせしてくれるよ。</p>
              </div>
            </div>
          </div>
          <div className="flex-1 rounded-[24px] border-4 border-[#0c9c95] bg-[#dffbf4] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between rounded-full bg-[#0c9c95] px-4 py-2 text-white">
              <h3 className="font-black">シールコレクション</h3>
              <span className="font-black">24/48</span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {collectionItems.map((item) => {
                const locked = item.locked && !unlockedRewards.includes(item.key)

                return (
                <div key={item.name} className="rounded-[16px] border-2 border-[#c7ddf2] bg-white p-3 text-center shadow-sm">
                  <div className="relative mx-auto mb-2 grid h-24 place-items-center rounded-[14px] bg-[#f8fbff]">
                    {locked ? (
                      <span className="text-5xl font-black text-[#cbd5e1]">?</span>
                    ) : (
                      <Mascot size="sm" className="scale-90" />
                    )}
                    {!locked && <span className="absolute left-1 top-1 rounded bg-[#ef4444] px-1 text-[10px] font-black text-white">NEW!</span>}
                  </div>
                  <p className="text-xs font-black">{item.name}</p>
                  <p className="text-xs font-black text-[#eab308]">{item.rarity}</p>
                </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function RankingScreen({ onBack }: { onBack: () => void }) {
  const rows = [
    ["4", "ゆうき", "3,120 pt"],
    ["5", "あかり", "2,950 pt"],
    ["23", "あなた", "2,840 pt"],
  ]
  return (
    <div className="h-full bg-gradient-to-b from-[#ecf9ff] to-[#fff7e6] p-5">
      <GameHeader
        title="ランキング＆イベント"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="2,840 pt" />}
      />
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border-4 border-white bg-white p-4 shadow-xl">
          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#12a777] to-[#6ee7b7] p-5 text-white">
            <div className="absolute bottom-0 right-0 h-32 w-56 rounded-tl-full bg-white/25" />
            <h3 className="text-2xl font-black">春のあんぜんたんけんフェス</h3>
            <p className="text-sm font-bold">イベント期間: 4/20(土) - 5/20(月)</p>
            <div className="relative z-10 mt-4 flex items-center gap-4">
              <Mascot size="md" pose="point" />
              <p className="rounded-[18px] bg-white/88 px-4 py-3 text-sm font-black text-[#0b2551] shadow">ミッションをクリアして<br />限定バッジをゲットしよう!</p>
            </div>
          </div>
          <div className="mt-4 rounded-[22px] border-2 border-[#d8e8f7] bg-[#f8fbff] p-4">
            <h4 className="mb-3 font-black text-[#0b2551]">イベントミッション</h4>
            {[
              ["あぶない場所を10こ見つけよう!", 60, "6/10", "+200 pt"],
              ["クイズで5問正解しよう", 60, "3/5", "+150 pt"],
              ["お友だちに安全をおしえよう!", 33, "1/3", "+100 pt"],
            ].map(([label, value, progress, reward]) => (
              <div key={label as string} className="mb-3 grid grid-cols-[1fr_auto] gap-3 rounded-[16px] bg-white p-3 shadow-sm">
                <div>
                  <p className="text-sm font-black">{label as string}</p>
                  <ProgressBar value={value as number} color="#12a777" />
                </div>
                <p className="text-right text-sm font-black">
                  {progress as string}
                  <br />
                  <span className="text-[#f97316]">{reward as string}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[28px] border-4 border-white bg-white p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-[14px] bg-[#0d66c4] py-2 font-black text-white" type="button">全国ランキング</button>
            <button className="rounded-[14px] bg-[#f1f5f9] py-2 font-black text-[#31516f]" type="button">おともだちランキング</button>
          </div>
          <div className="mt-6 grid grid-cols-3 items-end gap-3">
            {[
              ["2", "はると", "4,320 pt", "bg-[#e5e7eb]", "h-28"],
              ["1", "みお", "5,680 pt", "bg-[#ffd76a]", "h-36"],
              ["3", "りく", "3,890 pt", "bg-[#f8c29d]", "h-24"],
            ].map(([rank, name, point, color, height]) => (
              <div key={rank as string} className="text-center">
                <Crown className={cn("mx-auto mb-1 h-8 w-8", rank === "1" ? "fill-[#facc15] text-[#eab308]" : "fill-[#cbd5e1] text-[#94a3b8]")} />
                <div className={cn("rounded-t-[22px] p-3 shadow", color as string, height as string)}>
                  <PlayerFace className="mx-auto" />
                  <p className="font-black">{name as string}</p>
                  <p className="text-sm font-black">{point as string}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-[18px] border-2 border-[#d8e8f7]">
            {rows.map(([rank, name, point]) => (
              <div key={rank} className={cn("grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-sm font-black", name === "あなた" ? "bg-[#dff6ff] text-[#0d66c4]" : "bg-white")}>
                <span>{rank}</span>
                <span>{name}</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
          <button type="button" className="mt-5 w-full rounded-[20px] bg-[#ff8b18] py-4 text-xl font-black text-white shadow-lg">
            イベントに参加する!
          </button>
        </section>
      </div>
    </div>
  )
}

function AvatarScreen({
  avatarColor,
  equippedHat,
  onColor,
  onHat,
  onBack,
}: {
  avatarColor: string
  equippedHat: string
  onColor: (color: string) => void
  onHat: (hat: string) => void
  onBack: () => void
}) {
  const hats = ["ぼうし", "ヘルメット", "キャップ", "ねこ耳"]
  const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ef4444", "#facc15"]
  return (
    <div className="h-full bg-gradient-to-br from-[#fff6e8] via-[#fffaf2] to-[#dff6ff]">
      <GameHeader
        title="アバターカスタム"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="1,250" />}
      />
      <div className="grid h-[calc(100%-56px)] gap-4 p-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative overflow-hidden rounded-[28px] bg-[#ffefd8]/80 p-5 shadow-inner">
          <div className="absolute left-8 top-14 rounded-[18px] bg-white p-4 text-sm font-black shadow">ぼうしやふくを<br />えらんでね!</div>
          <div className="absolute right-10 top-14 h-36 w-24 rounded-full border-8 border-[#d6a675] bg-[#fef3c7]" />
          <div className="absolute right-7 top-28 h-40 w-32 rounded-[18px] bg-[#a7f3d0]/70" />
          <div className="absolute bottom-8 left-1/2 h-12 w-56 -translate-x-1/2 rounded-full bg-black/10 blur-sm" />
          <KidAvatar color={avatarColor} hat={equippedHat} className="absolute left-1/2 top-[14%] -translate-x-1/2 scale-125" />
        </section>
        <section className="flex flex-col gap-4">
          <div className="rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <div className="mb-3 flex gap-2">
              {["ぼうし", "ふく", "くつ", "アクセ", "カラー"].map((tab, index) => (
                <button key={tab} className={cn("flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm font-black", index === 0 ? "bg-[#0d66c4] text-white" : "bg-[#f1f5f9]")} type="button">
                  {index === 4 ? <Palette className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  {tab}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {hats.map((hat) => (
                <button
                  key={hat}
                  type="button"
                  onClick={() => onHat(hat)}
                  className={cn("grid h-24 place-items-center rounded-[16px] border-2 bg-[#f8fbff] text-sm font-black shadow-sm", equippedHat === hat ? "border-[#0d66c4] ring-4 ring-[#dff6ff]" : "border-[#d8e8f7]")}
                >
                  <div className="h-10 w-16 rounded-t-full border-4 border-[#31583b]" style={{ background: hat === "ヘルメット" ? "#facc15" : hat === "キャップ" ? "#3b82f6" : hat === "ねこ耳" ? "#f5b7c8" : avatarColor }} />
                  {hat}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <h3 className="mb-3 font-black">カラー</h3>
            <div className="flex flex-wrap gap-3">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onColor(color)}
                  className={cn("h-12 w-12 rounded-full border-4 border-white shadow", avatarColor === color && "ring-4 ring-[#0d66c4]")}
                  style={{ background: color }}
                  aria-label={`${color}を選択`}
                />
              ))}
              <button className="grid h-12 w-12 place-items-center rounded-[14px] border-2 border-[#d8e8f7] bg-[#f8fbff]" type="button">
                <RotateCcw className="h-6 w-6 text-[#52708f]" />
              </button>
            </div>
          </div>
          <button type="button" className="mt-auto rounded-[18px] bg-[#0d66c4] py-4 text-xl font-black text-white shadow-lg">
            このアバターで けってい!
          </button>
        </section>
      </div>
    </div>
  )
}

function DefendTownScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full bg-gradient-to-b from-[#d9f6ff] to-[#f5fbff]">
      <GameHeader
        title="まちをまもろう"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Heart className="h-4 w-4 fill-[#ef4444] text-[#ef4444]" />} value="5/5" />
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="1,850" />
            <StatusPill icon={<Shield className="h-4 w-4 text-[#0d66c4]" />} value="レベル 8" />
          </>
        }
      />
      <div className="relative h-[calc(100%-56px)] overflow-hidden">
        <div className="absolute left-1/2 top-5 z-10 w-[72%] -translate-x-1/2 rounded-[24px] bg-white/90 p-4 text-center shadow-lg">
          <h3 className="text-xl font-black">ステージ 3-2　こうさてんのあんぜん</h3>
          <p className="text-sm font-bold text-[#31516f]">あぶないスポットをなおして、安全なまちにしよう!</p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#bfe8ff] to-[#9ed7a6]" />
        <IsometricTown />
        <div className="absolute bottom-6 left-8 rounded-[20px] border-2 border-[#b7ead1] bg-white/92 p-4 shadow-xl">
          <p className="mb-2 rounded-full bg-[#16b8a6] px-3 py-1 text-xs font-black text-white">クリア条件</p>
          <p className="text-sm font-black">あぶないスポットをすべてなおす</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-black">
            <Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />を20こ集める
            <span className="ml-auto">15/20</span>
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 grid h-24 w-24 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-[#55a7ff] shadow-2xl">
          <span className="text-4xl font-black text-white">3</span>
        </div>
        <div className="absolute bottom-8 right-10">
          <Mascot size="md" />
          <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[#ef4444] text-sm font-black text-white">2</span>
        </div>
      </div>
    </div>
  )
}

function IsometricTown() {
  const blocks = [
    [26, 44, "#a7f3d0", Shield],
    [38, 35, "#bae6fd", Home],
    [51, 47, "#fde68a", Target],
    [63, 35, "#fdba74", Award],
    [72, 55, "#fca5a5", Lock],
    [42, 58, "#bbf7d0", Star],
    [57, 64, "#93c5fd", Home],
  ] as const
  return (
    <div className="absolute inset-0 top-20">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="absolute h-[44%] w-[9%] rotate-[55deg] rounded-full bg-white/45"
          style={{ left: `${14 + index * 9}%`, top: `${9 + (index % 2) * 17}%` }}
        />
      ))}
      {blocks.map(([left, top, color, Icon], index) => (
        <div key={`${left}-${top}`} className="absolute h-24 w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
          <div className="absolute inset-x-0 bottom-0 h-16 skew-y-[-12deg] rounded-[14px] border-2 border-white shadow-lg" style={{ background: color }} />
          <Icon className="absolute left-1/2 top-4 h-9 w-9 -translate-x-1/2 text-[#0d66c4]" />
          {index === 4 && <DangerCloud />}
          {index === 2 && <span className="absolute -right-1 -top-2 grid h-8 w-8 place-items-center rounded-full bg-[#f97316] text-white">!</span>}
        </div>
      ))}
      <KidAvatar className="absolute left-[27%] top-[56%] scale-[0.32]" />
    </div>
  )
}

function ArPhotoScreen({ onBack }: { onBack: () => void }) {
  const [practicePhotoName, setPracticePhotoName] = useState<string | null>(null)
  const [practiceStatus, setPracticeStatus] = useState("練習写真を準備しました")

  const submitPrivatePracticePhoto = async (file: File) => {
    if (typeof fetch !== "function") return

    try {
      const imageBase64 = await readFileAsDataUrl(file)
      const response = await fetch("/api/safety-quest/private-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          markers: [],
        }),
      })
      if (!response.ok) return

      const body = await response.json().catch(() => null)
      const pointsAwarded = Number(body?.score?.pointsAwarded ?? 0)
      setPracticeStatus(pointsAwarded > 0 ? `AIが安全ポイントを確認しました +${pointsAwarded}pt` : "AIが安全ポイントを確認しました")
    } catch {
      setPracticeStatus("練習写真を準備しました")
    }
  }

  const handlePracticeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPracticePhotoName(file.name)
    setPracticeStatus("練習写真を準備しました")
    void submitPrivatePracticePhoto(file)
  }

  return (
    <div className="flex h-full flex-col bg-[#0b2551]">
      <GameHeader
        title="ARたんけんフォト"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Check className="h-4 w-4 text-[#10b981]" />} value="みつけた数 3/5" />}
      />
      <div className="relative flex-1 overflow-hidden">
        <StreetPhotoScene ar />
        <div className="absolute left-7 top-6 rounded-[18px] bg-white/92 px-5 py-3 shadow-lg">
          <p className="rounded-full bg-[#13a89e] px-3 py-1 text-xs font-black text-white">ミッション</p>
          <p className="mt-2 text-sm font-black">あぶないサインを みつけよう!</p>
        </div>
        <div className="absolute right-7 top-6 w-[300px] rounded-[20px] border-2 border-white/70 bg-white/95 p-4 text-[#0b2551] shadow-xl">
          <h3 className="text-lg font-black">自分で練習</h3>
          <p className="mt-2 text-xs font-bold leading-relaxed text-[#31516f]">
            顔・名前・学校名・家の入口・車のナンバーが写っていない写真だけを使ってください。
          </p>
          <input
            id="safety-quest-private-practice-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="練習写真をアップロード"
            onChange={handlePracticeUpload}
          />
          <label
            htmlFor="safety-quest-private-practice-upload"
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[16px] bg-[#0d66c4] px-4 py-3 text-sm font-black text-white shadow"
          >
            <Upload className="h-5 w-5" />
            写真をアップロード
          </label>
          {practicePhotoName && (
            <div className="mt-3 rounded-[14px] border-2 border-[#b7ead1] bg-[#ecfdf5] p-3 text-xs font-black text-[#087b55]">
              <p>{practiceStatus}</p>
              <p className="mt-1 truncate text-[#31516f]">{practicePhotoName}</p>
            </div>
          )}
        </div>
        <div className="absolute left-[61%] top-[24%] grid h-28 w-28 -translate-x-1/2 place-items-center rounded-[18px] border-4 border-[#ff6b6b] bg-[#ef4444]/18 shadow-[0_0_28px_rgba(239,68,68,.8)]">
          <span className="text-6xl font-black text-[#ff6b6b] drop-shadow">!</span>
        </div>
        <div className="absolute right-[18%] top-[50%]">
          <Star className="h-24 w-24 fill-[#ffcf35] text-[#ffcf35] drop-shadow-[0_0_18px_rgba(250,204,21,.85)]" />
        </div>
        <div className="absolute left-[18%] top-[36%] h-24 w-24">
          <DangerCloud />
        </div>
        <div className="absolute bottom-24 left-10 right-10 flex items-center gap-4 rounded-[18px] bg-white/92 p-4 shadow-xl">
          <Mascot size="sm" />
          <p className="flex-1 text-sm font-black">やったね! あぶないサインをみつけたよ!</p>
          <span className="text-xl font-black text-[#f97316]">+50pt</span>
        </div>
        <div className="absolute bottom-5 left-0 right-0 flex items-end justify-center gap-16 text-white">
          <button type="button" className="grid h-16 w-16 place-items-center rounded-[18px] border-2 border-white/70 bg-[#0b2551]/60" aria-label="アルバム">
            <ImageIcon className="h-8 w-8" />
          </button>
          <button type="button" className="grid h-24 w-24 place-items-center rounded-full border-8 border-white bg-[#318ff0] shadow-2xl" aria-label="撮影">
            <Camera className="h-12 w-12" />
          </button>
          <button type="button" className="relative grid h-16 w-16 place-items-center rounded-[18px] border-2 border-white/70 bg-[#0b2551]/60" aria-label="ヒント">
            <Sparkles className="h-8 w-8 text-[#facc15]" />
            <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-[#0b2551]">2</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function HeroEncyclopediaScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full bg-gradient-to-br from-[#e8f6ff] to-[#f7fbff]">
      <GameHeader title="安全ヒーロー図鑑" compact onBack={onBack} />
      <div className="grid h-[calc(100%-56px)] gap-4 p-4 lg:grid-cols-[180px_1fr]">
        <aside className="rounded-[24px] border-2 border-[#d8e8f7] bg-white/95 p-3 shadow-lg">
          <div className="mb-4 rounded-[18px] bg-[#f8fbff] p-3 text-center">
            <p className="text-xs font-black text-[#52708f]">図鑑コンプ率</p>
            <p className="text-2xl font-black">68%</p>
            <ProgressBar value={68} color="#14b8a6" />
          </div>
          {["ヒーロー", "バッジ", "ルート生き物", "ストーリー"].map((item, index) => (
            <button key={item} type="button" className={cn("mb-2 flex w-full items-center gap-2 rounded-[14px] px-3 py-3 text-sm font-black", index === 0 ? "bg-[#0d66c4] text-white" : "bg-[#f8fbff]")}>
              <Shield className="h-5 w-5" />
              {item}
            </button>
          ))}
          <div className="mt-auto">
            <Mascot size="md" />
          </div>
        </aside>
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              ["ヒーロー", "18/28"],
              ["バッジ", "42/72"],
              ["ルート生き物", "26/40"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[18px] border-2 border-[#d8e8f7] bg-white p-3 text-center shadow-sm">
                <p className="text-xs font-black text-[#52708f]">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-4 gap-4">
            {heroCards.map((hero) => (
              <div key={hero.name} className="rounded-[20px] border-2 border-[#d8e8f7] bg-white p-4 text-center shadow-lg">
                <h3 className={cn("mb-2 font-black", hero.locked ? "text-[#94a3b8]" : "text-[#0d66c4]")}>{hero.name}</h3>
                <div className="relative mx-auto h-36 rounded-[18px] bg-[#f8fbff]">
                  {hero.locked ? (
                    <div className="grid h-full place-items-center">
                      <Lock className="h-16 w-16 text-[#cbd5e1]" />
                    </div>
                  ) : (
                    <Mascot size="lg" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-75" />
                  )}
                  {!hero.locked && <Star className="absolute right-3 top-3 h-6 w-6 fill-[#facc15] text-[#eab308]" />}
                </div>
                <p className="mt-3 text-sm font-black text-[#eab308]">{"★".repeat(hero.stars)}{"☆".repeat(3 - hero.stars)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[22px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-[#0d66c4]">バッジコレクション</h3>
              <button type="button" className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-black">すべて見る</button>
            </div>
            <div className="flex gap-4">
              {["#f59e0b", "#0d66c4", "#ef4444", "#14b8a6", "#7c3aed"].map((color, index) => (
                <div key={color} className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white shadow" style={{ background: color }}>
                  <Shield className="h-9 w-9 fill-white/20 text-white" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function RoomScreen({ onBack, onExplore }: { onBack: () => void; onExplore: () => void }) {
  return (
    <div className="h-full bg-gradient-to-b from-[#fff0cf] to-[#dff7ff]">
      <GameHeader
        title="マイルーム"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="2,450" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="280" />
          </>
        }
      />
      <div className="relative h-[calc(100%-56px)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff6df] to-[#e1f7ff]" />
        <div className="absolute left-0 right-0 top-0 h-20 bg-[repeating-linear-gradient(90deg,#ff8b18_0_36px,#facc15_36px_72px,#60a5fa_72px_108px,#34d399_108px_144px)] opacity-30" />
        <div className="absolute bottom-[18%] left-0 h-[32%] w-full bg-[#d79b61]" />
        <div className="absolute bottom-[18%] left-0 h-5 w-full bg-[#b56d37]" />
        <div className="absolute left-[44%] top-20 h-56 w-48 rounded-t-[80px] bg-[#fff9e7] shadow-inner" />
        <div className="absolute left-[45%] top-28 h-40 w-20 rounded-b-[40px] bg-[#94d3a2]" />
        <div className="absolute left-[57%] top-28 h-40 w-20 rounded-b-[40px] bg-[#94d3a2]" />

        <section className="absolute left-7 top-6 w-[34%] rounded-[24px] bg-white/95 p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <PlayerFace size="lg" />
            <div>
              <h3 className="text-xl font-black">そうた</h3>
              <p className="text-sm font-bold text-[#31516f]">安全マスター見習い</p>
            </div>
            <span className="ml-auto rounded-[16px] bg-[#0d66c4] px-3 py-2 text-center text-xs font-black text-white">レベル<br /><span className="text-xl">12</span></span>
          </div>
        </section>

        <section className="absolute left-7 top-[28%] w-[34%] rounded-[24px] bg-white/95 p-4 shadow-xl">
          <h3 className="mb-3 text-sm font-black text-[#31516f]">今月のミッション</h3>
          <MissionLine label="あんぜんな道を3回シェアしよう" value={67} progress="2/3" />
          <MissionLine label="ARたんけんを5回クリアしよう" value={80} progress="4/5" />
          <button type="button" className="mt-3 rounded-full bg-[#14b8a6] px-5 py-2 text-sm font-black text-white">ミッションを見る</button>
        </section>

        <div className="absolute bottom-[25%] left-[42%] grid h-32 w-32 place-items-center rounded-[24px] bg-[#2563eb] shadow-xl">
          <div className="h-24 w-24 rounded-[20px] border-4 border-[#1e40af] bg-[#3b82f6]" />
        </div>
        <div className="absolute bottom-[26%] left-[60%]">
          <Trophy className="h-20 w-20 fill-[#facc15] text-[#d97706]" />
        </div>
        <div className="absolute bottom-[34%] right-[19%] flex gap-4">
          <Shield className="h-14 w-14 fill-[#1d4ed8]/20 text-[#1d4ed8]" />
          <Shield className="h-14 w-14 fill-[#f59e0b]/20 text-[#f59e0b]" />
        </div>
        <div className="absolute right-8 top-20 grid w-[25%] grid-cols-2 gap-3">
          <div className="rounded-[18px] border-4 border-white bg-[#fffaf0] p-2 shadow-lg">
            <p className="mb-1 text-center text-xs font-black">ぼくのマップ</p>
            <div className="h-24 rounded-[14px] bg-gradient-to-br from-[#bbf7d0] to-[#93c5fd]" />
          </div>
          <div className="rounded-[18px] border-4 border-white bg-[#fffaf0] p-2 shadow-lg">
            <p className="mb-1 text-center text-xs font-black">たんけんの思い出</p>
            <div className="grid h-24 grid-cols-2 gap-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[8px] bg-[#bfdbfe]" />
              ))}
            </div>
          </div>
        </div>
        <Mascot size="md" className="absolute bottom-[15%] right-[32%]" />
        <div className="absolute bottom-4 left-8 right-8 flex items-center justify-between rounded-[24px] bg-white/95 p-3 shadow-xl">
          {["コレクション", "ずかん", "トロフィー", "ショップ", "フレンド"].map((item, index) => (
            <button key={item} type="button" className="grid place-items-center gap-1 rounded-[16px] px-4 py-2 text-xs font-black text-[#31516f]">
              {[Gift, BookOpen, Trophy, Award, Users].map((Icon, iconIndex) => (iconIndex === index ? <Icon key={iconIndex} className="h-6 w-6 text-[#0d66c4]" /> : null))}
              {item}
            </button>
          ))}
          <button type="button" onClick={onExplore} className="rounded-[20px] bg-[#14b8a6] px-8 py-4 text-xl font-black text-white shadow-lg">
            たんけんにでかける
          </button>
        </div>
      </div>
    </div>
  )
}

function MissionLine({ label, value, progress }: { label: string; value: number; progress: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm font-black">
        <span>{label}</span>
        <span>{progress}</span>
      </div>
      <ProgressBar value={value} color="#14b8a6" />
    </div>
  )
}
