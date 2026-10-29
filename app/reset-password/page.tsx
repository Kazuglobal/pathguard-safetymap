"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle, CheckCircle2, Circle } from "lucide-react"
import { isSessionMissingAuthError, LINK_EXPIRED_MESSAGE, resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules"

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  /** 再設定のリンクの期限が切れていたら、メールを送りなおす画面への導線を出す */
  const [linkExpired, setLinkExpired] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // 再設定のリンクを開くと PASSWORD_RECOVERY が来る(リンクの中の情報で、一時的にログインした状態になる)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {})

    return () => subscription.unsubscribe()
  }, [supabase])

  // 新規登録と同じ決まり(lib/auth/password-rules.ts)
  const passwordChecks = checkPassword(newPassword)

  const validatePassword = (): boolean => {
    setPasswordError(null)
    setConfirmError(null)

    if (!Object.values(passwordChecks).every(Boolean)) {
      setPasswordError("下の3つの条件をすべて満たしてください")
      return false
    }

    if (newPassword !== confirmPassword) {
      setConfirmError("パスワードが一致しません")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setLinkExpired(false)

    if (!validatePassword()) {
      return
    }

    setIsLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        if (isSessionMissingAuthError(updateError)) {
          setLinkExpired(true)
          setGeneralError(LINK_EXPIRED_MESSAGE)
        } else {
          setGeneralError(resolveAuthErrorMessage(updateError, "パスワードを変えられませんでした。時間をおいて、もう一度お試しください。"))
        }
        return
      }

      setIsSuccess(true)

      // 少し待ってからログインの画面へ
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (caught) {
      setGeneralError(resolveAuthErrorMessage(caught, "パスワードを変えられませんでした。もう一度お試しください。"))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthShell title="パスワードを変更しました" titleTestId="reset-password-title">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-700">
            新しいパスワードでログインできます。自動的にログインページに移動します...
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-blue-700 hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            今すぐログインする
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="新しいパスワードを設定" titleTestId="reset-password-title">
      <p className="text-sm text-gray-700">新しいパスワードを入力してください。</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-busy={isLoading}>
        {generalError && (
          <Alert variant="destructive">
            <AlertDescription>
              {generalError}
              {linkExpired && (
                <>
                  {" "}
                  <Link href="/forgot-password" className="font-bold underline underline-offset-4">
                    再設定のメールを送りなおす
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="new-password">新しいパスワード</Label>
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setPasswordError(null)
            }}
            disabled={isLoading}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            aria-describedby="new-password-checklist"
            data-testid="new-password"
          />
          <ul id="new-password-checklist" className="space-y-1 text-xs font-bold" aria-label="パスワードの条件">
            {[
              [passwordChecks.length, `${PASSWORD_MIN_LENGTH}文字以上で入力してください`],
              [passwordChecks.letter, "英字（アルファベット）を含めてください"],
              [passwordChecks.number, "数字を含めてください"],
            ].map(([passed, label]) => (
              <li key={String(label)} className="flex items-center gap-2" style={{ color: passed ? "#0C7A55" : "#746855" }}>
                {passed ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                {String(label)}
              </li>
            ))}
          </ul>
          {passwordError && (
            <p role="alert" className="text-sm font-bold text-red-600" data-testid="password-error">
              {passwordError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">パスワードを確認</Label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setConfirmError(null)
            }}
            placeholder="もう一度入力"
            disabled={isLoading}
            autoComplete="new-password"
            data-testid="confirm-password"
          />
          {confirmError && (
            <p role="alert" className="text-sm font-bold text-red-600" data-testid="confirm-password-error">
              {confirmError}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={isLoading}
          data-testid="reset-password-submit"
        >
          {isLoading ? "変更中..." : "パスワードを変更"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          ログインに戻る
        </Link>
      </div>
    </AuthShell>
  )
}
