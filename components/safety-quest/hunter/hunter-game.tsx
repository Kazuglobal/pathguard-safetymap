"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowLeft, Camera, ShieldCheck, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { judgeTap } from "@/lib/hunter/scoring"
import type {
  HunterAccidentSummary,
  HunterHazard,
  HunterTap,
  HunterTapOutcome,
} from "@/lib/hunter/types"

import { CareCard } from "./care-card"
import { ExploreCanvas } from "./explore-canvas"
import { LocationPinPicker } from "./location-pin-picker"
import { MaskConfirm } from "./mask-confirm"
import { ResultCard } from "./result-card"

type Screen =
  | "home"
  | "select"
  | "mask"
  | "pin"
  | "consent"
  | "analyzing"
  | "explore"
  | "result"

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

export function HunterGame() {
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

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])

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
    async (confirmedPin: Pin, image: string) => {
      setBusy(true)
      setError(null)
      setScreen("analyzing")
      try {
        const response = await fetch("/api/hunter/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: image, pin: confirmedPin, consent: true }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          setError(body?.error ?? "写真の解析にしっぱいしました。")
          setScreen("consent")
          return
        }
        setHazards(body.hazards ?? [])
        setAccident(body.accident ?? null)
        resetPlay()
        setScreen("explore")
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
    setTaps((prev) => [...prev, tap])
    const outcome = judgeTap(tap, hazards, foundSet)
    setLastOutcome(outcome)
    if (outcome.result === "hit" && outcome.hazardId) {
      const nextFound = [...foundIds, outcome.hazardId]
      setFoundIds(nextFound)
      if (nextFound.length >= hazards.length) {
        void finishSession(nextFound)
      }
    }
  }

  const finishSession = useCallback(
    async (_foundIds: string[]) => {
      setBusy(true)
      try {
        const response = await fetch("/api/hunter/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "explore", hazards, taps }),
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
    [hazards, taps],
  )

  // ----- 画面 -----

  if (screen === "home") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-[28px] bg-[#0d66c4] shadow-xl">
            <ShieldCheck className="h-12 w-12 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[#0b2551]">きけんハンター</h1>
            <p className="mt-2 text-sm font-bold text-[#31516f]">
              通学路の写真から、あぶないところを じぶんの目で さがそう！
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-[18px] bg-[#f97316] px-10 py-6 text-lg font-black hover:bg-[#ea580c]"
            onClick={() => {
              resetAll()
              setScreen("select")
            }}
          >
            はじめる
          </Button>
        </div>
      </Shell>
    )
  }

  if (screen === "select") {
    return (
      <Shell title="しゃしんを えらぶ" onBack={() => setScreen("home")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="max-w-sm text-sm font-bold text-[#31516f]">
            顔・名前・学校名・お家の入口・車のナンバーが 写っていない写真を つかってね。
          </p>
          <input
            id="hunter-photo-upload"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="通学路の写真をえらぶ"
            onChange={handleFileChange}
          />
          <label
            htmlFor="hunter-photo-upload"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[18px] bg-[#0d66c4] px-8 py-5 text-lg font-black text-white shadow-lg hover:bg-[#0a55a6]"
          >
            <Camera className="h-6 w-6" aria-hidden />
            写真をえらぶ
          </label>
        </div>
      </Shell>
    )
  }

  if (screen === "mask" && file) {
    return (
      <Shell title="プライバシー かくにん" onBack={() => setScreen("select")}>
        <MaskConfirm
          file={file}
          onConfirm={(dataUrl) => {
            setMaskedUrl(dataUrl)
            setScreen("pin")
          }}
          onCancel={() => setScreen("select")}
        />
      </Shell>
    )
  }

  if (screen === "pin") {
    return (
      <Shell title="ばしょを えらぶ" onBack={() => setScreen("mask")}>
        <LocationPinPicker
          initial={pin ?? undefined}
          onConfirm={(confirmed) => {
            setPin(confirmed)
            setScreen("consent")
          }}
        />
      </Shell>
    )
  }

  if (screen === "consent") {
    return (
      <Shell title="AIに そうだんする まえに" onBack={() => setScreen("pin")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <Sparkles className="h-12 w-12 text-[#f97316]" aria-hidden />
          <p className="max-w-md text-sm font-bold leading-relaxed text-[#31516f]">
            ぼかした写真を AIに おくって、あぶないところを いっしょに さがします。
            <br />
            おうちの人と かくにんしてから すすんでね。
          </p>
          {error && (
            <p role="alert" className="rounded-[14px] bg-[#fee2e2] px-4 py-2 text-sm font-black text-[#b91c1c]">
              {error}
            </p>
          )}
          <Button
            size="lg"
            disabled={busy || !maskedUrl || !pin}
            className="rounded-[18px] bg-[#f97316] px-10 py-6 text-lg font-black hover:bg-[#ea580c]"
            onClick={() => {
              if (maskedUrl && pin) void runAnalyze(pin, maskedUrl)
            }}
          >
            OK！はじめる
          </Button>
        </div>
      </Shell>
    )
  }

  if (screen === "analyzing") {
    return (
      <Shell title="AIが かくにん中…">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-8 border-[#dbeafe] border-t-[#0d66c4]" />
          <p className="text-sm font-black text-[#31516f]">
            写真の あぶないところを さがしているよ…
          </p>
        </div>
      </Shell>
    )
  }

  if (screen === "explore" && maskedUrl) {
    const remaining = hazards.length - foundIds.length
    return (
      <Shell title="あぶないところを さがそう！" onBack={() => setScreen("home")}>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {accident && <CareCard accident={accident} />}
          <ExploreCanvas
            imageUrl={maskedUrl}
            hazards={hazards}
            foundIds={foundIds}
            onTap={handleTap}
            lastOutcome={lastOutcome}
          />
          <Button
            size="lg"
            disabled={busy}
            className="rounded-[18px] bg-[#0d66c4] py-5 text-base font-black hover:bg-[#0a55a6]"
            onClick={() => void finishSession(foundIds)}
          >
            {remaining > 0 ? `けっかを みる（のこり ${remaining}）` : "けっかを みる"}
          </Button>
        </div>
      </Shell>
    )
  }

  if (screen === "result" && result) {
    return (
      <Shell title="けっか">
        <div className="flex-1 overflow-y-auto p-4">
          <ResultCard
            score={result.score}
            matches={result.matches}
            total={result.total}
            comboMax={result.comboMax}
            hazards={hazards}
            foundIds={foundIds}
            onRetry={() => {
              resetPlay()
              setScreen("explore")
            }}
            onNewPhoto={() => {
              resetAll()
              setScreen("select")
            }}
          />
        </div>
      </Shell>
    )
  }

  // フォールバック（状態が壊れたとき）
  return (
    <Shell title="きけんハンター">
      <div className="flex flex-1 items-center justify-center p-6">
        <Button onClick={resetAll} className="rounded-[18px] font-black">
          ホームに もどる
        </Button>
      </div>
    </Shell>
  )
}

function Shell({
  title,
  onBack,
  children,
}: {
  title?: string
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-gradient-to-b from-[#eaf2fb] to-[#dbeafe]">
      {title && (
        <header className="flex items-center gap-3 bg-[#0b2551] px-4 py-3 text-white">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="もどる"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          <h1 className="text-base font-black">{title}</h1>
        </header>
      )}
      {children}
    </div>
  )
}
