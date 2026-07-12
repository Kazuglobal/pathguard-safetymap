"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft, Mail, CheckCircle } from "lucide-react"

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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("メールアドレスを入力してください")
      emailRef.current?.focus()
      return
    }

    if (!validateEmail(email)) {
      setError("例: name@example.com の形で入力してください")
      emailRef.current?.focus()
      return
    }

    setIsLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      )

      if (resetError) {
        const message = resetError.message || ""
        if (message.toLowerCase().includes("rate") || message.includes("429")) {
          setError("短い時間に送信が続きました。少し待ってから、もう一度お試しください。")
        } else {
          setError("再設定メールを送れませんでした。時間をおいてもう一度お試しください。")
        }
        emailRef.current?.focus()
        return
      }

      setIsSuccess(true)
    } catch {
      setError("ネットワークに接続できません。通信状態を確認して、もう一度お試しください。")
      emailRef.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h1
              className="mt-4 text-2xl font-bold text-gray-900"
              data-testid="forgot-password-title"
            >
              メールを送信しました
            </h1>
          </div>

          <Alert data-testid="forgot-password-success">
            <AlertDescription>
              パスワードリセット用のリンクを {email}{" "}
              に送信しました。メールをご確認ください。
            </AlertDescription>
          </Alert>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-blue-600 hover:underline"
              data-testid="back-to-login"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              ログインに戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <h1
            className="mt-4 text-2xl font-bold text-gray-900"
            data-testid="forgot-password-title"
          >
            パスワードをお忘れですか？
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-busy={isLoading}>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">必須</span></Label>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder="example@example.com"
              disabled={isLoading}
              data-testid="forgot-password-email"
              autoComplete="email"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "email-error" : "email-help"}
            />
            <p id="email-help" className="text-xs text-gray-500">登録に使ったメールアドレスを入力してください。</p>
            {error && (
              <p id="email-error" role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-busy={isLoading}
            data-testid="forgot-password-submit"
          >
            {isLoading ? "送信中..." : "リセットリンクを送信"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
            data-testid="back-to-login"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            ログインに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
