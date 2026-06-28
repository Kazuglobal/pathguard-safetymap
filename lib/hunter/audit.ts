// =============================================
// きけんハンター 監査ログ (Phase 1)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md
// hunter_audit_log への best-effort 書き込み。
// 監査の失敗が本処理を止めてはならないため throw せず console.error のみ。
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 監査ログを best-effort で記録する。
 * - hunter_audit_log に { actor_id, action, target_id } を insert。
 * - 失敗しても throw しない (本処理を止めない)。失敗は console.error で記録。
 */
export async function writeAuditLog(
  client: SupabaseClient,
  actorId: string,
  action: string,
  targetId: string,
): Promise<void> {
  try {
    const { error } = await client.from("hunter_audit_log").insert({
      actor_id: actorId,
      action,
      target_id: targetId,
    })

    if (error) {
      console.error("監査ログの記録に失敗しました:", error)
    }
  } catch (error) {
    console.error("監査ログの記録に失敗しました:", error)
  }
}
