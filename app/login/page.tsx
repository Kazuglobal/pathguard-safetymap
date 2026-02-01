import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import LoginForm from "@/components/auth/login-form"

export default async function LoginPage() {
  const supabase = await createServerClient()

  if (!supabase) {
    console.error("Failed to create Supabase server client.")
    redirect('/error?message=supabase-init-failed')
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    console.error("Error getting session:", sessionError)
  }

  if (session) {
    redirect("/map")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">通学路安全マップ</h1>
          <p className="mt-2 text-gray-600">子供たちの安全な通学をサポートします</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
