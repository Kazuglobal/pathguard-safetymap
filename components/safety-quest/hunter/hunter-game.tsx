"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Eye,
  Home,
  Images,
  Lightbulb,
  Lock,
  Map as MapIcon,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { mutate } from "swr"

import { pickDailyMission, type HunterDailyMode } from "@/lib/hunter/daily-mission"
import { loadLastPin, saveLastPin } from "@/lib/hunter/last-pin"
import { judgeTap } from "@/lib/hunter/scoring"
import {
  classifySessionFailure,
  postHunterSession,
  type HunterSessionFailure,
  type HunterSessionSummary,
} from "@/lib/hunter/session-client"
import type {
  HunterAccidentSummary,
  HunterAnalysisMode,
  HunterHazard,
  HunterQuizAnswer,
  HunterQuizItem,
  HunterSafePoint,
  HunterTap,
  HunterTapOutcome,
} from "@/lib/hunter/types"

import { CareCard } from "./care-card"
import { ExploreCanvas } from "./explore-canvas"
import { SafeHuntCanvas } from "./safe-hunt-canvas"
import { MaskConfirm } from "./mask-confirm"
import { HunterQuizPanel } from "./quiz-panel"
import { ResultCard } from "./result-card"
import { SessionFailureScreen } from "./session-failure-screen"
import { Onboarding, hasSeenOnboarding, markOnboardingSeen } from "./onboarding"
import {
  BottomBar,
  Celebrate,
  HunterShell,
  Mascot,
  PaperPanel,
  PhotoFrame,
  PrimaryCTA,
  SpeechBubble,
  screenVariants,
  tokens,
  type NavDirection,
} from "./theme"

type Screen =
  | "home"
  | "select"
  | "mask"
  | "pin"
  | "consent"
  | "analyzing"
  | "mode"
  | "explore"
  | "quiz"
  | "safe"
  | "result"
  | "records"

type PlayMode = "explore" | "quiz"

interface Pin {
  latitude: number
  longitude: number
}

/** 保存の控えめな通知。skipped=「のこす」を選んだが危険 0 件で保存しなかった。 */
type SaveNotice = "ok" | "error" | "skipped" | null

/** 写真の入口。カメラ直撮り=いま この場所 → ピン画面で現在地を自動提案する。 */
type PhotoSource = "camera" | "album"

/** AI 解析のクライアント側上限。サーバ側(初回35秒+再試行/再出力20秒)より長く取る。 */
const ANALYZE_TIMEOUT_MS = 95_000

const C = tokens.color

// These screens embed Mapbox and are only reachable after an explicit user
// action. Keeping them client-only avoids shipping Mapbox in the Worker.
const DangerMapScreen = dynamic(
  () => import("./danger-map-screen").then((module) => module.DangerMapScreen),
  { ssr: false },
)
const LocationPinPicker = dynamic(
  () => import("./location-pin-picker").then((module) => module.LocationPinPicker),
  { ssr: false },
)

/** 画面の「深さ」。遷移方向(すすむ/もどる)の判定に使う。 */
const SCREEN_DEPTH: Record<Screen, number> = {
  home: 0,
  records: 1,
  select: 1,
  mask: 2,
  pin: 3,
  consent: 4,
  analyzing: 5,
  mode: 6,
  explore: 7,
  quiz: 7,
  safe: 7,
  result: 8,
}

