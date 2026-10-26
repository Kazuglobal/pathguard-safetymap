// 画面ごとの、スマホ下部タブバーの出し分け（純粋関数）

/** 地図は画面の高さを全部使う（2026-10-08 ユーザー要望）。他の画面へはボタン列の「メニュー」から移る。 */
const PATHS_WITHOUT_MOBILE_BOTTOM_NAV = new Set(['/map'])

export function shouldShowMobileBottomNav(pathname: string): boolean {
  return !PATHS_WITHOUT_MOBILE_BOTTOM_NAV.has(pathname)
}
