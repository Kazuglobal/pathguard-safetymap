"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

/** コールバックが /login?error=... で返すコードの利用者向け文言 */
const ERROR_MESSAGES: Record<string, string> = {
  oauth_missing_code: "Googleログインが中断されました。もう一度お試しください。",
  oauth_failed: "Googleログインに失敗しました。時間をおいて再試行してください。",
  line_not_configured: "LINEログインは現在準備中です。メールアドレスでログインしてください。",
  line_state_mismatch: "LINEログインの有効期限が切れました。もう一度お試しください。",
  line_login_failed: "LINEログインに失敗しました。時間をおいて再試行してください。",
  line_email_in_use:
    "このLINEアカウントのメールアドレスは、すでに別の方法で登録されています。メールアドレスとパスワードでログインしてください。",
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.19 7.19 0 0 1-10.71-3.78H1.35v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.35a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.35 6.6l4 3.1A7.17 7.17 0 0 1 12 4.75Z"
      />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.03 3.58 7.4 8.42 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.68 13.4 22 11.83 22 10.13 22 5.64 17.52 2 12 2ZM8.39 12.8H6.42a.53.53 0 0 1-.52-.53V8.4a.52.52 0 1 1 1.05 0v3.35h1.44a.53.53 0 0 1 0 1.05Zm1.94-.53a.52.52 0 1 1-1.05 0V8.4a.52.52 0 1 1 1.05 0v3.87Zm4.66 0a.53.53 0 0 1-.95.32l-1.99-2.71v2.39a.52.52 0 1 1-1.05 0V8.4a.53.53 0 0 1 .95-.31l1.99 2.7V8.4a.52.52 0 1 1 1.05 0v3.87Zm3.13-2.46a.53.53 0 0 1 0 1.05h-1.44v.93h1.44a.53.53 0 0 1 0 1.05h-1.97a.53.53 0 0 1-.52-.53V8.4c0-.29.24-.52.52-.52h1.97a.53.53 0 0 1 0 1.05h-1.44v.93h1.44Z" />
    </svg>
  )
}

/**
 * Google / LINE のソーシャルログインボタン。
 * ログイン・新規登録の両フォームで共用する(どちらも初回はアカウント作成になる)。
 * useSearchParams を使うため、静的レンダリングでも安全なよう Suspense で包んで公開する。
 */
export function SocialLoginButtons({ nextPath }: { nextPath?: string }) {
  return (
    <Suspense fallback={null}>
      <SocialLoginButtonsInner nextPath={nextPath} />
    </Suspense>
  )
}

function SocialLoginButtonsInner({ nextPath }: { nextPath?: string }) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [pendingProvider, setPendingProvider] = useState<"google" | "line" | null>(null)

  const errorCode = searchParams.get("error")
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : undefined
  const requestedNext = nextPath ?? searchParams.get("next") ?? "/map"

  const handleGoogleLogin = async () => {
    setPendingProvider("google")
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(requestedNext)}`,
        },
      })
      if (error) throw error
      // 成功時はこの後リダイレクトされるので、ローディングは解除しない
    } catch (error) {
      console.error("Google login failed:", error)
      toast({
        title: "エラー",
        description: "Googleログインを開始できませんでした。",
        variant: "destructive",
      })
      setPendingProvider(null)
    }
  }

  const handleLineLogin = () => {
    setPendingProvider("line")
    window.location.href = "/api/auth/line/start"
  }

  return (
    <div className="w-full space-y-2">
      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">または</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogleLogin}
        disabled={pendingProvider !== null}
        data-testid="google-login-button"
      >
        {pendingProvider === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon />
        )}
        Googleでログイン
      </Button>

      <Button
        type="button"
        className="w-full gap-2 text-white hover:opacity-90"
        style={{ backgroundColor: "#06C755" }}
        onClick={handleLineLogin}
        disabled={pendingProvider !== null}
        data-testid="line-login-button"
      >
        {pendingProvider === "line" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LineIcon />
        )}
        LINEでログイン
      </Button>
    </div>
  )
}
