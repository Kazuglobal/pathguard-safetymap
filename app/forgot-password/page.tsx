"use client"

import { useRef, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { AuthShell } from "@/components/auth/auth-shell"
import { BackToLogin } from "@/components/auth/back-to-login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { isRateLimitAuthError, OFFLINE_MESSAGE, resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { EMAIL_PLACEHOLDER, emailInputError } from "@/lib/auth/form-copy"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const normalizedEmail = email.trim()
    const inputError = emailInputError(normalizedEmail)
    if (inputError) {
      setError(inputError)
      emailRef.current?.focus()
      return
    }

    setIsLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      )

      // 送信の上限(同じアドレスに続けて送った)は、登録されているアドレスのときだけ返る。
      // 成功と同じ画面にして、アカウントの有無が分からないようにする(前に送ったメールはそのまま使える)
      if (resetError && !isRateLimitAuthError(resetError)) {
        setError(resolveAuthErrorMessage(resetError, "再設定のメールを送れませんでした。時間をおいて、もう一度お試しください。"))
        emailRef.current?.focus()
        return
      }

      setIsSuccess(true)
    } catch (caught) {
      setError(resolveAuthErrorMessage(caught, OFFLINE_MESSAGE))
      emailRef.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthShell title="メールを送りました" titleTestId="forgot-password-title">
        <Alert data-testid="forgot-password-success">
          <AlertDescription>
            <span className="break-all font-bold">{email.trim()}</span> が登録されているメールアドレスなら、
            パスワードを再設定するためのリンクを送りました。メールのリンクを開いて、新しいパスワードを決めてください。
          </AlertDescription>
        </Alert>
        <section aria-labelledby="reset-mail-not-arrived" className="mt-4 rounded-xl border bg-white/70 p-4">
          <h2 id="reset-mail-not-arrived" className="text-sm font-black">メールが届かないとき</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>迷惑メールのフォルダや、「プロモーション」などのフォルダを確かめてください。</li>
            <li>登録に使ったメールアドレスかを確かめて、数分たってから、もう一度送ってください。</li>
          </ul>
          <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setIsSuccess(false)}>
            メールアドレスを入力しなおす
          </Button>
        </section>
        <BackToLogin />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="パスワードをお忘れですか？" titleTestId="forgot-password-title">
      <p className="text-sm leading-relaxed text-gray-700">
        登録したメールアドレスを入力してください。パスワードを再設定するためのリンクをお送りします。
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate aria-busy={isLoading}>
        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">必須</span></Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }}
            placeholder={EMAIL_PLACEHOLDER}
            disabled={isLoading}
            data-testid="forgot-password-email"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-error" : "email-help"}
          />
          <p id="email-help" className="text-xs text-gray-600">登録に使ったメールアドレスを入力してください。</p>
          {error && (
            <p id="email-error" role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={isLoading}
          aria-busy={isLoading}
          data-testid="forgot-password-submit"
        >
          {isLoading ? "送信中..." : "再設定のメールを送る"}
        </Button>
      </form>

      <BackToLogin />
    </AuthShell>
  )
}
