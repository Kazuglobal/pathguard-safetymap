"use client"

import type React from "react"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { PasswordInput } from "@/components/auth/password-input"
import { RegisterMailSent } from "@/components/auth/register-mail-sent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle2, Circle, Mail } from "lucide-react"
import { DUPLICATE_EMAIL_MESSAGE, resolveAuthErrorMessage } from "@/lib/auth/error-messages"
import { EMAIL_PLACEHOLDER, emailInputError } from "@/lib/auth/form-copy"
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules"
import { PRODUCT_FACTS } from "@/lib/product-facts"

type FieldErrors = Partial<Record<"email" | "password" | "terms" | "form", string>>

const RequiredChip = () => (
  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">必須</span>
)

export default function RegisterForm() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  /** 確認メールを送った先(送ったあとは、届かないときの案内の画面に切り替える。UIUX改装 項目36) */
  const [sentTo, setSentTo] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const passwordChecks = checkPassword(password)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim()
    const nextErrors: FieldErrors = {}
    const emailError = emailInputError(normalizedEmail)
    if (emailError) nextErrors.email = emailError
    if (!Object.values(passwordChecks).every(Boolean)) nextErrors.password = "下の3つの条件をすべて満たしてください"
    if (!agreedToTerms) nextErrors.terms = "利用規約とプライバシーポリシーへの同意が必要です"

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.email) emailRef.current?.focus()
      else if (nextErrors.password) passwordRef.current?.focus()
      else document.getElementById("agreeToTerms")?.focus()
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      // 氏名は預からない(UIUX改装 項目55)。user_metadata には何も入れない
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password })

      if (error) throw error
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrors({ email: DUPLICATE_EMAIL_MESSAGE })
        emailRef.current?.focus()
        return
      }

      // メールの確認を求めない設定のときは、そのままログインした状態になる
      if (data.session) {
        toast({ title: "登録しました" })
        router.replace("/landing")
        return
      }

      setSentTo(normalizedEmail)
    } catch (error) {
      const message = resolveAuthErrorMessage(error, "登録できませんでした。時間をおいて、もう一度お試しください。")
      if (message === DUPLICATE_EMAIL_MESSAGE) {
        setErrors({ email: message })
        emailRef.current?.focus()
        return
      }
      setErrors({ form: message })
      toast({
        title: "登録できませんでした",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (sentTo) {
    return (
      <RegisterMailSent
        email={sentTo}
        onEditEmail={() => {
          setSentTo(null)
          // 打ちまちがいを直せるように、入力欄へ戻す
          setTimeout(() => emailRef.current?.focus(), 0)
        }}
      />
    )
  }

  return (
    <Card>
      <form onSubmit={handleRegister} noValidate aria-busy={isLoading}>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{PRODUCT_FACTS.registration.summary}</p>
          {errors.form && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {errors.form}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス <RequiredChip /></Label>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              inputMode="email"
              placeholder={EMAIL_PLACEHOLDER}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((current) => ({ ...current, email: undefined })) }}
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "register-email-error" : undefined}
            />
            {errors.email && (
              <div id="register-email-error" role="alert" className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800">
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
            <PasswordInput
              ref={passwordRef}
              id="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((current) => ({ ...current, password: undefined })) }}
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-checklist"
            />
            <ul id="password-checklist" className="space-y-1 text-xs font-bold" aria-label="パスワードの条件">
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
            {errors.password && <p role="alert" className="text-sm font-bold text-red-600">{errors.password}</p>}
          </div>
          <div className="flex min-h-11 items-start space-x-2">
            <Checkbox
              id="agreeToTerms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => { setAgreedToTerms(checked === true); setErrors((current) => ({ ...current, terms: undefined })) }}
              data-testid="agree-to-terms-checkbox"
            />
            <Label htmlFor="agreeToTerms" className="text-xs font-normal leading-snug text-gray-700">
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
          {/* 登録のあとに確認メールが届くことを、押す前に伝える(項目36) */}
          <p className="flex w-full items-start gap-2 text-xs leading-relaxed text-muted-foreground" data-testid="register-confirmation-note">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {PRODUCT_FACTS.registration.confirmationMail}
          </p>
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
