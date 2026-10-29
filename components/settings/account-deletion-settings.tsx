"use client"

/**
 * 設定 > アカウントを削除(UIUX改装 項目40)。消えるものを見せ、「さくじょ」と入力してから確定する。
 * ブラウザの確認ダイアログは使わない(画面の中で確かめる)。
 */

import { useState } from "react"
import { useRouter } from "next/navigation"

import { useSupabase } from "@/components/providers/supabase-provider"
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/account-deletion-confirmation"
import { tankenTokens } from "@/lib/design/tanken"
import { clearAllLocalRouteGeometry } from "@/lib/route-local-geometry"

const t = tankenTokens

const DELETED_ITEMS = [
  "プロフィール(表示名・アイコン)とログインのアカウント",
  "危険箇所の報告と写真、コメント・いいね・保存",
  "通学路とお子さまの登録",
  "通知の設定、ポイント・バッジ・ミッション・ハンターの記録",
]

export function AccountDeletionSettings() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmation }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? "退会の処理に失敗しました。もう一度お試しください。")
      }
      clearAllLocalRouteGeometry()
      await supabase.auth.signOut().catch(() => undefined)
      router.replace("/login?deleted=1")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "退会の処理に失敗しました。もう一度お試しください。")
      setDeleting(false)
    }
  }

  const buttonClass = `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold ${t.cls.focus}`

  return (
    <section aria-labelledby="account-deletion-title" className="space-y-2" data-testid="account-deletion-settings">
      <h4 id="account-deletion-title" className="text-base font-bold">アカウントを削除</h4>
      {!open ? (
        <>
          <p className="text-sm" style={{ color: t.color.inkSoft }}>
            退会すると、あなたのデータをすべて消します。元には戻せません。
          </p>
          <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} border`} style={{ borderColor: "rgba(192,58,58,.5)", color: "#A12F2F" }}>
            アカウントを削除する
          </button>
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "rgba(192,58,58,.5)" }}>
          <p className="text-sm font-bold">次のものをすべて消します(元には戻せません)</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {DELETED_ITEMS.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <label htmlFor="account-deletion-confirm" className="block text-sm">
            確かめるため「<b>{ACCOUNT_DELETION_CONFIRMATION}</b>」と入力してください
          </label>
          <input
            id="account-deletion-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className={`min-h-11 w-full rounded-xl border bg-white px-3 text-sm ${t.cls.focus}`}
          />
          {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void remove() }}
              disabled={confirmation !== ACCOUNT_DELETION_CONFIRMATION || deleting}
              className={`${buttonClass} text-white disabled:opacity-50`}
              style={{ background: "#C03A3A" }}
            >
              {deleting ? "削除しています…" : "すべて削除して退会する"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setConfirmation(""); setError(null) }} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
              やめる
            </button>
          </div>
          {confirmation !== ACCOUNT_DELETION_CONFIRMATION && (
            <p className="text-xs" style={{ color: t.color.inkSoft }}>「{ACCOUNT_DELETION_CONFIRMATION}」と入力すると、削除のボタンが押せるようになります。</p>
          )}
        </div>
      )}
    </section>
  )
}