export function HunterGame({ userId = null }: { userId?: string | null } = {}) {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>("home")
  const [direction, setDirection] = useState<NavDirection>(1)
  const [file, setFile] = useState<File | null>(null)
  const [maskedUrl, setMaskedUrl] = useState<string | null>(null)
  const [maskedCount, setMaskedCount] = useState(0)
  const [pin, setPin] = useState<Pin | null>(null)
  const [hazards, setHazards] = useState<readonly HunterHazard[]>([])
  const [accident, setAccident] = useState<HunterAccidentSummary | null>(null)
  const [quiz, setQuiz] = useState<readonly HunterQuizItem[]>([])
  const [safePoints, setSafePoints] = useState<readonly HunterSafePoint[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<HunterAnalysisMode>("explore")
  const [noHazardFollow, setNoHazardFollow] = useState<string | null>(null)
  const [foundIds, setFoundIds] = useState<string[]>([])
  const [taps, setTaps] = useState<HunterTap[]>([])
  const [lastTap, setLastTap] = useState<{ x: number; y: number } | null>(null)
  const [lastOutcome, setLastOutcome] = useState<HunterTapOutcome | null>(null)
  const [result, setResult] = useState<HunterSessionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [celebratePoints, setCelebratePoints] = useState<number | null>(null)
  const [mode, setMode] = useState<PlayMode>("explore")
  // 「のこす(きろく保存)」の同意。第三者AI送信の同意とは別物。既定オフ。
  const [saveConsent, setSaveConsent] = useState(false)
  // 保存結果の控えめな通知(成功/失敗)。ゲームは止めない。
  const [saveNotice, setSaveNotice] = useState<SaveNotice>(null)
  // 「きろくに のこす」で保存できた写真の ID。session に紐づけ、結果画面から きろく へ飛べる。
  const [savedPhotoId, setSavedPhotoId] = useState<string | null>(null)
  // 採点(session)に失敗した理由。0 点の結果を捏造せず、理由と復帰導線を出す。
  const [sessionFailure, setSessionFailure] = useState<HunterSessionFailure | null>(null)
  const [photoSource, setPhotoSource] = useState<PhotoSource>("album")
  // きろくから再プレイ中の写真 ID。期限切れ時は再解析ではなく きろくの再取得で復帰する
  // (maskedUrl は署名URLで data URL ではないため、AI へは送れない)。
  const [replayPhotoId, setReplayPhotoId] = useState<string | null>(null)
  // オンボーディング: null=判定前(SSR) / true=表示 / false=非表示
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  const reduce = useReducedMotion()
  const foundSet = useMemo(() => new Set(foundIds), [foundIds])
  const quizItems = quiz

  useEffect(() => {
    setShowOnboarding(!hasSeenOnboarding())
  }, [])

  /** 深さにもとづいて方向を決めてから画面を切りかえる。 */
  const navigate = useCallback(
    (next: Screen) => {
      setDirection(SCREEN_DEPTH[next] >= SCREEN_DEPTH[screen] ? 1 : -1)
      setScreen(next)
    },
    [screen],
  )

  const resetPlay = useCallback(() => {
    setFoundIds([])
    setTaps([])
    setLastTap(null)
    setLastOutcome(null)
    setResult(null)
  }, [])

  const resetAll = useCallback(() => {
    resetPlay()
    setFile(null)
    setMaskedUrl(null)
    setPin(null)
    setHazards([])
    setAccident(null)
    setQuiz([])
    setSafePoints([])
    setSessionId(null)
    setAnalysisMode("explore")
    setNoHazardFollow(null)
    setError(null)
    setSavedPhotoId(null)
    setSessionFailure(null)
    setReplayPhotoId(null)
  }, [resetPlay])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setPhotoSource(event.target.id === "hunter-photo-camera" ? "camera" : "album")
    setFile(selected)
    navigate("mask")
  }

  // 解析の中断用(analyzing 画面の「やめる」)。
  const analyzeAbortRef = useRef<AbortController | null>(null)
  const cancelAnalyze = useCallback(() => {
    analyzeAbortRef.current?.abort()
  }, [])

  const runAnalyze = useCallback(
    async (confirmedPin: Pin, image: string, save: boolean) => {
      setBusy(true)
      setError(null)
      setSaveNotice(null)
      setReplayPhotoId(null)
      setDirection(1)
      setScreen("analyzing")
      const controller = new AbortController()
      analyzeAbortRef.current = controller
      // 上流がハングしても無期限に待たせない(「やめて もどる」とは別に時間で打ち切る)。
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, ANALYZE_TIMEOUT_MS)
      try {
        const response = await fetch("/api/hunter/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: image,
            pin: confirmedPin,
            consent: true,
            save,
          }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          setError(body?.error ?? "写真の解析にしっぱいしました。")
          setDirection(-1)
          setScreen("consent")
          return
        }
        setHazards(body.hazards ?? [])
        setAccident(body.accident ?? null)
        setQuiz(body.quiz ?? [])
        setSafePoints(body.safePoints ?? [])
        setSessionId(body.sessionId ?? null)
        setAnalysisMode(body.mode === "guide" ? "guide" : "explore")
        setNoHazardFollow(body.noHazardFollow ?? null)
        const photoId = typeof body.photoId === "string" && !body.savedError ? body.photoId : null
        setSavedPhotoId(photoId)
        if (save) {
          setSaveNotice(body.savedError ? "error" : photoId ? "ok" : body.saveSkipped ? "skipped" : null)
        }
        resetPlay()
        setDirection(1)
        setScreen("mode")
      } catch (err) {
        setDirection(-1)
        setScreen("consent")
        // 自分で「やめる」を押したときはエラー扱いにしない。時間切れは理由を伝える。
        if (timedOut) {
          setError("AIが ねぼうしているみたい。すこし まってから もういちど ためしてね。")
        } else if ((err as Error)?.name !== "AbortError") {
          setError("つうしんエラーが おきました。もう一度ためしてね。")
        }
      } finally {
        clearTimeout(timeout)
        analyzeAbortRef.current = null
        setBusy(false)
      }
    },
    [resetPlay],
  )

  const handleTap = (tap: HunterTap) => {
    setTaps([...taps, tap])
    setLastTap(tap)
    const outcome = judgeTap(tap, hazards, foundSet)
    setLastOutcome(outcome)
    if (outcome.result === "hit" && outcome.hazardId) {
      setFoundIds([...foundIds, outcome.hazardId])
    }
    // 全発見でも自動で結果画面へ遷移しない: hit 直後の「なんで危ない?+つぎにすること」
    // カードを読む時間を保証するため、遷移は CTA「けっかを みる」の明示タップに委ねる。
    // (自動 finish だと最終 hit=hazard 1件の写真では学習カードが一度も読めなかった)
  }

  /**
   * サーバ再採点 → 結果画面。失敗しても 0 点の結果を捏造せず、理由と復帰導線を出す。
   * ポイント/ミッションが動いたら SWR のキャッシュを更新し、mypage 等の表示を同期する。
   */
  const finishWith = useCallback(
    async (payload: Record<string, unknown>, fallbackTotal: number) => {
      setBusy(true)
      setSessionFailure(null)
      try {
        const outcome = await postHunterSession(
          { ...payload, sessionId: sessionId ?? undefined, photoId: savedPhotoId ?? undefined },
          fallbackTotal,
        )
        if (outcome.ok && outcome.result) {
          setResult(outcome.result)
          if (outcome.result.pointsAwarded > 0 || outcome.result.missionsCompleted.length > 0) {
            void mutate("user_points")
            void mutate("missions")
          }
        } else {
          setResult(null)
          setSessionFailure(outcome.failure ?? classifySessionFailure(0, null))
        }
      } finally {
        setBusy(false)
        setDirection(1)
        setScreen("result")
      }
    },
    [sessionId, savedPhotoId],
  )

  const finishSession = useCallback(
    (sessionTaps: HunterTap[]) => finishWith({ mode: "explore", hazards, taps: sessionTaps }, hazards.length),
    [finishWith, hazards],
  )

  const finishQuizSession = useCallback(
    (answers: HunterQuizAnswer[]) => finishWith({ mode: "quiz", items: quizItems, answers }, quizItems.length),
    [finishWith, quizItems],
  )

  /**
   * きろくの写真で もういちど さがす(再解析なし・AI コスト 0・待ち 0)。
   * GET /api/hunter/photo/[id] が返す検出結果と新しい sessionId でモード選択へ。
   */
  const startFromRecord = useCallback(
    async (photoId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/hunter/photo/${photoId}`)
        const body = await response.json().catch(() => null)
        if (!response.ok || !body || typeof body.signedUrl !== "string") return false
        const loaded: HunterHazard[] = Array.isArray(body.hazards) ? body.hazards : []
        if (loaded.length === 0) return false
        resetAll()
        setMaskedUrl(body.signedUrl)
        setMaskedCount(0)
        setPin(body.pin ?? null)
        setHazards(loaded)
        setSessionId(typeof body.sessionId === "string" ? body.sessionId : null)
        setSavedPhotoId(photoId)
        setReplayPhotoId(photoId)
        setAnalysisMode("explore")
        setDirection(1)
        setScreen("mode")
        return true
      } catch {
        return false
      }
    },
    [resetAll],
  )

  // 発見(hit)時に お祝い演出(ハンドラ挙動は変えず lastOutcome を監視)
  useEffect(() => {
    if (lastOutcome?.result !== "hit") return
    setCelebratePoints(lastOutcome.points > 0 ? lastOutcome.points : null)
    const timer = setTimeout(() => setCelebratePoints(null), 950)
    return () => clearTimeout(timer)
  }, [lastOutcome])

  // 保存通知は数秒で自動的に消す
  useEffect(() => {
    if (!saveNotice) return
    const timer = setTimeout(() => setSaveNotice(null), 3600)
    return () => clearTimeout(timer)
  }, [saveNotice])

  // けっか画面に入ったら お祝い演出
  const [resultCelebrate, setResultCelebrate] = useState(false)
  useEffect(() => {
    // 採点できなかった画面では祝わない(0 点を捏造しない方針と矛盾させない)
    if (screen !== "result" || sessionFailure) {
      setResultCelebrate(false)
      return
    }
    setResultCelebrate(true)
    const timer = setTimeout(() => setResultCelebrate(false), 1100)
    return () => clearTimeout(timer)
  }, [screen, sessionFailure])

  // ----- 画面記述 -----

  const remaining = Math.max(0, hazards.length - foundIds.length)

  let title: string | undefined
  let onBack: (() => void) | undefined
  let headerRight: ReactNode
  let progress: { current: number; total: number } | undefined
  let content: ReactNode

  if (screen === "home") {
    content = (
      <HomeScreen
        onStart={() => {
          resetAll()
          navigate("select")
        }}
        onOpenRecords={() => navigate("records")}
        onExit={() => router.push("/landing")}
        onReplayGuide={() => setShowOnboarding(true)}
      />
    )
  } else if (screen === "select") {
    title = "しゃしんを えらぶ"
    onBack = () => navigate("home")
    content = <SelectScreen onPick={handleFileChange} thumbnail={file} />
  } else if (screen === "mask" && file) {
    title = "プライバシー かくにん"
    onBack = () => navigate("select")
    content = (
      <MaskConfirm
        file={file}
        onConfirm={(dataUrl, count) => {
          setMaskedUrl(dataUrl)
          setMaskedCount(count)
          navigate("pin")
        }}
        onCancel={() => navigate("select")}
      />
    )
  } else if (screen === "pin") {
    title = "ばしょを えらぶ"
    onBack = () => navigate("mask")
    content = (
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col px-3 pb-3">
        <LocationPinPicker
          initial={pin ?? loadLastPin(userId) ?? undefined}
          autoLocate={photoSource === "camera" && !pin}
          onConfirm={(confirmed) => {
            setPin(confirmed)
            saveLastPin(userId, confirmed)
            navigate("consent")
          }}
        />
      </div>
    )
  } else if (screen === "consent") {
    title = "AIに そうだんする まえに"
    onBack = () => navigate("pin")
    content = (
      <ConsentScreen
        error={error}
        disabled={busy || !maskedUrl || !pin}
        maskedUrl={maskedUrl}
        maskedCount={maskedCount}
        saveConsent={saveConsent}
        onSaveConsentChange={setSaveConsent}
        onConfirm={() => {
          if (maskedUrl && pin) void runAnalyze(pin, maskedUrl, saveConsent)
        }}
      />
    )
  } else if (screen === "analyzing") {
    title = "AIと いっしょに かくにん中"
    content = <AnalyzingScreen imageUrl={maskedUrl} onCancel={cancelAnalyze} />
  } else if (screen === "mode") {
    title = "あそびかたを えらぶ"
    onBack = () => navigate("home")
    content = (
      <ModeSelectScreen
        accident={accident}
        canQuiz={quizItems.length > 0}
        analysisMode={analysisMode}
        noHazardFollow={noHazardFollow}
        safeCount={safePoints.length}
        saveNotice={saveNotice}
        onExplore={() => {
          setMode("explore")
          resetPlay()
          navigate("explore")
        }}
        onQuiz={() => {
          setMode("quiz")
          navigate("quiz")
        }}
        onSafeHunt={() => navigate("safe")}
      />
    )
  } else if (screen === "quiz" && maskedUrl) {
    title = "クイズモード"
    onBack = () => navigate("mode")
    content = (
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col px-4 pb-4 pt-1">
        <HunterQuizPanel
          items={quizItems}
          imageUrl={maskedUrl}
          onComplete={(answers) => void finishQuizSession(answers)}
        />
      </div>
    )
  } else if (screen === "safe" && maskedUrl) {
    title = "あんぜん さがし"
    onBack = () => navigate("mode")
    content = (
      <SafeHuntCanvas
        imageUrl={maskedUrl}
        safePoints={safePoints}
        onDone={() => navigate("mode")}
      />
    )
  } else if (screen === "explore" && maskedUrl) {
    title = "きけんを さがせ！"
    // クイズ/あんぜんさがし と同じく モード選択へ戻す(解析結果を捨てない)
    onBack = () => navigate("mode")
    progress = { current: foundIds.length, total: hazards.length }
    content = (
      <ExploreScreen
        accident={accident}
        maskedUrl={maskedUrl}
        hazards={hazards}
        foundIds={foundIds}
        lastTap={lastTap}
        lastOutcome={lastOutcome}
        busy={busy}
        remaining={remaining}
        onTap={handleTap}
        safeCount={safePoints.length}
        onSafeHunt={() => navigate("safe")}
        onFinish={() => void finishSession(taps)}
      />
    )
  } else if (screen === "result" && sessionFailure) {
    title = mode === "quiz" ? "クイズの けっか" : "たんけんの けっか"
    onBack = () => navigate("mode")
    content = (
      <SessionFailureScreen
        failure={sessionFailure}
        foundCount={mode === "quiz" ? null : foundIds.length}
        canReanalyze={Boolean(replayPhotoId || (pin && maskedUrl?.startsWith("data:")))}
        onRetryScoring={() => navigate(mode === "quiz" ? "quiz" : "explore")}
        onReanalyze={() => {
          // きろく再プレイ中は AI を呼ばず、きろくを取り直して新しい正解鍵をもらう(コスト 0)
          if (replayPhotoId) void startFromRecord(replayPhotoId)
          else if (maskedUrl?.startsWith("data:") && pin) void runAnalyze(pin, maskedUrl, false)
        }}
        onHome={() => {
          resetAll()
          navigate("home")
        }}
      />
    )
  } else if (screen === "result" && result) {
    title = mode === "quiz" ? "クイズの けっか" : "たんけんの けっか"
    const canOtherModes = quizItems.length > 0 || safePoints.length > 0
    content = (
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <ResultCard
          score={result.score}
          matches={result.matches}
          total={result.total}
          comboMax={result.comboMax}
          showCombo={mode === "explore"}
          hazards={hazards}
          foundIds={foundIds}
          pointsAwarded={result.pointsAwarded}
          missionsCompleted={result.missionsCompleted}
          persistError={result.persistError}
          onOtherModes={canOtherModes ? () => navigate("mode") : undefined}
          onOpenRecords={savedPhotoId ? () => navigate("records") : undefined}
          onRetry={() => {
            if (mode === "quiz") {
              setResult(null)
              navigate("quiz")
            } else {
              resetPlay()
              navigate("explore")
            }
          }}
          onNewPhoto={() => {
            resetAll()
            navigate("select")
          }}
        />
      </div>
    )
  } else if (screen === "records") {
    title = "たんけんの きろく"
    onBack = () => navigate("home")
    content = (
      <DangerMapScreen
        onBack={() => navigate("home")}
        onPlayNew={() => {
          resetAll()
          navigate("select")
        }}
        onReplay={startFromRecord}
      />
    )
  } else {
    // フォールバック(状態が壊れたとき)
    title = "きけんハンター"
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        <Mascot size="md" mood="think" />
        <p className="text-[15px] font-bold" style={{ color: C.inkSoft }}>
          まいごに なっちゃった…
        </p>
        <div className="w-full max-w-xs">
          <PrimaryCTA
            onClick={() => {
              resetAll()
              navigate("home")
            }}
          >
            ホームに もどる
          </PrimaryCTA>
        </div>
      </div>
    )
  }

  const variants = screenVariants(Boolean(reduce))

  // オンボーディング表示中はゲーム画面のかわりに絵本を出す
  if (showOnboarding) {
    return (
      <HunterShell>
        <Onboarding
          onDone={() => {
            markOnboardingSeen()
            setShowOnboarding(false)
          }}
          onSkip={() => {
            markOnboardingSeen()
            setShowOnboarding(false)
          }}
        />
      </HunterShell>
    )
  }

  return (
    <>
      <HunterShell
        title={title}
        onBack={onBack}
        headerRight={headerRight}
        progress={progress}
        onExit={() => router.push("/landing")}
      >
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={screen}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.18 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-full flex-col"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </HunterShell>

      {/* 発見・達成のお祝い演出(装飾オーバーレイ) */}
      <Celebrate
        show={celebratePoints !== null || resultCelebrate}
        points={celebratePoints ?? undefined}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * ふりがな helper
 * ------------------------------------------------------------------ */

function R({ k, y }: { k: string; y: string }) {
  return (
    <ruby className="leading-none">
      {k}
      <rt className="text-[0.5em] font-bold">{y}</rt>
    </ruby>
  )
}

/* ------------------------------------------------------------------ *
 * home — たんけんノートの表紙
 * ------------------------------------------------------------------ */

function HomeScreen({
  onStart,
  onOpenRecords,
  onExit,
  onReplayGuide,
}: {
  onStart: () => void
  onOpenRecords: () => void
  onExit: () => void
  onReplayGuide: () => void
}) {
  const reduce = useReducedMotion()
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay },
        }

  return (
    <div className="relative flex min-h-full flex-col px-5 pb-5 pt-[max(env(safe-area-inset-top),14px)]">
      {/* 上部ユーティリティ */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 bg-white px-3.5 text-[13px] font-black active:translate-y-[2px] transition-transform ${tokens.cls.focus}`}
          style={{
            color: C.inkSoft,
            borderColor: "rgba(67,57,43,.12)",
            boxShadow: tokens.shadow.pressPaper,
          }}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          ホーム
        </button>
        <button
          type="button"
          onClick={onReplayGuide}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 bg-white px-3.5 text-[13px] font-black active:translate-y-[2px] transition-transform ${tokens.cls.focus}`}
          style={{
            color: C.inkSoft,
            borderColor: "rgba(67,57,43,.12)",
            boxShadow: tokens.shadow.pressPaper,
          }}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          あそびかた
        </button>
      </div>

      {/* 中央ブロック: 表紙〜CTAを光学中央に寄せる(縦の間のびを防ぐ) */}
      <div className="flex flex-1 flex-col justify-center">
      {/* 表紙イラスト(貼った写真) */}
      <motion.div {...rise(0.02)} className="mx-auto mt-4 w-full max-w-[400px]">
        <PhotoFrame tilt={-1.2}>
          <div className="relative aspect-[16/10] w-full">
            <Image
              src="/images/hunter/onboarding-1.png"
              alt="親子とルペが まちへ たんけんに でかける絵"
              fill
              sizes="(max-width: 480px) 92vw, 400px"
              priority
              className="object-cover"
              draggable={false}
            />
          </div>
        </PhotoFrame>
      </motion.div>

      {/* タイトル */}
      <motion.div {...rise(0.08)} className="mt-5 text-center">
        <div className="relative inline-block">
          {/* 黄色いマーカーの下塗り */}
          <span
            aria-hidden="true"
            className="absolute inset-x-[-6px] bottom-[2px] h-[38%] -rotate-[0.5deg] rounded-[6px]"
            style={{ background: C.sun, opacity: 0.55 }}
          />
          <h1
            className="relative text-[34px] font-black leading-none tracking-wide"
            style={{ color: C.ink }}
          >
            きけんハンター
          </h1>
        </div>
        <p
          className="mx-auto mt-3 max-w-[300px] text-[14.5px] font-bold leading-relaxed"
          style={{ color: C.inkSoft, wordBreak: "keep-all", overflowWrap: "anywhere" }}
        >
          <R k="通学路" y="つうがくろ" />の しゃしんから、あぶないところを{" "}
          <R k="自分" y="じぶん" />の <R k="目" y="め" />で 見つける ぼうけんだ！
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div {...rise(0.14)} className="mx-auto mt-6 flex w-full max-w-[360px] flex-col gap-3">
        <PrimaryCTA onClick={onStart}>
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          ぼうけんスタート
        </PrimaryCTA>
        <PrimaryCTA variant="paper" size="md" onClick={onOpenRecords}>
          <MapIcon className="h-5 w-5" aria-hidden="true" />
          きろく・きけんマップ
        </PrimaryCTA>
      </motion.div>
      </div>

      {/* あそびかた 3ステップ(常時表示・コンパクト) */}
      <motion.div
        {...rise(0.2)}
        className="mx-auto mt-auto w-full max-w-[400px] pt-8"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
      >
        <div className="flex items-start justify-center gap-0.5">
          {[
            { icon: <Camera className="h-5 w-5" aria-hidden="true" />, label: "しゃしんを とる" },
            { icon: <Search className="h-5 w-5" aria-hidden="true" />, label: "きけんを さがす" },
            { icon: <Lightbulb className="h-5 w-5" aria-hidden="true" />, label: "きをつけて あるく" },
          ].map((step, i) => (
            <div key={i} className="flex items-start">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-0.5 mt-3 block h-[2px] w-5 rounded-full sm:w-7"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, rgba(67,57,43,.3) 0 3px, transparent 3px 8px)",
                  }}
                />
              )}
              <div className="flex w-[104px] flex-col items-center gap-1.5 text-center">
                <span
                  className="grid h-11 w-11 place-items-center rounded-full border-2 bg-white"
                  style={{
                    color: C.primary,
                    borderColor: "rgba(67,57,43,.1)",
                    boxShadow: tokens.shadow.soft,
                  }}
                >
                  {step.icon}
                </span>
                <span
                  className="whitespace-nowrap text-[11px] font-black leading-tight"
                  style={{ color: C.inkSoft }}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * select — どこを しらべる？
 * ------------------------------------------------------------------ */

function PhotoChoice({
  htmlFor,
  icon,
  label,
  sub,
  onChange,
  capture,
  tone,
}: {
  htmlFor: string
  icon: ReactNode
  label: string
  sub: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  capture?: "environment"
  tone: "green" | "sun"
}) {
  return (
    <>
      <input
        id={htmlFor}
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        aria-label={label}
        onChange={onChange}
      />
      <label
        htmlFor={htmlFor}
        className={`flex min-h-[128px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 bg-white px-3 py-4 text-center transition-transform active:translate-y-[3px] ${tokens.cls.focus}`}
        style={{
          borderColor: "rgba(67,57,43,.12)",
          boxShadow: tone === "green" ? tokens.shadow.pressGreen : tokens.shadow.pressSun,
        }}
      >
        <span
          aria-hidden="true"
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{
            background: tone === "green" ? C.primarySoft : C.sunSoft,
            color: tone === "green" ? C.primaryStrong : C.sunDeep,
          }}
        >
          {icon}
        </span>
        <span className="text-[15px] font-black leading-tight" style={{ color: C.ink }}>
          {label}
        </span>
        <span className="text-[11.5px] font-bold leading-tight" style={{ color: C.inkSoft }}>
          {sub}
        </span>
      </label>
    </>
  )
}

function SelectScreen({
  onPick,
  thumbnail,
}: {
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void
  thumbnail: File | null
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 pb-10 pt-2">
      <SpeechBubble mood="happy">
        どこを しらべる？ <R k="通学路" y="つうがくろ" />や こうえんの みちが おすすめだよ！
      </SpeechBubble>

      <div className="flex gap-3">
        <PhotoChoice
          htmlFor="hunter-photo-camera"
          icon={<Camera className="h-7 w-7" />}
          label="カメラで とる"
          sub="いま この ばしょを"
          onChange={onPick}
          capture="environment"
          tone="green"
        />
        <PhotoChoice
          htmlFor="hunter-photo-album"
          icon={<Images className="h-7 w-7" />}
          label="アルバムから"
          sub="とっておいた 1まいを"
          onChange={onPick}
          tone="sun"
        />
      </div>

      {thumbnail && (
        <p className="text-[12.5px] font-bold" style={{ color: C.inkSoft }}>
          えらんだ しゃしん: {thumbnail.name}
        </p>
      )}

      <PaperPanel tone="sun" className="px-4 py-3.5">
        <p className="flex items-start gap-2.5 text-[13.5px] font-bold leading-relaxed" style={{ color: C.ink }}>
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
            style={{ background: C.sun, color: C.ink }}
          >
            <Eye className="h-4 w-4" strokeWidth={2.6} />
          </span>
          <span>
            かお・なまえ・<R k="学校名" y="がっこうめい" />・おうちの
            <R k="入口" y="いりぐち" />・くるまの ナンバーが うつっていない しゃしんだと あんしんだよ。
          </span>
        </p>
      </PaperPanel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * consent — AIに そうだんする まえに
 * ------------------------------------------------------------------ */

function ConsentScreen({
  error,
  disabled,
  maskedUrl,
  maskedCount,
  saveConsent,
  onSaveConsentChange,
  onConfirm,
}: {
  error: string | null
  disabled: boolean
  maskedUrl: string | null
  maskedCount: number
  saveConsent: boolean
  onSaveConsentChange: (next: boolean) => void
  onConfirm: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-2">
      <div className="flex flex-1 flex-col gap-4">
        {/* おくる写真の見える化(信頼) */}
        {maskedUrl ? (
          <div className="mx-auto w-full max-w-[300px]">
            <PhotoFrame tilt={1}>
              <div className="relative aspect-[4/3] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={maskedUrl}
                  alt="AIに おくる、ぼかした しゃしん"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              </div>
            </PhotoFrame>
            <p className="mt-2 text-center text-[12px] font-bold" style={{ color: C.inkSoft }}>
              {maskedCount > 0
                ? `↑ この「ぼかした しゃしん」だけを おくるよ（ぼかし ${maskedCount}こ）`
                : "↑ この しゃしんを おくるよ（ぼかしは していないよ）"}
            </p>
          </div>
        ) : null}

        <PaperPanel className="px-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
              style={{ background: C.primarySoft, color: C.primaryStrong }}
              aria-hidden="true"
            >
              <Lock className="h-5 w-5" />
            </span>
            <p className="text-[14.5px] font-bold leading-relaxed" style={{ color: C.ink }}>
              AIと いっしょに、あぶないところを さがすよ。おうちの
              <R k="人" y="ひと" />と かくにんしてから すすんでね。
            </p>
          </div>
        </PaperPanel>

        {/* 保存同意(任意・既定オフ) */}
        <button
          type="button"
          role="switch"
          aria-checked={saveConsent}
          onClick={() => onSaveConsentChange(!saveConsent)}
          className={`flex items-center gap-3 rounded-[20px] border-2 bg-white px-4 py-3.5 text-left transition-colors ${tokens.cls.focus}`}
          style={{
            borderColor: saveConsent ? C.primary : "rgba(67,57,43,.12)",
            boxShadow: tokens.shadow.soft,
          }}
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors"
            style={{
              background: saveConsent ? C.primary : "rgba(67,57,43,.08)",
              color: saveConsent ? "#fff" : C.inkFaint,
            }}
          >
            {saveConsent ? <Check className="h-5 w-5" strokeWidth={3} /> : <MapIcon className="h-5 w-5" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14.5px] font-black" style={{ color: C.ink }}>
              きろくに のこす
            </span>
            <span className="text-[12px] font-bold leading-snug" style={{ color: C.inkSoft }}>
              あとで <R k="危険" y="きけん" />マップで 見られて、もういちど あそべるよ。90<R k="日" y="にち" />で じどうで きえるよ。なくても OK
            </span>
          </span>
          {/* トグルの見た目(表示専用) */}
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
            style={{ background: saveConsent ? C.primary : "rgba(67,57,43,.16)" }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: saveConsent ? 24 : 4, boxShadow: tokens.shadow.soft }}
            />
          </span>
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-[14px] px-4 py-3 text-[13.5px] font-black"
            style={{ background: C.dangerSoft, color: C.danger }}
          >
            {error}
          </p>
        )}
      </div>

      <BottomBar className="-mx-5 px-5">
        <PrimaryCTA variant="green" disabled={disabled} onClick={onConfirm}>
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          OK！はじめる
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * analyzing — まちのようすを AIと よみとく(長い待ちを物語に)
 * ------------------------------------------------------------------ */

/** 経過時間 → ルペのひとこと(20〜120秒の待ちを不安にさせない)。 */
const ANALYZE_STAGES: ReadonlyArray<{ until: number; text: string; mood: "think" | "happy" | "cheer" }> = [
  { until: 8, text: "しゃしんを ノートに ひろげたよ…", mood: "think" },
  { until: 20, text: "みちの かたちを 見ているよ…", mood: "think" },
  { until: 38, text: "くるまや じてんしゃの うごきを そうぞうちゅう…", mood: "think" },
  { until: 60, text: "だいじな ポイントを まとめているよ！", mood: "happy" },
  { until: 90, text: "もう すこしだよ！ じっくり かんがえちゅう…", mood: "cheer" },
  { until: Infinity, text: "むずかしい しゃしんみたい。がんばって よんでいるよ…", mood: "think" },
]

const ANALYZE_TIPS: readonly string[] = [
  "みちを わたるときは「みぎ・ひだり・もういちど みぎ」だよ",
  "くるまの かげからは きゅうに 人が 見えないんだって",
  "カーブミラーは「見えない ところ」を うつして くれるよ",
  "よるは はんしゃざいが あると ピカッと ひかって あんしん",
  "こうじの ちかくは、みちの はんたいがわを あるこう",
]

function AnalyzingScreen({
  imageUrl,
  onCancel,
}: {
  imageUrl: string | null
  onCancel?: () => void
}) {
  const reduce = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % ANALYZE_TIPS.length), 7000)
    return () => clearInterval(timer)
  }, [])

  const stage = ANALYZE_STAGES.find((s) => elapsed < s.until) ?? ANALYZE_STAGES[0]

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-8 pt-3">
      {/* しゃしん + 虫めがねスイープ */}
      <div className="relative w-full max-w-[360px]">
        <PhotoFrame>
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="しらべている しゃしん"
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            ) : null}

            {/* あたたかい光のスポットが 8の字に めぐる */}
            {!reduce && (
              <motion.div
                aria-hidden="true"
                className="absolute h-28 w-28 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,201,62,.4) 0%, rgba(255,201,62,.12) 55%, transparent 72%)",
                  filter: "blur(2px)",
                }}
                animate={{
                  left: ["8%", "55%", "30%", "60%", "8%"],
                  top: ["12%", "8%", "45%", "50%", "12%"],
                }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* 走査ライン */}
            {!reduce && (
              <motion.div
                aria-hidden="true"
                className="absolute inset-x-0 h-10"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(21,158,114,0) 0%, rgba(21,158,114,.30) 50%, rgba(21,158,114,0) 100%)",
                }}
                initial={{ top: "-12%" }}
                animate={{ top: ["-12%", "104%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        </PhotoFrame>

        {/* 虫めがねルペが写真のふちで見ている */}
        <motion.div
          aria-hidden="true"
          className="absolute -right-3 -bottom-4"
          animate={reduce ? undefined : { rotate: [0, -6, 4, 0], y: [0, -3, 0] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Mascot size="md" mood={stage.mood} />
        </motion.div>
      </div>

      {/* ルペのひとこと(段階つき) */}
      <div className="mt-6 min-h-[54px] w-full max-w-[360px] text-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={stage.text}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.26 }}
            className="text-[16.5px] font-black leading-relaxed"
            style={{ color: C.ink }}
          >
            {stage.text}
          </motion.p>
        </AnimatePresence>
        {/* 進行ドット */}
        {!reduce && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: C.primary }}
                animate={{ opacity: [0.25, 1, 0.25], scale: [1, 1.25, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 豆ちしきカルーセル */}
      <div className="mt-8 w-full max-w-[360px]">
        <PaperPanel tone="sun" className="px-4 py-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-black" style={{ color: C.sunDeep }}>
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            まちの豆ちしき
          </p>
          <div className="min-h-[42px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={tipIndex}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                transition={{ duration: 0.28 }}
                className="text-[13.5px] font-bold leading-relaxed"
                style={{ color: C.ink }}
              >
                {ANALYZE_TIPS[tipIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </PaperPanel>
      </div>

      {/* 長い待ちでも逃げ道を用意する(中断) */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={`mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border-2 bg-white/70 px-6 text-[13px] font-black active:translate-y-[2px] transition-transform ${tokens.cls.focus}`}
          style={{ color: C.inkSoft, borderColor: "rgba(67,57,43,.14)" }}
        >
          やめて もどる
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * mode select — あそびかたを えらぶ
 * ------------------------------------------------------------------ */

function ModeCard({
  icon,
  title,
  desc,
  eyebrow,
  onClick,
  tone,
}: {
  icon: ReactNode
  title: string
  desc: string
  eyebrow?: string
  onClick: () => void
  tone: "green" | "sun" | "accent"
}) {
  // 白文字の説明文が読めるよう、緑/オレンジは濃いめの面にする(コントラスト確保)
  const bg = tone === "green" ? C.primaryStrong : tone === "sun" ? C.sun : C.accentStrong
  const fg = tone === "sun" ? C.ink : "#FFFFFF"
  const press =
    tone === "green"
      ? "0 4px 0 #075C3F"
      : tone === "sun"
        ? tokens.shadow.pressSun
        : "0 4px 0 #A44E06"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full touch-manipulation items-center gap-3.5 rounded-[22px] px-4 py-4 text-left transition-transform active:translate-y-[4px] active:!shadow-none ${tokens.cls.focus}`}
      style={{ background: bg, color: fg, boxShadow: press }}
    >
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
        style={{ background: "rgba(255,255,255,.28)" }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {eyebrow ? (
          <span className="flex items-center gap-1 text-[10.5px] font-black leading-tight opacity-90">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {eyebrow}
          </span>
        ) : null}
        <span className="text-[17px] font-black leading-tight">{title}</span>
        <span className="text-[13px] font-bold leading-snug">{desc}</span>
      </span>
    </button>
  )
}

