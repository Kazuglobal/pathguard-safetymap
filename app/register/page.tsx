import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import RegisterForm from "@/components/auth/register-form"

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
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">アカウント登録</h1>
          <p className="mt-2 text-gray-600">通学路安全マップに登録して、安全な通学をサポートしましょう</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
