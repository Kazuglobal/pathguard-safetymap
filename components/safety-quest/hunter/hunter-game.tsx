"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  Camera,
  Check,
  Home,
  Images,
  Lightbulb,
  Lock,
  Map as MapIcon,
  Save,
  Search,
  Sparkles,
} from "lucide-react"

import { judgeTap } from "@/lib/hunter/scoring"
import { buildQuizItems } from "@/lib/hunter/quiz"
import type {
  HunterAccidentSummary,
  HunterHazard,
  HunterQuizAnswer,
  HunterTap,
  HunterTapOutcome,
} from "@/lib/hunter/types"

import { CareCard } from "./care-card"
import { DangerMapScreen } from "./danger-map-screen"
import { ExploreCanvas } from "./explore-canvas"
import { LocationPinPicker } from "./location-pin-picker"
import { MaskConfirm } from "./mask-confirm"
import { HunterQuizPanel } from "./quiz-panel"
import { ResultCard } from "./result-card"
import {
  Celebrate,
  HunterShell,
  Mascot,
  PrimaryCTA,
  StatPill,
  tokens,
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
  | "result"
  | "records"

type PlayMode = "explore" | "quiz"

interface Pin {
  latitude: number
  longitude: number
}

interface SessionResult {
  score: number
  matches: number
  total: number
  comboMax: number
}

const C = tokens.color

export function HunterGame() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>("home")
  const [file, setFile] = useState<File | null>(null)
  const [maskedUrl, setMaskedUrl] = useState<string | null>(null)
  const [pin, setPin] = useState<Pin | null>(null)
  const [hazards, setHazards] = useState<readonly HunterHazard[]>([])
  const [accident, setAccident] = useState<HunterAccidentSummary | null>(null)
  const [foundIds, setFoundIds] = useState<string[]>([])
  const [taps, setTaps] = useState<HunterTap[]>([])
  const [lastOutcome, setLastOutcome] = useState<HunterTapOutcome | null>(null)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [celebratePoints, setCelebratePoints] = useState<number | null>(null)
  const [mode, setMode] = useState<PlayMode>("explore")
  // 「のこす(きろく保存)」の同意。第三者AI送信の同意とは別物。既定オフ。
  const [saveConsent, setSaveConsent] = useState(false)
  // 保存結果の控えめな通知（成功/失敗）。ゲームは止めない。
  const [saveNotice, setSaveNotice] = useState<"ok" | "error" | null>(null)

  const reduce = useReducedMotion()
  const foundSet = useMemo(() => new Set(foundIds), [foundIds])
  const quizItems = useMemo(
    () => (accident ? buildQuizItems(hazards, accident) : []),
    [hazards, accident],
  )

  const resetPlay = useCallback(() => {
    setFoundIds([])
    setTaps([])
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
    setError(null)
  }, [resetPlay])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setScreen("mask")
  }

  const runAnalyze = useCallback(
    async (confirmedPin: Pin, image: string, save: boolean) => {
      setBusy(true)
      setError(null)
      setSaveNotice(null)
      setScreen("analyzing")
      try {
        const response = await fetch("/api/hunter/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          setScreen("consent")
          return
        }
        setHazards(body.hazards ?? [])
        setAccident(body.accident ?? null)
        // 保存をたのんだときだけ、結果の控えめな通知を出す（ゲームは止めない）。
        if (save) {
          setSaveNotice(body.savedError ? "error" : "ok")
        }
        resetPlay()
        setScreen("mode")
      } catch {
        setError("つうしんエラーが おきました。もう一度ためしてね。")
        setScreen("consent")
      } finally {
        setBusy(false)
      }
    },
    [resetPlay],
  )

  const handleTap = (tap: HunterTap) => {
    // 「決め手のタップ」を含めて確定させる: setTaps は非同期なので、
    // 自動終了時は nextTaps を直接 finishSession へ渡す（stale closure 回避）。
    const nextTaps = [...taps, tap]
    setTaps(nextTaps)
    const outcome = judgeTap(tap, hazards, foundSet)
    setLastOutcome(outcome)
    if (outcome.result === "hit" && outcome.hazardId) {
      const nextFound = [...foundIds, outcome.hazardId]
      setFoundIds(nextFound)
      if (nextFound.length >= hazards.length) {
        void finishSession(nextTaps, nextFound)
      }
    }
  }

  const finishSession = useCallback(
    async (sessionTaps: HunterTap[], _foundIds: string[]) => {
      setBusy(true)
      try {
        const response = await fetch("/api/hunter/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "explore", hazards, taps: sessionTaps }),
        })
        const body = await response.json().catch(() => null)
        if (response.ok && body) {
          setResult({
            score: body.score ?? 0,
            matches: body.matches ?? 0,
            total: body.total ?? hazards.length,
            comboMax: body.comboMax ?? 0,
          })
        } else {
          setResult({ score: 0, matches: _foundIds.length, total: hazards.length, comboMax: 0 })
        }
      } catch {
        setResult({ score: 0, matches: _foundIds.length, total: hazards.length, comboMax: 0 })
      } finally {
        setBusy(false)
        setScreen("result")
      }
    },
    [hazards],
  )

  const finishQuizSession = useCallback(
    async (answers: HunterQuizAnswer[]) => {
      setBusy(true)
      try {
        const response = await fetch("/api/hunter/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "quiz", hazards, accident, answers }),
        })
        const body = await response.json().catch(() => null)
        if (response.ok && body) {
          setResult({
            score: body.score ?? 0,
            matches: body.correct ?? 0,
            total: body.total ?? quizItems.length,
            comboMax: 0,
          })
        } else {
          setResult({ score: 0, matches: 0, total: quizItems.length, comboMax: 0 })
        }
      } catch {
        setResult({ score: 0, matches: 0, total: quizItems.length, comboMax: 0 })
      } finally {
        setBusy(false)
        setScreen("result")
      }
    },
    [hazards, accident, quizItems],
  )

  // 発見（hit）時に お祝い演出を出す（ハンドラ挙動は変えず lastOutcome を監視）
  useEffect(() => {
    if (lastOutcome?.result !== "hit") return
    setCelebratePoints(lastOutcome.points > 0 ? lastOutcome.points : null)
    const timer = setTimeout(() => setCelebratePoints(null), 900)
    return () => clearTimeout(timer)
  }, [lastOutcome])

  // 保存通知は数秒で自動的に消す（操作の邪魔をしない）
  useEffect(() => {
    if (!saveNotice) return
    const timer = setTimeout(() => setSaveNotice(null), 3600)
    return () => clearTimeout(timer)
  }, [saveNotice])

  // けっか画面に入ったら お祝い演出
  const [resultCelebrate, setResultCelebrate] = useState(false)
  useEffect(() => {
    if (screen !== "result") {
      setResultCelebrate(false)
      return
    }
    setResultCelebrate(true)
    const timer = setTimeout(() => setResultCelebrate(false), 1000)
    return () => clearTimeout(timer)
  }, [screen])

  // ----- 画面記述（タイトル/戻る/HUD/進捗/中身） -----

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
          setScreen("select")
        }}
        onOpenRecords={() => setScreen("records")}
        onExit={() => router.push("/landing")}
      />
    )
  } else if (screen === "select") {
    title = "しゃしんを えらぶ"
    onBack = () => setScreen("home")
    content = <SelectScreen onPick={handleFileChange} thumbnail={file} />
  } else if (screen === "mask" && file) {
    title = "プライバシー かくにん"
    onBack = () => setScreen("select")
    content = (
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-4">
        <MaskConfirm
          file={file}
          onConfirm={(dataUrl) => {
            setMaskedUrl(dataUrl)
            setScreen("pin")
          }}
          onCancel={() => setScreen("select")}
        />
      </div>
    )
  } else if (screen === "pin") {
    title = "ばしょを えらぶ"
    onBack = () => setScreen("mask")
    content = (
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col p-2 sm:p-4">
        <LocationPinPicker
          initial={pin ?? undefined}
          onConfirm={(confirmed) => {
            setPin(confirmed)
            setScreen("consent")
          }}
        />
      </div>
    )
  } else if (screen === "consent") {
    title = "AIに そうだんする まえに"
    onBack = () => setScreen("pin")
    content = (
      <ConsentScreen
        error={error}
        disabled={busy || !maskedUrl || !pin}
        saveConsent={saveConsent}
        onSaveConsentChange={setSaveConsent}
        onConfirm={() => {
          if (maskedUrl && pin) void runAnalyze(pin, maskedUrl, saveConsent)
        }}
      />
    )
  } else if (screen === "analyzing") {
    title = "AIが かくにん中…"
    content = <AnalyzingScreen imageUrl={maskedUrl} />
  } else if (screen === "mode") {
    title = "あそびかたを えらぶ"
    onBack = () => setScreen("home")
    content = (
      <ModeSelectScreen
        accident={accident}
        canQuiz={quizItems.length > 0}
        onExplore={() => {
          setMode("explore")
          resetPlay()
          setScreen("explore")
        }}
        onQuiz={() => {
          setMode("quiz")
          setScreen("quiz")
        }}
      />
    )
  } else if (screen === "quiz" && maskedUrl) {
    title = "クイズモード"
    onBack = () => setScreen("mode")
    content = (
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col p-3 sm:p-4">
        <HunterQuizPanel
          items={quizItems}
          imageUrl={maskedUrl}
          onComplete={(answers) => void finishQuizSession(answers)}
        />
      </div>
    )
  } else if (screen === "explore" && maskedUrl) {
    title = "さがそう！"
    onBack = () => setScreen("home")
    progress = { current: foundIds.length, total: hazards.length }
    headerRight = (
      <StatPill
        icon={<Search className="h-4 w-4" />}
        label="はっけん"
        value={`${foundIds.length}/${hazards.length}`}
        tone="green"
      />
    )
    content = (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto p-4">
        {accident && <CareCard accident={accident} />}
        <ExploreCanvas
          imageUrl={maskedUrl}
          hazards={hazards}
          foundIds={foundIds}
          onTap={handleTap}
          lastOutcome={lastOutcome}
        />
        <div
          className="flex items-center gap-3 rounded-[20px] px-3 py-2.5"
          style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.soft }}
        >
          <Mascot size="sm" mood="cheer" />
          <p className="text-[14px] font-bold leading-snug" style={{ color: C.ink }}>
            きに なるところを 指で タッチしてみよう。
            <br />
            「ここ あぶないかも？」を さがす れんしゅうだよ。
          </p>
        </div>
        <PrimaryCTA
          disabled={busy}
          className={tokens.cls.ctaBlue}
          onClick={() => void finishSession(taps, foundIds)}
        >
          {remaining > 0 ? `けっかを みる（のこり ${remaining}）` : "けっかを みる"}
        </PrimaryCTA>
      </div>
    )
  } else if (screen === "result" && result) {
    title = "けっか"
    content = (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-2 flex flex-col items-center">
          <Mascot size="lg" mood="wow" />
        </div>
        <ResultCard
          score={result.score}
          matches={result.matches}
          total={result.total}
          comboMax={result.comboMax}
          hazards={hazards}
          foundIds={foundIds}
          onRetry={() => {
            if (mode === "quiz") {
              setResult(null)
              setScreen("quiz")
            } else {
              resetPlay()
              setScreen("explore")
            }
          }}
          onNewPhoto={() => {
            resetAll()
            setScreen("select")
          }}
        />
      </div>
    )
  } else if (screen === "records") {
    title = "きろく"
    onBack = () => setScreen("home")
    content = (
      <DangerMapScreen
        onBack={() => setScreen("home")}
        onPlayNew={() => {
          resetAll()
          setScreen("select")
        }}
      />
    )
  } else {
    // フォールバック（状態が壊れたとき）
    title = "きけんハンター"
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        <Mascot size="md" mood="happy" />
        <PrimaryCTA onClick={resetAll}>ホームに もどる</PrimaryCTA>
      </div>
    )
  }

  const enter = reduce
    ? { opacity: 0 }
    : { opacity: 0, x: 24, scale: 0.98 }
  const center = reduce
    ? { opacity: 1 }
    : { opacity: 1, x: 0, scale: 1 }
  const leave = reduce
    ? { opacity: 0 }
    : { opacity: 0, x: -24, scale: 0.98 }

  return (
    <>
      <HunterShell
        title={title}
        onBack={onBack}
        headerRight={headerRight}
        progress={progress}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            className="flex min-h-0 flex-1 flex-col"
            initial={enter}
            animate={center}
            exit={leave}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 18 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </HunterShell>

      {/* 発見・達成のお祝い演出（装飾オーバーレイ） */}
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
 * mode select（あそびかたを えらぶ）
 * ------------------------------------------------------------------ */

function ModeCard({
  icon,
  title,
  desc,
  onClick,
  disabled,
  bg,
}: {
  icon: ReactNode
  title: string
  desc: string
  onClick: () => void
  disabled?: boolean
  bg: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-[24px] px-4 py-4 text-left text-white disabled:opacity-50 ${tokens.cls.focus}`}
      style={{ background: bg, boxShadow: tokens.shadow.card }}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/25">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[18px] font-extrabold">{title}</span>
        <span className="text-[13px] font-bold text-white/90">{desc}</span>
      </span>
    </button>
  )
}

function ModeSelectScreen({
  accident,
  canQuiz,
  onExplore,
  onQuiz,
}: {
  accident: HunterAccidentSummary | null
  canQuiz: boolean
  onExplore: () => void
  onQuiz: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2.5">
        <Mascot size="sm" mood="happy" />
        <h2 className="text-[20px] font-extrabold" style={{ color: C.ink }}>
          どっちで あそぶ？
        </h2>
      </div>

      {accident && <CareCard accident={accident} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ModeCard
          icon={<Search className="h-6 w-6" />}
          title="たんけんモード"
          desc="じぶんで あぶないところを さがそう"
          onClick={onExplore}
          bg={C.primary}
        />
        <ModeCard
          icon={<Lightbulb className="h-6 w-6" />}
          title="クイズモード"
          desc="この あたりの 事故から クイズに こたえよう"
          onClick={onQuiz}
          disabled={!canQuiz}
          bg={C.accent}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * home
 * ------------------------------------------------------------------ */

const HOW_TO: ReadonlyArray<{ icon: ReactNode; text: ReactNode }> = [
  { icon: <Camera className="h-5 w-5" />, text: "しゃしんを えらぶ" },
  { icon: <Search className="h-5 w-5" />, text: "あぶないところを さがす" },
  { icon: <Lightbulb className="h-5 w-5" />, text: "きをつける れんしゅう" },
]

function HomeScreen({
  onStart,
  onOpenRecords,
  onExit,
}: {
  onStart: () => void
  onOpenRecords: () => void
  onExit: () => void
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 py-4 text-center sm:py-6">
      {/* アプリのホームへ戻る動線（全画面化でナビが消えるため） */}
      <button
        type="button"
        onClick={onExit}
        className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold ${tokens.cls.focus}`}
        style={{ color: C.primaryStrong, boxShadow: tokens.shadow.soft }}
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        ホーム
      </button>

      {/* 大画面でも読みやすいよう中央の列幅を一定に保つ */}
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 sm:gap-5">
        {/* 短い画面でもはみ出さないよう、マスコットは画面高に応じて縮小 */}
        <div className="shrink-0 [@media(max-height:680px)]:scale-90 [@media(max-height:600px)]:scale-75">
          <Mascot size="lg" mood="happy" />
        </div>

        <div>
          <h1
            className="text-[26px] font-extrabold tracking-wide sm:text-[28px]"
            style={{ color: C.primaryStrong }}
          >
            きけんハンター
          </h1>
          <p className="mt-1.5 text-[15px] font-bold leading-relaxed sm:text-[16px]" style={{ color: C.ink }}>
            <R k="通学路" y="つうがくろ" />の しゃしんから、
            <br />
            あぶないところを <R k="自分" y="じぶん" />の <R k="目" y="め" />で さがそう！
          </p>
        </div>

        <PrimaryCTA onClick={onStart}>
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          ぼうけんスタート
        </PrimaryCTA>

        <button
          type="button"
          onClick={onOpenRecords}
          className={`inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-extrabold ${tokens.cls.focus}`}
          style={{ color: C.primaryStrong, boxShadow: tokens.shadow.soft }}
        >
          <MapIcon className="h-5 w-5" aria-hidden="true" />
          きろく / <R k="危険" y="きけん" />マップ
        </button>

        {/* あそびかた: 画面が低いときは隠して本体を優先表示 */}
        <div
          className="hidden w-full rounded-[24px] px-4 py-3.5 text-left [@media(min-height:720px)]:block"
          style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.soft }}
        >
        <p className="mb-2 text-[14px] font-extrabold" style={{ color: C.inkSoft }}>
          あそびかた
        </p>
        <ol className="flex flex-col gap-2.5">
          {HOW_TO.map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                style={{ background: C.primary }}
              >
                <span className="text-[15px] font-extrabold">{i + 1}</span>
              </span>
              <span aria-hidden="true" style={{ color: C.primary }}>
                {step.icon}
              </span>
              <span className="text-[15px] font-bold" style={{ color: C.ink }}>
                {step.text}
              </span>
            </li>
          ))}
        </ol>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * select
 * ------------------------------------------------------------------ */

