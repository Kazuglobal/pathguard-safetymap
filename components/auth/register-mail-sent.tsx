"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react"

import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { resolveAuthErrorMessage } from "@/lib/auth/error-messages"

/** もう一度送れるようになるまでの秒数(続けて押して、送信の上限に当たらないように) */
export const RESEND_COOLDOWN_SECONDS = 60

type ResendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string }

/**
 * 新規登録のあとに出す画面(UIUX改装 項目36)。確認メールを送った先と、届かないときにできること
 * (迷惑メールのフォルダ・アドレスの打ちまちがい・もう一度送る)を案内する。
 */
export function RegisterMailSent({ email, onEditEmail }: { email: string; onEditEmail: () => void }) {
  const { supabase } = useSupabase()
  const [state, setState] = useState<ResendState>({ kind: "idle" })
  // 次に送れる時刻と、いまの時刻(1秒ごとに読み直して、残りの秒数を出す)
  const [availableAt, setAvailableAt] = useState(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
  const [now, setNow] = useState(() => Date.now())
  const cooldown = Math.max(0, Math.ceil((availableAt - now) / 1000))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const resend = async () => {
    setState({ kind: "sending" })
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email })
      if (error) throw error
      setState({ kind: "sent" })
      const sentAt = Date.now()
      setNow(sentAt)
      setAvailableAt(sentAt + RESEND_COOLDOWN_SECONDS * 1000)
    } catch (error) {
      setState({
        kind: "error",
        message: resolveAuthErrorMessage(error, "確認メールを送れませんでした。時間をおいて、もう一度お試しください。"),
      })
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6" data-testid="register-mail-sent">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black">確認のメールを送りました</h2>
            <p className="mt-1 text-sm leading-relaxed">
              <span className="break-all font-bold">{email}</span> に確認のメールを送りました。メールのリンクを開くと登録が終わり、ログインできるようになります。
            </p>
          </div>
        </div>

        <section aria-labelledby="mail-not-arrived-heading" className="rounded-xl border bg-muted/40 p-4">
          <h3 id="mail-not-arrived-heading" className="text-sm font-black">
            メールが届かないとき
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            <li>迷惑メールのフォルダや、「プロモーション」などのフォルダを確かめてください。</li>
            <li>
              メールアドレスが合っているかを確かめてください。まちがっていたら、
              <button type="button" onClick={onEditEmail} className="font-bold text-primary underline underline-offset-4">
                メールアドレスを入力しなおす
              </button>
              。
            </li>
            <li>数分待っても届かないときは、下のボタンでもう一度送ってください。</li>
          </ol>

          {state.kind === "sent" && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm font-bold text-green-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> もう一度送りました。
            </p>
          )}
          {state.kind === "error" && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {state.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full"
            onClick={resend}
            disabled={state.kind === "sending" || cooldown > 0}
          >
            {state.kind === "sending"
              ? "送っています..."
              : cooldown > 0
                ? `確認メールをもう一度送る(あと${cooldown}秒)`
                : "確認メールをもう一度送る"}
          </Button>
        </section>

        <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground">
          ログインの画面へ
        </Link>
      </CardContent>
    </Card>
  )
}
