/**
 * 画面の上でボタンの位置を指す案内(components/map/spot-guide.tsx)を、見たかどうかの記録。
 * 絵本のはじめての案内(lib/tutorial-storage.ts)とは別に持つ。
 */

export type SpotGuideId = "map" | "map-details" | "ar"

const STORAGE_KEYS: Record<SpotGuideId, string> = {
  map: "pathguard-map-guide",
  "map-details": "pathguard-map-details-guide",
  ar: "pathguard-ar-guide",
}

/** 案内の中身(手順や指す場所)を大きく変えたら上げる。上げると、もう一度だけ出る */
const GUIDE_VERSIONS: Record<SpotGuideId, number> = {
  map: 1,
  "map-details": 1,
  ar: 1,
}

/**
 * まだ見ていない(または版が上がった)ときに true。
 * 保存先が使えない環境(プライベートブラウズなど)では、見た記録を残せず毎回出てしまうので、出さない。
 */
export function shouldShowSpotGuide(id: SpotGuideId): boolean {
  // 自動操作のブラウザ(Playwright の E2E・scripts/ui-audit.mjs など)では、自分からは出さない。
  // 出すと全面の案内が操作をふさぎ、/map を開く既存のスペックがすべて止まる。「使い方」からは出せる
  if (typeof navigator !== "undefined" && navigator.webdriver) return false
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[id])
    if (!stored) return true
    const parsed: unknown = JSON.parse(stored)
    const seenVersion =
      typeof parsed === "object" && parsed !== null && typeof (parsed as { version?: unknown }).version === "number"
        ? (parsed as { version: number }).version
        : 0
    return seenVersion < GUIDE_VERSIONS[id]
  } catch {
    return false
  }
}

export function markSpotGuideSeen(id: SpotGuideId): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS[id],
      JSON.stringify({ version: GUIDE_VERSIONS[id], seenAt: new Date().toISOString() }),
    )
  } catch {
    // 保存できなくても案内そのものは閉じる(shouldShowSpotGuide が出さない側に倒す)
  }
}
