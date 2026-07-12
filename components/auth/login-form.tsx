"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

const OFFLINE_MESSAGE = "Supabaseに接続できません。ネットワーク接続を確認してから再試行してください。"
const API_CONFIG_MESSAGE = "API設定エラーが発生しました。環境変数が正しく設定されているか確認してください。"

const resolveErrorMessage = (error: unknown, fallback: string) => {
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as any).message) : ""
  if (message.includes("network_error") || message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return OFFLINE_MESSAGE
  }
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。"
  }
  if (message.includes("Invalid API") || message.includes("invalid api") || message.includes("Invalid URL") || message.includes("example.supabase.co")) {
    return API_CONFIG_MESSAGE
  }
  return message || fallback
}

export default function LoginForm({ nextPath = "/map" }: { nextPath?: string }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const waitForSession = async () =>
    new Promise<void>((resolve) => {
      let settled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let subscription: { unsubscribe: () => void } | null = null
      const finalize = () => {
        if (settled) return
        settled = true
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        subscription?.unsubscribe()
        resolve()
      }
      const { data } = supabase.auth.onAuthStateChange((event: any, session: any) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
          finalize()
        }
      })
      subscription = data.subscription
      if (settled && subscription) {
        subscription.unsubscribe()
        return
      }
      timeoutId = setTimeout(finalize, 3000)
    })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // signInWithPassword が返した session を優先して使う
      if (!data.session) {
        // セッションが確立されるのを待つ
        await waitForSession()
      }

      toast({
        title: "ログインに成功しました",
        description: "アプリケーションにログインしました。",
      })

      router.refresh()
      router.replace(nextPath)
    } catch (error) {
      toast({
        title: "エラー",
        description: resolveErrorMessage(error, "ログインに失敗しました。"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "demo@example.com",
        password: "demopassword",
      })

      if (error) throw error

      // signInWithPassword が返した session を優先して使う
      if (!data.session) {
        // セッションが確立されるのを待つ
        await waitForSession()
      }

      toast({
        title: "デモユーザーでログインしました",
        description: "デモアカウントにログインしました。",
      })

      router.replace(nextPath === "/map" ? "/landing" : nextPath)
    } catch (error) {
      toast({
        title: "エラー",
        description: resolveErrorMessage(error, "デモログインに失敗しました。"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>アカウント情報を入力してログインしてください。</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">パスワード</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
                data-testid="forgot-password-link"
              >
                パスワードをお忘れですか？
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={handleDemoLogin} disabled={isLoading}>
            デモユーザーで試す
          </Button>
          <SocialLoginButtons nextPath={nextPath} />
          <div className="text-center text-sm mt-2">
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="text-primary hover:underline">
              新規登録
            </Link>
            をご利用ください。
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
