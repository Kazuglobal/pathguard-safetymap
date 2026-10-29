// PWAインストール状態の判定ユーティリティ
//
// iOS Safari の Web Push は「ホーム画面に追加された PWA(standalone起動)」で
// のみ動作するため、iOS×非standalone のユーザーには通知許可の代わりに
// 「ホーム画面に追加」の案内を出す必要がある。

/**
 * iOS端末(iPhone / iPad / iPod)かどうかを UA から判定する。
 * iPadOS 13以降の Safari は "Macintosh" を名乗るため、
 * タッチポイント数との組み合わせで判定する。
 */
export function isIosDevice(
  userAgent: string,
  maxTouchPoints: number
): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true
  }
  // iPadOS 13+ のデスクトップ表示モード(UAはMacだがタッチ対応)
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

/**
 * iOS の Web Push 非対応バージョン(16.4未満)だと「明確に」判定できるか。
 * 16.4未満のユーザーにホーム画面追加を案内しても通知は使えず無駄骨になるため、
 * 確実に古いと分かる場合のみ案内を抑制する。
 * バージョンがUAから取れない場合は false(=案内を出す側)に倒す。
 */
export function isIosPushIncapableVersion(userAgent: string): boolean {
  // 例: "CPU iPhone OS 16_3 like Mac OS X" / iPadは "CPU OS 16_3 like Mac OS X"
  const ios = userAgent.match(/OS (\d+)[._](\d+)(?:[._]\d+)? like Mac OS X/)
  // iPadOSデスクトップ表示はMac UAでOSバージョンを持たないため、
  // Safari の Version トークンで代替判定する(SafariバージョンはiOSバージョンに追随)
  const m = ios ?? userAgent.match(/Version\/(\d+)\.(\d+)/)
  if (!m) return false

  const major = Number(m[1])
  const minor = Number(m[2])
  if (major !== 16) return major < 16
  return minor < 4
}

/**
 * ホーム画面から standalone 表示で起動されているかどうか。
 * ブラウザタブ内での閲覧なら false。
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false

  if (window.matchMedia?.("(display-mode: standalone)")?.matches) {
    return true
  }
  // iOS Safari 独自プロパティ
  return (window.navigator as { standalone?: boolean }).standalone === true
}

/**
 * 通知を受け取れない理由(マイページの通知カードで、カードを消さずに理由を出すため。UIUX改装 項目37)。
 * - ios-needs-home-screen: iPhone・iPad のブラウザで開いている。ホーム画面に追加すると受け取れる
 * - ios-too-old: iOS 16.4 より前で、Web の通知に対応していない
 * - browser: このブラウザ(アプリ内ブラウザなど)が通知に対応していない
 */
export type PushUnavailableReason = "ios-needs-home-screen" | "ios-too-old" | "browser"

export function getPushUnavailableReason(): PushUnavailableReason {
  if (typeof window === "undefined") return "browser"
  const ua = window.navigator.userAgent
  if (!isIosDevice(ua, window.navigator.maxTouchPoints ?? 0)) return "browser"
  if (isIosPushIncapableVersion(ua)) return "ios-too-old"
  return isStandaloneDisplayMode() ? "browser" : "ios-needs-home-screen"
}

/**
 * 「ホーム画面に追加」案内を出すべき状態か。
 * = iOS端末 かつ ブラウザタブ内(非standalone) かつ Push対応バージョン(16.4+)
 */
export function shouldShowIosInstallGuide(): boolean {
  if (typeof window === "undefined") return false
  const ua = window.navigator.userAgent
  return (
    isIosDevice(ua, window.navigator.maxTouchPoints ?? 0) &&
    !isStandaloneDisplayMode() &&
    !isIosPushIncapableVersion(ua)
  )
}
