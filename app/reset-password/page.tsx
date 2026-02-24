"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, CheckCircle, ArrowLeft } from "lucide-react"

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Listen for password recovery event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User has clicked the password recovery link
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const validatePassword = (): boolean => {
    setPasswordError(null)
    setConfirmError(null)

    if (newPassword.length < 8) {
      setPasswordError("パスワードは8文字以上で入力してください")
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

    if (!validatePassword()) {
      return
    }

    setIsLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setGeneralError(updateError.message)
        return
      }

      setIsSuccess(true)

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch {
      setGeneralError("エラーが発生しました。もう一度お試しください。")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h1
            className="text-2xl font-bold text-gray-900"
            data-testid="reset-password-title"
          >
            パスワードを変更しました
          </h1>
          <p className="text-sm text-gray-600">
            新しいパスワードでログインできます。自動的にログインページに移動します...
          </p>
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            今すぐログインする
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Lock className="mx-auto h-12 w-12 text-gray-400" />
          <h1
            className="mt-4 text-2xl font-bold text-gray-900"
            data-testid="reset-password-title"
          >
            新しいパスワードを設定
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            新しいパスワードを入力してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {generalError && (
            <Alert variant="destructive">
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setPasswordError(null)
              }}
              placeholder="8文字以上で入力"
              disabled={isLoading}
              data-testid="new-password"
            />
            {passwordError && (
              <p
                className="text-sm text-red-500"
                data-testid="password-error"
              >
                {passwordError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">パスワードを確認</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setConfirmError(null)
              }}
              placeholder="もう一度入力"
              disabled={isLoading}
              data-testid="confirm-password"
            />
            {confirmError && (
              <p
                className="text-sm text-red-500"
                data-testid="confirm-password-error"
              >
                {confirmError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="reset-password-submit"
          >
            {isLoading ? "変更中..." : "パスワードを変更"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            ログインに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
