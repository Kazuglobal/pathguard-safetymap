import { getSafeNextPath } from "@/lib/auth/safe-next"

/** 自分でログアウトしたあとの行き先。どの画面からログアウトしても同じにする */
export const LOGGED_OUT_PATH = "/login?loggedOut=1"

/**
 * 保護された画面からログイン画面へ送るときの URL。
 * ログイン後に元の画面へ戻れるよう、戻り先(next)を必ず付ける。
 * 戻り先がアプリ内のパスとして不正なら next は付けない。
 */
export function loginPathFor(nextPath: string): string {
  const safe = getSafeNextPath(nextPath, "")
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login"
}
