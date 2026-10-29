"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD } from "@/lib/auth/demo-account"
import { resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { EMAIL_PLACEHOLDER } from "@/lib/auth/form-copy"
import { PRODUCT_FACTS } from "@/lib/product-facts"

export default function LoginForm({ nextPath = "/map" }: { nextPath?: string }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

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

  const showError = (error: unknown, fallback: string) => {
    const message = resolveAuthErrorMessage(error, fallback)
    setFormError(message)
    toast({
      title: "ログインできませんでした",
      description: message,
      variant: "destructive",
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error

      // signInWithPassword が返した session を優先して使う
      if (!data.session) {
        // セッションが確立されるのを待つ
        await waitForSession()
      }

      toast({
        title: "ログインしました",
      })

      router.refresh()
      router.replace(nextPath)
    } catch (error) {
      showError(error, "ログインできませんでした。時間をおいて、もう一度お試しください。")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)
    setFormError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNT_EMAIL,
        password: DEMO_ACCOUNT_PASSWORD,
      })

      if (error) throw error

      // signInWithPassword が返した session を優先して使う
      if (!data.session) {
        // セッションが確立されるのを待つ
        await waitForSession()
      }

      // 入力する画面に移る前に、共用であることをもう一度伝える
      toast({
        title: "デモユーザーでログインしました",
        description: PRODUCT_FACTS.demo.shared,
      })

      router.replace(nextPath === "/map" ? "/landing" : nextPath)
    } catch (error) {
      showError(error, "デモユーザーでログインできませんでした。時間をおいて、もう一度お試しください。")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={handleLogin} aria-busy={isLoading}>
          <CardContent className="space-y-4 pt-6">
            {formError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {formError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder={EMAIL_PLACEHOLDER}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
            <SocialLoginButtons nextPath={nextPath} />
            <div className="mt-2 text-center text-sm">
              アカウントをお持ちでない方は{" "}
              <Link href="/register" className="text-primary hover:underline">
                新規登録
              </Link>
              をご利用ください。
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* デモの説明(登録不要・何が見られるか・データは見本。UIUX改装 項目3) */}
      <section aria-labelledby="demo-login-heading" className="rounded-xl border border-dashed bg-white/70 p-4">
        <h2 id="demo-login-heading" className="text-sm font-black">
          登録せずに試す
        </h2>
        <p className="mt-1 text-sm leading-relaxed">{PRODUCT_FACTS.demo.summary}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>{PRODUCT_FACTS.demo.note}</li>
          <li>{PRODUCT_FACTS.demo.shared}</li>
        </ul>
        <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={handleDemoLogin} disabled={isLoading}>
          デモユーザーで試す
        </Button>
      </section>
    </div>
  )
}
