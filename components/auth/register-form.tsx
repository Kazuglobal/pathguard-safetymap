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

const resolveErrorMessage = (error: unknown, fallback: string) => {
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as any).message) : ""
  if (message.includes("network_error") || message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return OFFLINE_MESSAGE
  }
  return message || fallback
}

export default function RegisterForm() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) throw error

      toast({
        title: "登録が完了しました",
        description: "確認メールをご確認ください。",
      })

      router.push("/login")
    } catch (error) {
      toast({
        title: "エラー",
        description: resolveErrorMessage(error, "登録に失敗しました。"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>アカウント登録</CardTitle>
        <CardDescription>必要事項を入力して新しいアカウントを作成してください。</CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">氏名</Label>
            <Input
              id="fullName"
              placeholder="山田 太郎"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
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
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500">パスワードは8文字以上で設定してください。</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "登録中..." : "登録する"}
          </Button>
          <SocialLoginButtons />
          <div className="text-center text-sm mt-2">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-primary hover:underline">
              ログイン
            </Link>
            してください。
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
