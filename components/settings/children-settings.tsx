"use client"

/**
 * 設定 > お子さま(UIUX改装 項目56)。
 * 本名ではなく呼び名で登録し、学年・小学校区は任意。通学路とは別の記録として持つ。
 * 通学路の「子どもの名前」から移した呼び名は、本名になっていないかを一度だけ確かめてもらう。
 */

import { useCallback, useEffect, useState, type FormEvent } from "react"

import { SchoolDistrictPicker } from "@/components/settings/school-district-picker"
import { useSchoolDistrictPicker } from "@/hooks/use-school-district-picker"
import type { ChildJson } from "@/lib/children-api"
import { CHILD_NICKNAME_MAX_LENGTH } from "@/lib/children-limits"
import { tankenTokens } from "@/lib/design/tanken"

const t = tankenTokens
const GRADES = [1, 2, 3, 4, 5, 6] as const

const buttonClass = `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold ${t.cls.focus}`

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown }
    // API は利用者向けの日本語だけを error に入れる。英語の内部メッセージは出さない
    return typeof payload.error === "string" && /[ぁ-んァ-ン一-龥]/.test(payload.error) ? payload.error : fallback
  } catch {
    return fallback
  }
}

function describeChild(child: ChildJson): string {
  const parts = [child.grade ? `${child.grade}年生` : null, child.school_district ? `${child.school_district.city} ${child.school_district.name}` : null]
  return parts.filter(Boolean).join(" · ") || "学年・学区は未設定"
}

interface ChildFormProps {
  initial?: ChildJson
  submitLabel: string
  onSubmit: (body: { nickname: string; grade: number | null; school_district_id: string | null }) => Promise<string | null>
  onCancel: () => void
}

function ChildForm({ initial, submitLabel, onSubmit, onCancel }: ChildFormProps) {
  const idPrefix = initial ? `child-${initial.id}` : "child-new"
  const [nickname, setNickname] = useState(initial?.nickname ?? "")
  const [grade, setGrade] = useState(initial?.grade ? String(initial.grade) : "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const picker = useSchoolDistrictPicker({
    prefecture: initial?.school_district?.prefecture,
    city: initial?.school_district?.city,
    schoolDistrictId: initial?.school_district_id,
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) {
      setError("呼び名を入力してください")
      return
    }
    setSaving(true)
    setError(null)
    const failure = await onSubmit({
      nickname: trimmed,
      grade: grade ? Number(grade) : null,
      school_district_id: picker.districtIdForSave,
    })
    setSaving(false)
    if (failure) setError(failure)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border p-4" style={{ borderColor: t.border.soft, background: t.color.paper }}>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-nickname`} className="text-sm font-bold">呼び名</label>
        <input
          id={`${idPrefix}-nickname`}
          // 「なおす」「お子さまを追加」で開いたら、すぐ呼び名の欄に移る(キーボードの位置を見失わない)
          autoFocus
          value={nickname}
          onChange={(event) => { setNickname(event.target.value); setError(null) }}
          maxLength={CHILD_NICKNAME_MAX_LENGTH}
          placeholder="例: さくちゃん"
          autoComplete="off"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${idPrefix}-nickname-hint${error ? ` ${idPrefix}-error` : ""}`}
          className={`min-h-11 w-full rounded-xl border bg-white px-3 text-sm ${t.cls.focus}`}
        />
        <p id={`${idPrefix}-nickname-hint`} className="text-xs" style={{ color: t.color.inkSoft }}>
          本名ではなく、家族で使う呼び名にしてください({CHILD_NICKNAME_MAX_LENGTH}文字まで)。
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-grade`} className="text-sm font-bold">学年(任意)</label>
        <select
          id={`${idPrefix}-grade`}
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          className={`min-h-11 w-full rounded-xl border bg-white px-3 text-sm sm:w-48 ${t.cls.focus}`}
        >
          <option value="">選ばない</option>
          {GRADES.map((value) => <option key={value} value={value}>{value}年生</option>)}
        </select>
      </div>
      <SchoolDistrictPicker picker={picker} idPrefix={idPrefix} />
      {error && <p id={`${idPrefix}-error`} role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={`${buttonClass} text-white`} style={{ background: t.color.primaryStrong }}>
          {saving ? "保存中…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
          やめる
        </button>
      </div>
    </form>
  )
}

