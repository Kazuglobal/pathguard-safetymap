// 画面ごとの、スマホ下部タブバーの出し分け（純粋関数）

/** 地図は画面の高さを全部使う（2026-10-08 ユーザー要望）。他の画面へはボタン列の「メニュー」から移る。 */
const PATHS_WITHOUT_MOBILE_BOTTOM_NAV = new Set(['/map'])

export function shouldShowMobileBottomNav(pathname: string): boolean {
  return !PATHS_WITHOUT_MOBILE_BOTTOM_NAV.has(pathname)
}

/**
 * 画面下に浮かぶお願い(通知の許可・ホーム画面への追加)を出してよい画面か。
 * 子どもが遊ぶきけんハンター/クエスト、全画面の地図、紹介ページ、ログイン系の画面では出さない
 * (ゲームのボタンや地図の操作を覆ってしまうため)。
 */
const PREFIXES_WITHOUT_FLOATING_PROMPTS = ['/safety-quest', '/map', '/lp', '/login', '/register', '/forgot-password', '/reset-password']

export function shouldShowFloatingPrompts(pathname: string): boolean {
  return !PREFIXES_WITHOUT_FLOATING_PROMPTS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