function PhotoChoice({
  htmlFor,
  icon,
  label,
  onChange,
  capture,
}: {
  htmlFor: string
  icon: ReactNode
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  capture?: "environment"
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
        className={`flex min-h-[72px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[24px] bg-white px-4 py-4 text-center ${tokens.cls.focus}`}
        style={{ boxShadow: tokens.shadow.card, color: C.ink }}
      >
        <span aria-hidden="true" style={{ color: C.primary }}>
          {icon}
        </span>
        <span className="text-[16px] font-extrabold">{label}</span>
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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex items-center gap-3">
        <Mascot size="sm" mood="happy" />
        <h2 className="text-[20px] font-extrabold" style={{ color: C.ink }}>
          どこを しらべる？
        </h2>
      </div>

      <div className="flex gap-3">
        <PhotoChoice
          htmlFor="hunter-photo-camera"
          icon={<Camera className="h-8 w-8" />}
          label="カメラで とる"
          onChange={onPick}
          capture="environment"
        />
        <PhotoChoice
          htmlFor="hunter-photo-album"
          icon={<Images className="h-8 w-8" />}
          label="アルバムから えらぶ"
          onChange={onPick}
        />
      </div>

      {thumbnail && (
        <p className="text-[13px] font-bold" style={{ color: C.inkSoft }}>
          えらんだ しゃしん: {thumbnail.name}
        </p>
      )}

      <div
        className="rounded-[24px] px-4 py-3 text-[14px] font-bold leading-relaxed"
        style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.soft, color: C.ink }}
      >
        かお・なまえ・<R k="学校名" y="がっこうめい" />・おうちの<R k="入口" y="いりぐち" />・
        くるまの ナンバーが うつっていない しゃしんを つかってね。
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * consent
 * ------------------------------------------------------------------ */

