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
] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}