function ModeSelectScreen({
  accident,
  canQuiz,
  analysisMode,
  noHazardFollow,
  safeCount,
  saveNotice,
  onExplore,
  onQuiz,
  onSafeHunt,
}: {
  accident: HunterAccidentSummary | null
  canQuiz: boolean
  analysisMode: HunterAnalysisMode
  noHazardFollow: string | null
  safeCount: number
  saveNotice: SaveNotice
  onExplore: () => void
  onQuiz: () => void
  onSafeHunt: () => void
}) {
  const isGuide = analysisMode === "guide"
  const modeCards: Array<{
    mode: HunterDailyMode
    icon: ReactNode
    title: string
    desc: string
    onClick: () => void
    tone: "green" | "sun" | "accent"
  }> = []
  if (!isGuide) {
    modeCards.push({
      mode: "explore",
      icon: <Search className="h-6 w-6" strokeWidth={2.6} />,
      title: "たんけんモード",
      desc: "じぶんの目で あぶないところを さがす",
      onClick: onExplore,
      tone: "green",
    })
  }
  if (canQuiz) {
    modeCards.push({
      mode: "quiz",
      icon: <Lightbulb className="h-6 w-6" strokeWidth={2.6} />,
      title: "クイズモード",
      desc: "あんぜんな あるきかたを クイズで まなぶ",
      onClick: onQuiz,
      tone: "sun",
    })
  }
  if (safeCount > 0) {
    modeCards.push({
      mode: "safe",
      icon: <ShieldCheck className="h-6 w-6" strokeWidth={2.6} />,
      title: "あんぜん さがし",
      desc: "この みちの「あんしんの くふう」を さがす",
      onClick: onSafeHunt,
      tone: "accent",
    })
  }
  const dailyMission = pickDailyMission(new Date(), modeCards.map((card) => card.mode))
  const orderedCards = dailyMission
    ? [...modeCards].sort(
        (a, b) =>
          Number(b.mode === dailyMission.mode) - Number(a.mode === dailyMission.mode),
      )
    : modeCards

  return (
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2">
      <SpeechBubble mood={isGuide ? "happy" : "cheer"}>
        {isGuide
          ? "この しゃしんでは あぶないところは 見つからなかったよ。クイズや あんぜんさがしで れんしゅうしよう！"
          : dailyMission
            ? `きょうの 3分ミッションは「${dailyMission.title}」。${dailyMission.detail}`
            : "じゅんび かんりょう！ どの あそびかたに する？"}
      </SpeechBubble>

      {/* 保存の控えめな通知 */}
      <AnimatePresence>
        {saveNotice && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="rounded-[14px] px-4 py-2.5 text-[12.5px] font-black"
            style={{
              background: saveNotice === "error" ? C.dangerSoft : saveNotice === "skipped" ? C.sunSoft : C.primarySoft,
              color: saveNotice === "error" ? C.danger : saveNotice === "skipped" ? C.ink : C.primaryStrong,
            }}
          >
            {saveNotice === "ok"
              ? "きろくに のこしたよ！あとで 危険マップで 見られるよ"
              : saveNotice === "skipped"
                ? "こんかいは あぶないところが なかったので、きろくには のこさなかったよ"
                : "きろくの ほぞんに しっぱいしたよ(あそびは そのまま できるよ)"}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ガイドモード: 肯定フォロー(豆知識) */}
      {isGuide && noHazardFollow ? (
        <PaperPanel tone="sun" className="px-4 py-3.5">
          <p className="flex items-start gap-2.5 text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.sunDeep }} aria-hidden="true" />
            <span>
              <R k="豆知識" y="まめちしき" />
              ：{noHazardFollow}
            </span>
          </p>
        </PaperPanel>
      ) : null}

      {accident && <CareCard accident={accident} />}

      <div className="flex flex-col gap-3">
        {orderedCards.map((card) => (
          <ModeCard
            key={card.mode}
            icon={card.icon}
            title={card.title}
            desc={card.desc}
            eyebrow={card.mode === dailyMission?.mode ? "きょうの おすすめ・3分" : undefined}
            onClick={card.onClick}
            tone={card.tone}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * explore — たんけんモード(写真が主役)
 * ------------------------------------------------------------------ */

export function ExploreScreen({
  accident,
  maskedUrl,
  hazards,
  foundIds,
  lastTap,
  lastOutcome,
  busy,
  remaining,
  onTap,
  onFinish,
  safeCount = 0,
  onSafeHunt,
}: {
  accident: HunterAccidentSummary | null
  maskedUrl: string
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  lastTap: { x: number; y: number } | null
  lastOutcome: HunterTapOutcome | null
  busy: boolean
  remaining: number
  onTap: (tap: HunterTap) => void
  onFinish: () => void
  /** 安全の工夫の数。全部見つけたあとに「あんぜんの くふうも さがす」を出す。 */
  safeCount?: number
  onSafeHunt?: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-col px-4 pt-1">
      <div className="flex flex-1 flex-col gap-3">
        {/* 写真が主役。先頭に置く */}
        <ExploreCanvas
          imageUrl={maskedUrl}
          hazards={hazards}
          foundIds={foundIds}
          onTap={onTap}
          lastTap={lastTap}
          lastOutcome={lastOutcome}
        />

        {/* この地点の「気をつけて」情報(コンパクト) */}
        {accident && <CareCard accident={accident} compact />}
      </div>

      <BottomBar className="-mx-4 px-4">
        <div className="flex flex-col gap-2">
          <PrimaryCTA disabled={busy} variant={remaining > 0 ? "green" : "sun"} onClick={onFinish}>
            {busy ? (
              "まとめているよ…"
            ) : remaining > 0 ? (
              <>けっかを みる（のこり {remaining}）</>
            ) : (
              "ぜんぶ みつけた！けっかを みる"
            )}
          </PrimaryCTA>
          {remaining === 0 && safeCount > 0 && onSafeHunt ? (
            <PrimaryCTA size="md" variant="paper" disabled={busy} onClick={onSafeHunt}>
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              あんぜんの くふうも さがす（{safeCount}）
            </PrimaryCTA>
          ) : null}
        </div>
      </BottomBar>
    </div>
  )
}