export function ChildrenSettings() {
  const [children, setChildren] = useState<ChildJson[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [mode, setMode] = useState<{ kind: "idle" } | { kind: "add" } | { kind: "edit"; id: string } | { kind: "delete"; id: string }>({ kind: "idle" })
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const response = await fetch("/api/children", { credentials: "same-origin" })
      if (!response.ok) throw new Error(`children ${response.status}`)
      const payload = await response.json() as { children?: ChildJson[] }
      setChildren(payload.children ?? [])
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const send = async (url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<string | null> => {
    const failure = method === "POST" ? "登録できませんでした" : method === "DELETE" ? "消せませんでした" : "保存できませんでした"
    try {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (method === "DELETE" && response.status === 404) {
        // ほかの端末などで、もう消えていた
        await load()
        setMode({ kind: "idle" })
        return null
      }
      if (!response.ok) return readError(response, `${failure}。時間をおいてもう一度お試しください。`)
      await load()
      setMode({ kind: "idle" })
      return null
    } catch {
      return "通信できませんでした。電波のよいところでもう一度お試しください。"
    }
  }

  const unconfirmed = (children ?? []).filter((child) => !child.nickname_confirmed)

  const confirmAll = async () => {
    setActionError(null)
    for (const child of unconfirmed) {
      const failure = await send(`/api/children/${encodeURIComponent(child.id)}`, "PATCH", { confirm_nickname: true })
      if (failure) {
        setActionError(failure)
        return
      }
    }
  }

  const remove = async (id: string) => {
    setActionError(null)
    const failure = await send(`/api/children/${encodeURIComponent(id)}`, "DELETE")
    if (failure) setActionError(failure)
  }

  return (
    <section aria-labelledby="children-settings-title" className="space-y-3" data-testid="children-settings">
      <div>
        <h4 id="children-settings-title" className="text-base font-bold">お子さま</h4>
        <p className="mt-1 text-sm" style={{ color: t.color.inkSoft }}>
          本名ではなく呼び名で登録します。通学路とは別に保存し、通学路にはどの子の道かだけを結びつけます。
        </p>
      </div>

      {unconfirmed.length > 0 && (
        <div role="status" className="rounded-2xl border p-4" style={{ borderColor: t.color.accent, background: t.color.accentSoft }} data-testid="child-nickname-review">
          <p className="text-sm font-bold">呼び名が本名になっていないか確かめてください</p>
          <p className="mt-1 text-sm">
            通学路に入っていたお子さまの名前を、呼び名として登録し直しました({unconfirmed.map((child) => child.nickname).join("、")})。
            本名のときは「なおす」から呼び名に変えてください。
          </p>
          <button type="button" onClick={() => { void confirmAll() }} className={`${buttonClass} mt-3 border bg-white`} style={{ borderColor: t.border.soft }}>
            このままでよい
          </button>
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-2xl border p-4" style={{ borderColor: "rgba(217,85,85,.4)" }}>
          <p className="text-sm font-bold text-red-700">お子さまの登録を読み込めませんでした。</p>
          <button type="button" onClick={() => { void load() }} className={`${buttonClass} mt-2 border`} style={{ borderColor: t.border.soft }}>
            もう一度読み込む
          </button>
        </div>
      )}
      {children === null && !loadError && <p className="text-sm" style={{ color: t.color.inkSoft }}>読み込み中…</p>}

      {children !== null && (
        <ul className="space-y-2">
          {children.length === 0 && mode.kind !== "add" && (
            <li className="text-sm" style={{ color: t.color.inkSoft }}>まだ登録していません。通学路の「お子さまの呼び名」に入れると、ここにも出ます。</li>
          )}
          {children.map((child) => (
            <li key={child.id} className="rounded-2xl border p-3" style={{ borderColor: t.border.soft, background: t.color.card }}>
              {mode.kind === "edit" && mode.id === child.id ? (
                <ChildForm
                  initial={child}
                  submitLabel="保存する"
                  onSubmit={(body) => send(`/api/children/${encodeURIComponent(child.id)}`, "PATCH", body)}
                  onCancel={() => setMode({ kind: "idle" })}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{child.nickname}</p>
                    <p className="text-xs" style={{ color: t.color.inkSoft }}>{describeChild(child)}</p>
                  </div>
                  {mode.kind === "delete" && mode.id === child.id ? (
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${child.nickname}の登録を消すかの確認`}>
                      <p className="w-full text-xs">消しても通学路は残り、どの子の道かの指定だけが外れます。</p>
                      {/* 確かめの画面に切り替えたら、すぐ「消す」に移る(キーボードの位置を見失わない) */}
                      <button type="button" autoFocus onClick={() => { void remove(child.id) }} className={`${buttonClass} text-white`} style={{ background: "#C03A3A" }}>
                        消す
                      </button>
                      <button type="button" onClick={() => setMode({ kind: "idle" })} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
                        やめる
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setActionError(null); setMode({ kind: "edit", id: child.id }) }} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }} aria-label={`${child.nickname}をなおす`}>
                        なおす
                      </button>
                      <button type="button" onClick={() => { setActionError(null); setMode({ kind: "delete", id: child.id }) }} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }} aria-label={`${child.nickname}を消す`}>
                        消す
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {actionError && <p role="alert" className="text-sm font-bold text-red-700">{actionError}</p>}

      {mode.kind === "add" ? (
        <ChildForm submitLabel="登録する" onSubmit={(body) => send("/api/children", "POST", body)} onCancel={() => setMode({ kind: "idle" })} />
      ) : (
        children !== null && (
          <button type="button" onClick={() => { setActionError(null); setMode({ kind: "add" }) }} className={`${buttonClass} border`} style={{ borderColor: t.border.soft, color: t.color.primaryStrong }}>
            お子さまを追加
          </button>
        )
      )}
    </section>
  )
}
