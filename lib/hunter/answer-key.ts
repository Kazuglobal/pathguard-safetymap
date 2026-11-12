// =============================================
// きけんハンター 正解鍵の組み立て (純粋ロジック)
// analyze / photo の両ルートが、同じ形で正解鍵(answer-cache)へ載せるための変換。
// IO を持つ answer-cache.ts と分けておく(ルートのテストが answer-cache を丸ごとモックするため)。
// =============================================

import type { CachedHazardKey } from "@/lib/hunter/answer-cache"
import type { HunterHazard } from "@/lib/hunter/types"

/** 危険 → 正解鍵(採点に要る項目だけ。説明文などは載せない)。 */
export function toCachedHazardKey(hazard: HunterHazard): CachedHazardKey {
  return {
    id: hazard.id,
    region: hazard.region,
    severity: hazard.severity,
    confidence: hazard.confidence,
    ...(hazard.kind ? { kind: hazard.kind } : {}),
    ...(hazard.hitRegion ? { hitRegion: hazard.hitRegion } : {}),
    ...(hazard.focusPoint ? { focusPoint: hazard.focusPoint } : {}),
  }
}
