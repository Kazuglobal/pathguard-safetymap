import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js"
import { redirect, unstable_rethrow } from "next/navigation"

import { createServerClient } from "@/lib/supabase-server"
import { loginPathFor } from "@/lib/auth/login-path"
import { HunterGame } from "@/components/safety-quest/hunter/hunter-game"
import { HunterAuthRetry } from "./hunter-auth-retry"

export const metadata = {
  title: "きけんハンター",
}

const HUNTER_PATH = "/safety-quest/hunter"
/** ログインのあと、このページへ戻ってくる(next が無いと /login は /map へ送る)。 */
const LOGIN_PATH = loginPathFor(HUNTER_PATH)

type HunterViewer =
  | { kind: "signed-in"; userId: string }
  | { kind: "signed-out" }
  | { kind: "unknown" }

/**
 * ログイン状態を 3 つに分ける。
 * - signed-out: セッションが無い(未ログイン・ログアウト済み)。ログインへ送ってよい。
 * - unknown: 通信エラーなどで確かめられなかった。/login は Cookie のセッションを見て
 *   next(=このページ)へすぐ戻すので、ここでログインへ送ると往復が止まらなくなる。
 */
async function resolveHunterViewer(): Promise<HunterViewer> {
  const supabase = await createServerClient()
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) return { kind: "signed-in", userId: data.user.id }
    if (!error || isAuthSessionMissingError(error)) return { kind: "signed-out" }
    // 期限切れ・無効なセッション(4xx の認証エラー)もログインへ。ログイン画面は getUser で確かめ直すので、
    // Cookie が残っていても行ったり来たりにはならない
    const authStatus = isAuthApiError(error as unknown) ? (error as { status?: number }).status : undefined
    if (typeof authStatus === "number" && authStatus >= 400 && authStatus < 500) return { kind: "signed-out" }
    console.error("きけんハンター: ログイン状態を確かめられませんでした", error)
    return { kind: "unknown" }
  } catch (error) {
    unstable_rethrow(error)
    console.error("きけんハンター: ログイン状態の確認中にエラーが起きました", error)
    return { kind: "unknown" }
  }
}

export default async function HunterPage() {
  const viewer = await resolveHunterViewer()

  if (viewer.kind === "signed-out") {
    redirect(LOGIN_PATH)
  }

  if (viewer.kind === "unknown") {
    return <HunterAuthRetry />
  }

  return <HunterGame userId={viewer.userId} />
}
