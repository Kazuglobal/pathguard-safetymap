import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import LoginForm from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { getSafeNextPath } from "@/lib/auth/safe-next"
import { tankenTokens } from "@/lib/design/tanken"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "ログイン" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; loggedOut?: string | string[]; deleted?: string | string[] }>
}) {
  const params = await searchParams
  const nextPath = getSafeNextPath(params.next)
  const justLoggedOut = params.loggedOut === "1"
  // 退会(設定 > アカウントを削除)のあと
  const justDeleted = params.deleted === "1"
  const supabase = await createServerClient()

  if (!supabase) {
    // 以前は存在しない /error へ飛ばしていた。その場で日本語の案内を出す
    console.error("Failed to create Supabase server client.")
    return (
      <AuthShell title="ログイン">
        <div role="alert" className="w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-base font-bold text-red-800">ログイン画面を表示できませんでした</p>
          <p className="mt-2 text-sm text-red-700">時間をおいて、このページを再読み込みしてください。</p>
        </div>
      </AuthShell>
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

  // ロゴ・「PathGuardianとは」・1行の紹介・「無料・インストール不要」・ルペは AuthShell が出す(UIUX改装 項目1・15)
  return (
    <AuthShell title="ログイン" intro>
      {(justLoggedOut || justDeleted) && (
        <p
          role="status"
          className="mb-4 rounded-xl border px-4 py-3 text-center text-sm font-bold"
          style={{
            background: tankenTokens.color.primarySoft,
            borderColor: tankenTokens.border.soft,
            color: tankenTokens.color.primaryStrong,
          }}
        >
          {justDeleted ? "アカウントを削除しました。ご利用ありがとうございました。" : "ログアウトしました"}
        </p>
      )}
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  )
}
