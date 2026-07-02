// =============================================
// きけんハンター 観測性 (構造化ログ)
// AI失敗系をすべて 200/guide で吸収するため、HTTPステータスでは
// 障害を検知できない。fallbackReason を構造化ログに必ず残し、
// ai_error/parse_error 率のアラートを可能にする。
// =============================================

import type { HunterFallbackReason } from "@/lib/hunter/types"

/**
 * 解析がガイドモードへフォールバックした事実を記録する。
 * - 構造化 console.warn(常に)。テストから spy できるよう単一呼び出しに集約。
 * - Sentry が利用可能なら warning メッセージも送る(ai_error/parse_error 率の監視用)。
 *   未初期化/未導入でも無害(動的import + try/catch)。
 */
export function logAnalyzeFallback(
  reason: HunterFallbackReason,
  sessionId: string,
): void {
  console.warn(
    JSON.stringify({
      event: "hunter_analyze_fallback",
      reason,
      sessionId,
    }),
  )
  void reportToSentry(reason, sessionId)
}

async function reportToSentry(
  reason: HunterFallbackReason,
  sessionId: string,
): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs")
    Sentry.captureMessage?.(`hunter_analyze_fallback:${reason}`, {
      level: "warning",
      tags: { feature: "hunter", hunter_fallback_reason: reason },
      extra: { sessionId },
    })
  } catch {
    // Sentry 未初期化/未導入は無害(構造化ログは出ている)
  }
}
