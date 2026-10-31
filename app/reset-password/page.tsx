"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { AuthShell } from "@/components/auth/auth-shell"
import { BackToLogin } from "@/components/auth/back-to-login"
import { PasswordChecklist } from "@/components/auth/password-checklist"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle } from "lucide-react"
import { isSessionMissingAuthError, LINK_EXPIRED_MESSAGE, resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { isPasswordValid, PASSWORD_MIN_LENGTH, PASSWORD_RULES_ERROR } from "@/lib/auth/password-rules"

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

  // 再設定のリンクの中の情報は、クライアントを作るときに読み取られる(一時的にログインした状態になる)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const validatePassword = (): boolean => {
    setPasswordError(null)
    setConfirmError(null)

    // 新規登録と同じ決まり(lib/auth/password-rules.ts)
    if (!isPasswordValid(newPassword)) {
      setPasswordError(PASSWORD_RULES_ERROR)
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
        </div>
        <BackToLogin label="今すぐログインする" />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="新しいパスワードを設定" titleTestId="reset-password-title">
      <p className="text-sm text-gray-700">新しいパスワードを入力してください。</p>

      {/* 長さなどは画面の決まりの文で知らせる(ブラウザの標準の吹き出しにしない) */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate aria-busy={isLoading}>
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
          <PasswordChecklist id="new-password-checklist" password={newPassword} />
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

      <BackToLogin />
    </AuthShell>
  )
}