function ConsentScreen({
  error,
  disabled,
  saveConsent,
  onSaveConsentChange,
  onConfirm,
}: {
  error: string | null
  disabled: boolean
  saveConsent: boolean
  onSaveConsentChange: (next: boolean) => void
  onConfirm: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot size="md" mood="cheer" />
      </div>

      <div
        className="rounded-[24px] px-5 py-5"
        style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.card }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-white"
            style={{ background: C.primary }}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-extrabold" style={{ color: C.ink }}>
            しゃしんは あんぜんに あつかうよ
          </span>
        </div>
        <p className="text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>
          ぼかした しゃしんを AIに おくって、あぶないところを いっしょに さがすよ。
          おうちの<R k="人" y="ひと" />と かくにんしてから すすんでね。
        </p>
      </div>

      {/* 保存同意（任意・既定オフ）。第三者AI送信の同意とは別物。 */}
      <button
        type="button"
        role="switch"
        aria-checked={saveConsent}
        onClick={() => onSaveConsentChange(!saveConsent)}
        className={`flex items-center gap-3 rounded-[24px] px-4 py-4 text-left ${tokens.cls.focus}`}
        style={{
          background: C.surface,
          boxShadow: saveConsent
            ? `0 0 0 3px ${C.success}, ${tokens.shadow.soft}`
            : tokens.shadow.soft,
        }}
      >
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-colors"
          style={{ background: saveConsent ? C.success : "#C7D2DD" }}
        >
          {saveConsent ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-extrabold" style={{ color: C.ink }}>
            この <R k="写真" y="しゃしん" />を のこす（きろくに <R k="保存" y="ほぞん" />）
          </span>
          <span className="text-[13px] font-bold leading-snug" style={{ color: C.inkSoft }}>
            あとで <R k="危険" y="きけん" />マップで <R k="見" y="み" />られるよ。
            おうちの<R k="人" y="ひと" />と かくにんしてね。
          </span>
        </span>
        {/* トグルの見た目（表示専用） */}
        <span
          aria-hidden="true"
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          style={{ background: saveConsent ? C.success : "#C7D2DD" }}
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
          className="rounded-[16px] px-4 py-3 text-[14px] font-extrabold"
          style={{ background: "#FCE8E8", color: C.danger }}
        >
          {error}
        </p>
      )}

      <PrimaryCTA disabled={disabled} onClick={onConfirm}>
        OK！はじめる
      </PrimaryCTA>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * analyzing（楽しいローディング）
 * ------------------------------------------------------------------ */

