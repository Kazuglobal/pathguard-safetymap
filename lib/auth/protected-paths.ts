/**
 * ログインが必要なルートの接頭辞一覧。
 * middleware(サーバ側のリダイレクト)と、ログアウトを検知したときのクライアント側の移動で共有する。
 */
export const PROTECTED_PREFIXES = [
  '/map',
  '/dashboard',
  '/report',
  '/mypage',
  '/badges',
  '/missions',
  '/leaderboard',
  '/routes',
  '/hazard-game',
  '/route-quiz',
  '/3d-route-poc',
  '/xroad',
  '/admin',
  '/tools',
  // きけんハンターはページ側でもログインを確かめるが、ここにも載せて
  // ログアウトを検知したときにその場でログインへ移す(ハブの /safety-quest は公開のまま)
  '/safety-quest/hunter',
] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}
