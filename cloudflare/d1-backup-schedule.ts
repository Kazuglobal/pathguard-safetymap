/**
 * D1 日次バックアップの待ち方(ポーリング間隔と上限)。
 *
 * Workers Free では Workflow インスタンスあたりの外部サブリクエストが 50 件まで。
 * 開始 1 件 + ポーリング N 件 + ダウンロード 1 件 + 各 step のリトライ分が
 * この中に収まる必要がある。待ち時間(step.sleep)はサブリクエストを使わないので、
 * 回数を減らして間隔を広げれば、同じ予算で長いエクスポートを待てる。
 */
export const D1_EXPORT_MAX_POLLS = 30

/** ポーリング n 回目(1 始まり)の後に待つ秒数。5s → 10s → 20s → 30s → 以降 60s。 */
export function d1ExportPollDelaySeconds(attempt: number): number {
  if (attempt <= 1) return 5
  if (attempt === 2) return 10
  if (attempt === 3) return 20
  if (attempt === 4) return 30
  return 60
}

/** 全ポーリングを使い切ったときの合計待ち時間(秒)。エラーメッセージ用。 */
export function d1ExportTotalWaitSeconds(maxPolls: number = D1_EXPORT_MAX_POLLS): number {
  let total = 0
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) total += d1ExportPollDelaySeconds(attempt)
  return total
}
