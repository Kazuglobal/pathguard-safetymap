"use client"

/**
 * 設定 > 位置の保存のしかた(UIUX改装 項目59)。
 *  - ふつう: 通学路の両端を200m以上削って保存し、通学路の近く(300m)の新しい報告を知らせる(短くて保存できない通学路は学区で知らせる)
 *  - 粗く保存: 道すじを保存せず、起点・終点は約10kmの粗さにする。知らせは、登録したお子さまの小学校区ごと
 */

import { useEffect, useState } from "react"

import { tankenTokens } from "@/lib/design/tanken"
import type { LocationPrecision } from "@/lib/route-privacy"

const t = tankenTokens

const OPTIONS: ReadonlyArray<{ value: LocationPrecision; label: string; description: string }> = [
  {
    value: "standard",
    label: "ふつう(おすすめ)",
    description: "自宅と学校の前の道(両端それぞれ200m以上)は保存せず、出発地・到着地は約1kmの粗さにします。通学路の近く(300m以内)に新しい報告があれば知らせます。短くて道すじを保存できない通学路(約450m未満)は、登録したお子さまの小学校区で知らせます。",
  },
  {
    value: "coarse",
    label: "粗く保存",
    description: "道すじは保存せず、出発地・到着地は約10kmの粗さにします。知らせは、登録したお子さまの小学校区で新しい報告があったときです。通学路の近くの確認は、この端末の中だけで行います。",
  },
]

export function LocationPrecisionSettings() {
  const [current, setCurrent] = useState<LocationPrecision | null>(null)
  const [pending, setPending] = useState<LocationPrecision | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/profile", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`profile ${response.status}`)
        const payload = await response.json() as { profile?: { location_precision?: string } }
        if (active) setCurrent(payload.profile?.location_precision === "coarse" ? "coarse" : "standard")
      })
      .catch(() => { if (active) setMessage({ kind: "error", text: "いまの設定を読み込めませんでした。時間をおいて開き直してください。" }) })
    return () => { active = false }
  }, [])

  const save = async (value: LocationPrecision) => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_precision: value }),
      })
      if (!response.ok) throw new Error(`profile ${response.status}`)
      setCurrent(value)
      setPending(null)
      setMessage({ kind: "ok", text: value === "coarse" ? "粗く保存にしました。保存済みの通学路からも道すじを消しました。" : "ふつうの保存にしました。「粗く保存」のあいだに消した道すじは戻りません。通学路の道すじを引き直すと、通学路の近く(300m以内)の知らせに戻ります。" })
    } catch {
      setMessage({ kind: "error", text: "保存できませんでした。時間をおいてもう一度お試しください。" })
    } finally {
      setSaving(false)
    }
  }

  const choose = (value: LocationPrecision) => {
    if (value === current) return
    // 粗く保存にすると保存済みの道すじも消えるので、画面の中で一度確かめる(ブラウザの確認ダイアログは使わない)
    if (value === "coarse") setPending("coarse")
    else void save(value)
  }

  return (
    <section aria-labelledby="location-precision-title" className="space-y-3" data-testid="location-precision-settings">
      <div>
        <h3 id="location-precision-title" className="text-base font-bold">位置の保存のしかた</h3>
        <p className="mt-1 text-sm" style={{ color: t.color.inkSoft }}>
          どちらでも、自宅と学校の場所は保存しません。
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="location-precision-title" className="space-y-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-2xl border p-3"
            style={{ borderColor: current === option.value ? t.color.primary : t.border.soft, background: t.color.card }}
          >
            <input
              type="radio"
              name="location-precision"
              value={option.value}
              checked={current === option.value}
              disabled={current === null || saving}
              onChange={() => choose(option.value)}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="block font-bold">{option.label}</span>
              <span className="mt-1 block text-xs leading-relaxed" style={{ color: t.color.inkSoft }}>{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {pending === "coarse" && (
        <div role="group" aria-label="粗く保存にするかの確認" className="rounded-2xl border p-3" style={{ borderColor: t.color.accent, background: t.color.accentSoft }}>
          <p className="text-sm">
            保存済みの通学路からも道すじを消します(元には戻せません。この端末で作った通学路は、この端末では全体を表示します)。
            知らせを受け取るには、お子さまの小学校区を登録してください。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void save("coarse") }}
              disabled={saving}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white ${t.cls.focus}`}
              style={{ background: t.color.primaryStrong }}
            >
              {saving ? "保存中…" : "粗く保存にする"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold ${t.cls.focus}`}
              style={{ borderColor: t.border.soft }}
            >
              やめる
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm font-bold ${message.kind === "error" ? "text-red-700" : ""}`} style={message.kind === "ok" ? { color: t.color.primaryStrong } : undefined}>
          {message.text}
        </p>
      )}
    </section>
  )
}