function AnalyzingScreen({ imageUrl }: { imageUrl: string | null }) {
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
      <Mascot size="lg" mood="think" />

      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[24px] md:max-w-md"
        style={{ aspectRatio: "4 / 3", background: C.headerNavy, boxShadow: tokens.shadow.card }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="しらべている しゃしん"
            className="absolute inset-0 h-full w-full object-contain opacity-90"
            draggable={false}
          />
        ) : null}

        {/* スキャンライン */}
        {!reduce && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-0 h-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(30,136,229,0) 0%, rgba(30,136,229,.35) 50%, rgba(30,136,229,0) 100%)",
            }}
            initial={{ top: "-10%" }}
            animate={{ top: ["-10%", "100%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* 往復する虫めがね */}
        <motion.div
          aria-hidden="true"
          className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full"
          style={{
            background: "rgba(255,255,255,.18)",
            border: `3px solid ${C.warning}`,
            color: "#fff",
          }}
          initial={{ left: "8%" }}
          animate={reduce ? { left: "44%" } : { left: ["8%", "76%", "8%"] }}
          transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Search className="h-6 w-6" />
        </motion.div>
      </div>

      <p className="text-[17px] font-extrabold" style={{ color: C.ink }}>
        いま、いっしょに みているよ
        {!reduce && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            …
          </motion.span>
        )}
      </p>

      <div
        className="w-full max-w-sm rounded-[20px] px-4 py-3 text-left text-[14px] font-bold leading-relaxed md:max-w-md"
        style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.soft, color: C.ink }}
      >
        <span className="mr-1" aria-hidden="true">
          💡
        </span>
        <R k="豆知識" y="まめちしき" />：<R k="横断歩道" y="おうだんほどう" />では、
        わたるまえに <R k="右" y="みぎ" />と <R k="左" y="ひだり" />を よく <R k="見" y="み" />てね。
      </div>
    </div>
  )
}
