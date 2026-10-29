import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import LoginForm from "@/components/auth/login-form"
import { getSafeNextPath } from "@/lib/auth/safe-next"
import { tankenTokens } from "@/lib/design/tanken"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; loggedOut?: string | string[] }>
}) {
  const params = await searchParams
  const nextPath = getSafeNextPath(params.next)
  const justLoggedOut = params.loggedOut === "1"
  const supabase = await createServerClient()

  if (!supabase) {
    // 以前は存在しない /error へ飛ばしていた。その場で日本語の案内を出す
    console.error("Failed to create Supabase server client.")
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-base font-bold text-red-800">ログイン画面を表示できませんでした</p>
          <p className="mt-2 text-sm text-red-700">時間をおいて、このページを再読み込みしてください。</p>
        </div>
      </div>
    )
  }

  // getSession(Cookieを読むだけ)ではなく getUser で確かめる。
  // 保護ページ側の確認が一時的に失敗してここへ来たとき、Cookieだけを根拠に戻すと
  // 行ったり来たりのリダイレクトになるため。確かめられなければログインフォームを出す
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !userError.message?.includes("Auth session missing")) {
    console.error("Error getting user:", userError.message)
  }

  if (user) {
    redirect(nextPath)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">通学路安全マップ</h1>
          <p className="mt-2 text-gray-600">子供たちの安全な通学をサポートします</p>
        </div>
        {justLoggedOut && (
          <p
            role="status"
            className="mb-4 rounded-xl border px-4 py-3 text-center text-sm font-bold"
            style={{
              background: tankenTokens.color.primarySoft,
              borderColor: tankenTokens.border.soft,
              color: tankenTokens.color.primaryStrong,
            }}
          >
            ログアウトしました
          </p>
        )}
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  )
}
