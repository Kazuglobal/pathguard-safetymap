// =============================================
// きけんハンター フォールバック危険ポイント (Phase 0)
// 事故0件 + AI検出0件の「ダブル空」でもゲームを成立させるための
// 写真非依存の汎用「気をつけるポイント」集合と解決関数。
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md
// =============================================

import type { HunterHazard } from "@/lib/hunter/types"

/**
 * 写真に依存しない、通学路に共通する一般的な「気をつけるポイント」。
 * region は互いに重ならない相対座標 (0..1)。やさしい日本語で、
 * 子どもを否定せず・断定しない表現にする。confidence は中程度。
 */
export const GENERIC_HUNTER_HAZARDS: readonly HunterHazard[] = [
  {
    id: "generic-0",
    type: "見通しの悪い角",
    region: { x: 0.05, y: 0.1, w: 0.3, h: 0.35 },
    severity: "high",
    kidExplanation: "曲がり角は むこうが見えにくいことがあるよ。",
    safeAction: "いちど とまって、左右をよく見てみよう。",
    confidence: 0.5,
  },
  {
    id: "generic-1",
    type: "車のかげ",
    region: { x: 0.4, y: 0.1, w: 0.3, h: 0.35 },
    severity: "medium",
    kidExplanation: "とまっている車のかげから 人や車が出てくることがあるよ。",
    safeAction: "車のそばを通るときは ゆっくり歩いてみよう。",
    confidence: 0.5,
  },
  {
    id: "generic-2",
    type: "せまい歩道",
    region: { x: 0.05, y: 0.55, w: 0.3, h: 0.35 },
    severity: "low",
    kidExplanation: "歩道がせまいと 車道に近くなることがあるよ。",
    safeAction: "なるべく 道のはしっこを歩いてみよう。",
    confidence: 0.5,
  },
  {
    id: "generic-3",
    type: "横断するところ",
    region: { x: 0.4, y: 0.55, w: 0.3, h: 0.35 },
    severity: "medium",
    kidExplanation: "道をわたるところは 車が来ることがあるよ。",
    safeAction: "手をあげて 車が止まったのを見てからわたろう。",
    confidence: 0.5,
  },
]

/**
 * 探索ターゲットを決める。AIが危険を検出していればそれを優先し、
 * 検出が空のときだけ汎用フォールバックを返す。純粋・非破壊。
 */
export function resolveExploreTargets(
  detected: readonly HunterHazard[],
): readonly HunterHazard[] {
  return detected.length > 0 ? detected : GENERIC_HUNTER_HAZARDS
}
