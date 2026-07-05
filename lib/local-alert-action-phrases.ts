// 地域安全アラート（Layer 2）用「そなえの一言」ライブラリ
//
// 自動収集アラートには編集の手が入らないため、カテゴリ別のプリセットを
// アラートIDの決定的ハッシュでローテーション表示する。
// 「恐怖で終わらせない」原則: アラート1件につき必ず1つ添える。

import type { LocalAlertCategory } from "@/lib/notifications/builders"

export const LOCAL_ALERT_ACTION_PHRASES: Record<LocalAlertCategory, readonly string[]> = {
  suspicious: [
    "「つ・み・き・お・に」（ついていかない・みんなといる・きちんと知らせる・おおごえで助けを呼ぶ・にげる）を夕食のときに一緒に復唱する",
    "防犯ブザーが鳴るか・電池が残っているかを今夜いっしょに確認する",
    "通学路の「こども110番の家」の場所を子どもと1つ確認する",
  ],
  voice_call: [
    "「知らない人に誘われたら、その場で大声・すぐ逃げる」を今日の帰宅後に再確認する",
    "「名前や学校を聞かれても答えなくていい」と子どもに伝える",
  ],
  following: [
    "下校で1人になる区間を子どもと確認し、できるだけ2人以上で歩ける待ち合わせを決める",
    "「後ろが気になったらお店やこども110番の家に入っていい」と伝える",
  ],
  other: [
    "アプリのマップで通学路の危険箇所を1分だけ見直す",
  ],
}

/** アラートごとに決定的に1つ選ぶ（同じアラートには常に同じ一言が出る） */
export function getActionPhraseForAlert(alertId: string, category: string): string {
  const phrases =
    (LOCAL_ALERT_ACTION_PHRASES as Record<string, readonly string[]>)[category] ??
    LOCAL_ALERT_ACTION_PHRASES.other
  return phrases[hashString(alertId) % phrases.length]
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}
