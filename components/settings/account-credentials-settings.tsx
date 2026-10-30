"use client"

/**
 * 設定 > メールアドレスとパスワード(UIUX改装 項目46)。
 * メールは確認メールのリンクを開くと変わる。LINE でログインしているアカウントはメールを変えない(LINE ログインが使えなくなるため)
 */

import { useState, type FormEvent } from "react"

import { PasswordChecklist } from "@/components/auth/password-checklist"
import { useOptionalAuth } from "@/components/providers/auth-context"
import { useSupabase } from "@/components/providers/supabase-provider"
import { DEMO_ACCOUNT_LOCKED_MESSAGE, isDemoAccountEmail } from "@/lib/auth/demo-account"
import { resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { EMAIL_PLACEHOLDER, emailInputError } from "@/lib/auth/form-copy"
import { isLineAccount } from "@/lib/auth/line-email"
import { isPasswordValid, PASSWORD_RULES_ERROR } from "@/lib/auth/password-rules"
import { tankenTokens } from "@/lib/design/tanken"

const t = tankenTokens

type Message = { kind: "ok" | "error"; text: string } | null

function StatusMessage({ message }: { message: Message }) {
  if (!message) return null
  return (
    <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm font-bold ${message.kind === "error" ? "text-red-700" : ""}`} style={message.kind === "ok" ? { color: t.color.primaryStrong } : undefined}>
      {message.text}
    </p>
  )
}

export function AccountCredentialsSettings() {
  const { supabase } = useSupabase()
  const auth = useOptionalAuth()
  const currentEmail = auth?.user?.email ?? null
  const lineAccount = isLineAccount(auth?.user)
  const demoAccount = isDemoAccountEmail(currentEmail)

  const [email, setEmail] = useState("")
  const [emailMessage, setEmailMessage] = useState<Message>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<Message>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault()
    const next = email.trim()
    const inputError = emailInputError(next)
    if (inputError) {
      setEmailMessage({ kind: "error", text: inputError })
      return
    }
    setSavingEmail(true)
    setEmailMessage(null)
    const { error } = await supabase.auth.updateUser({ email: next })
    setSavingEmail(false)
    if (error) {
      setEmailMessage({ kind: "error", text: resolveAuthErrorMessage(error, "メールアドレスを変えられませんでした。時間をおいてもう一度お試しください。") })
      return
    }
    setEmail("")
    setEmailMessage({ kind: "ok", text: "確認のメールを送りました。メールのリンクを開くと、新しいメールアドレスに変わります(いまのアドレスにも確認のメールが届いたときは、両方のリンクを開いてください)。" })
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!isPasswordValid(password)) {
      setPasswordMessage({ kind: "error", text: PASSWORD_RULES_ERROR })
      return
    }
    setSavingPassword(true)
    setPasswordMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPassword(false)
    if (error) {
      setPasswordMessage({ kind: "error", text: resolveAuthErrorMessage(error, "パスワードを変えられませんでした。いったんログアウトして、ログインし直してからお試しください。") })
      return
    }
    setPassword("")
    setPasswordMessage({ kind: "ok", text: "パスワードを変えました。" })
  }

  const inputClass = `min-h-11 w-full rounded-xl border bg-white px-3 text-sm ${t.cls.focus}`
  const buttonClass = `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold text-white disabled:opacity-50 ${t.cls.focus}`

  return (
    <section aria-labelledby="account-credentials-title" className="space-y-4" data-testid="account-credentials-settings">
      <h3 id="account-credentials-title" className="text-base font-bold">メールアドレスとパスワード</h3>

      {demoAccount ? (
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          {DEMO_ACCOUNT_LOCKED_MESSAGE}
        </p>
      ) : lineAccount ? (
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          LINE でログインしているアカウントです。メールアドレスとパスワードは使いません。
        </p>
      ) : (
        <>
          <form onSubmit={changeEmail} noValidate className="space-y-2">
            <label htmlFor="settings-new-email" className="block text-sm font-bold">メールアドレスを変える</label>
            {currentEmail && <p className="text-xs" style={{ color: t.color.inkSoft }}>いまのメールアドレス: {currentEmail}</p>}
            <input id="settings-new-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailMessage(null) }} placeholder={EMAIL_PLACEHOLDER} className={inputClass} />
            <StatusMessage message={emailMessage} />
            <button type="submit" disabled={savingEmail || !email.trim()} className={buttonClass} style={{ background: t.color.primaryStrong }}>
              {savingEmail ? "送っています…" : "確認のメールを送る"}
            </button>
          </form>

          <form onSubmit={changePassword} noValidate className="space-y-2">
            <label htmlFor="settings-new-password" className="block text-sm font-bold">パスワードを変える</label>
            <input id="settings-new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordMessage(null) }} className={inputClass} aria-describedby="settings-password-checks" />
            <PasswordChecklist id="settings-password-checks" password={password} />
            <StatusMessage message={passwordMessage} />
            <button type="submit" disabled={savingPassword || !password} className={buttonClass} style={{ background: t.color.primaryStrong }}>
              {savingPassword ? "変えています…" : "パスワードを変える"}
            </button>
          </form>
        </>
      )}
    </section>
  )
}
