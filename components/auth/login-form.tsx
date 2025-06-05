"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export default function LoginForm() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast({
        title: "ログイン成功",
        description: "アプリケーションにログインしました。",
      })

      router.push("/map")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message || "ログイン中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@example.com",
        password: "demopassword",
      })

      if (error) {
        throw error
      }

      toast({
        title: "デモログイン成功",
        description: "デモユーザーとしてログインしました。",
      })

      router.push("/map")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "エラー",
        description: "デモログイン中にエラーが発生しました。デモアカウントが設定されているか確認してください。",
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
        <CardDescription>アカウント情報を入力してログインしてください</CardDescription>
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
            <Label htmlFor="password">パスワード</Label>
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
            デモユーザーでログイン
          </Button>
          <div className="text-center text-sm mt-2">
            アカウントをお持ちでない場合は{" "}
            <Link href="/register" className="text-primary hover:underline">
              登録
            </Link>
            してください
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
