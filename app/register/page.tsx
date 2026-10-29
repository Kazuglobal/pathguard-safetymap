import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import RegisterForm from "@/components/auth/register-form"
import { AuthShell } from "@/components/auth/auth-shell"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "新規登録" }

export default async function RegisterPage() {
  // Supabase クライアントを取得（Next.js 15 の async cookies() API 対応）
  const supabase = await createServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect("/map")
  }

  return (
    <AuthShell title="新規登録" intro>
      <RegisterForm />
    </AuthShell>
  )
}
