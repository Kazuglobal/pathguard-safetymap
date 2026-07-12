"use client"

import type React from "react"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle2, Circle } from "lucide-react"

const OFFLINE_MESSAGE = "Supabaseに接続できません。ネットワーク接続を確認してから再試行してください。"
const DUPLICATE_EMAIL_MESSAGE = "このメールは登録ずみです"

const resolveErrorMessage = (error: unknown, fallback: string) => {
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as any).message) : ""
  if (message.includes("network_error") || message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return OFFLINE_MESSAGE
  }
  if (message.toLowerCase().includes("rate") || message.includes("429")) {
    return "短い時間に送信が続きました。少し待ってから、もう一度お試しください。"
  }
  if (message.toLowerCase().includes("already") || message.toLowerCase().includes("registered")) {
    return DUPLICATE_EMAIL_MESSAGE
  }
  return message || fallback
}

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "terms" | "form", string>>

const RequiredChip = () => (
  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">必須</span>
)

export default function RegisterForm() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: FieldErrors = {}
    if (!fullName.trim()) nextErrors.fullName = "氏名を入力してください"
    if (!email.trim()) nextErrors.email = "メールアドレスを入力してください"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "例: name@example.com の形で入力してください"
    if (!Object.values(passwordChecks).every(Boolean)) nextErrors.password = "下の3つの条件をすべて満たしてください"
    if (!agreedToTerms) nextErrors.terms = "利用規約とプライバシーポリシーへの同意が必要です"

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.fullName) fullNameRef.current?.focus()
      else if (nextErrors.email) emailRef.current?.focus()
      else if (nextErrors.password) passwordRef.current?.focus()
      else document.getElementById("agreeToTerms")?.focus()
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) throw error
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrors({ email: DUPLICATE_EMAIL_MESSAGE })
        emailRef.current?.focus()
        return
      }

      toast({
        title: "登録が完了しました",
        description: "確認メールをご確認ください。",
      })

      router.push("/login")
    } catch (error) {
      const message = resolveErrorMessage(error, "登録に失敗しました。時間をおいてもう一度お試しください。")
      if (message === DUPLICATE_EMAIL_MESSAGE) {
        setErrors({ email: message })
        emailRef.current?.focus()
        return
      }
      setErrors({ form: message })
      toast({
        title: "エラー",
        description: message,
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
      <form onSubmit={handleRegister} noValidate aria-busy={isLoading}>
        <CardContent className="space-y-4">
          {errors.form && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {errors.form}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">氏名 <RequiredChip /></Label>
            <Input
              ref={fullNameRef}
              id="fullName"
              placeholder="山田 太郎"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((current) => ({ ...current, fullName: undefined })) }}
              required
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
            />
            {errors.fullName && <p id="fullName-error" role="alert" className="text-sm font-bold text-red-600">{errors.fullName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス <RequiredChip /></Label>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((current) => ({ ...current, email: undefined })) }}
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "register-email-error" : undefined}
            />
            {errors.email && (
              <div id="register-email-error" role="alert" className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                <p className="flex items-center gap-2"><AlertCircle className="h-4 w-4" aria-hidden="true" />{errors.email}</p>
                {errors.email === DUPLICATE_EMAIL_MESSAGE && (
                  <Link href={`/login?next=${encodeURIComponent("/map")}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-orange-300 bg-white px-4 text-orange-800">
                    ログインへすすむ
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード <RequiredChip /></Label>
            <Input
              ref={passwordRef}
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((current) => ({ ...current, password: undefined })) }}
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-checklist"
            />
            <ul id="password-checklist" className="space-y-1 text-xs font-bold" aria-label="パスワードの条件">
              {[
                [passwordChecks.length, "8文字以上で入力してください"],
                [passwordChecks.letter, "英字（アルファベット）を含めてください"],
                [passwordChecks.number, "数字を含めてください"],
              ].map(([passed, label]) => (
                <li key={String(label)} className="flex items-center gap-2" style={{ color: passed ? "#0C7A55" : "#847661" }}>
                  {passed ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                  {String(label)}
                </li>
              ))}
            </ul>
            {errors.password && <p role="alert" className="text-sm font-bold text-red-600">{errors.password}</p>}
          </div>
          <div className="flex min-h-11 items-start space-x-2">
            <Checkbox
              id="agreeToTerms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => { setAgreedToTerms(checked === true); setErrors((current) => ({ ...current, terms: undefined })) }}
              data-testid="agree-to-terms-checkbox"
            />
            <Label htmlFor="agreeToTerms" className="text-xs font-normal leading-snug text-gray-600">
              <RequiredChip />
              <Link
                href="/terms"
                target="_blank"
                className="inline-flex min-h-[24px] items-center align-middle text-primary hover:underline"
              >
                利用規約
              </Link>
              および
              <Link
                href="/privacy"
                target="_blank"
                className="inline-flex min-h-[24px] items-center align-middle text-primary hover:underline"
              >
                プライバシーポリシー
              </Link>
              に同意する
            </Label>
          </div>
          {errors.terms && <p role="alert" className="text-sm font-bold text-red-600">{errors.terms}</p>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" className="min-h-12 w-full" disabled={isLoading} aria-busy={isLoading}>
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
