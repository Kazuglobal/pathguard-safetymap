// =============================================
// きけんハンター「あんぜん さがし」の語彙 (純粋・定数のみ)
// 写真の中の「安全の工夫」の種類と、「どうして あんしん？」の答え(子ども向け)。
//  - 種類は英語 enum(ロジック用・画面には出さない)。AI が付け忘れたら kidType から推定する。
//  - 理由文の漢字は furigana 辞書(lib/hunter/furigana.ts)でルビが付くものだけにする。
// =============================================

/** 安全の工夫の種類(閉じた語彙)。 */
export const HUNTER_SAFE_KINDS = [
  "guardrail", // ガードレール・さく
  "sidewalk", // 歩道・路側帯
  "curve_mirror", // カーブミラー
  "traffic_signal", // 信号
  "crosswalk", // 横断歩道
  "street_light", // 街灯
  "other",
] as const

export type HunterSafeKind = (typeof HUNTER_SAFE_KINDS)[number]

const SAFE_KIND_SET: ReadonlySet<string> = new Set(HUNTER_SAFE_KINDS)

export function isHunterSafeKind(value: unknown): value is HunterSafeKind {
  return typeof value === "string" && SAFE_KIND_SET.has(value)
}

/**
 * kidType(やさしい日本語の種類名)から種類を推定する。AI が safeKind を付け忘れたとき用。
 * 「横断歩道」は「歩道」より先に見る(含む語を取り違えない)。分からなければ other。
 */
const SAFE_KIND_KEYWORDS: ReadonlyArray<readonly [RegExp, HunterSafeKind]> = [
  [/横断歩道|おうだんほどう|しましま/, "crosswalk"],
  [/ガードレール|ガードパイプ|さく|柵|フェンス|ポール/, "guardrail"],
  [/ミラー|かがみ/, "curve_mirror"],
  [/信号|しんごう/, "traffic_signal"],
  [/街灯|がいとう|ライト|あかり|電灯/, "street_light"],
  [/歩道|ほどう|路側帯|ろそくたい|グリーンベルト|みどりの 線|白線/, "sidewalk"],
]

export function inferSafeKind(kidType: unknown): HunterSafeKind {
  if (typeof kidType !== "string") return "other"
  const hit = SAFE_KIND_KEYWORDS.find(([re]) => re.test(kidType))
  return hit ? hit[1] : "other"
}

/** AI の safeKind を正規化する。無い・未知なら kidType から推定する。 */
export function normalizeSafeKind(safeKind: unknown, kidType: unknown): HunterSafeKind {
  if (isHunterSafeKind(safeKind) && safeKind !== "other") return safeKind
  const inferred = inferSafeKind(kidType)
  return inferred !== "other" ? inferred : isHunterSafeKind(safeKind) ? safeKind : "other"
}

/**
 * 種類 -> 「どうして あんしん？」の答え(〜から)。3択に並ぶので長さをそろえる。
 * other は理由を問えないので null = 質問しない。
 */
export const KID_SAFE_REASON_BY_KIND: Readonly<Record<HunterSafeKind, string | null>> = {
  guardrail: "車が 歩く ところに はいらない から",
  sidewalk: "車の 道と わかれて 歩ける から",
  curve_mirror: "角の むこうの 車が 見える から",
  traffic_signal: "止まる じゅんばんが きまる から",
  crosswalk: "わたる ところが 車に わかる から",
  street_light: "くらくても 見つけて もらえる から",
  other: null,
}

/** 正解と並べると どちらも正しく見える組(誤答に使わない)。 */
export const CONFUSABLE_SAFE_KIND_GROUPS: ReadonlyArray<ReadonlyArray<HunterSafeKind>> = [
  ["guardrail", "sidewalk"],
  ["traffic_signal", "crosswalk"],
]
