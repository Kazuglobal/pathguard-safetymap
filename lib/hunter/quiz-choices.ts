// =============================================
// きけんハンター 4択の決定的シャッフル (純粋ロジック)
// quiz.ts (AI連動クイズ) と fallback-hazards.ts (ガイドクイズ) で共有する。
// ループ index だけを回転量にすると、正解の表示位置が写真・セッションを
// またいで完全に固定化され(例: 1問目=常に4番目)、記憶されて解けてしまう。
// 呼び出し側が渡す「セッション/設問固有の seed 文字列」から回転量を導くことで、
// 採点は決定的なまま、正解位置はセッションごとに変わるようにする。
// =============================================

import type { HunterQuizChoice } from "./types"

/** 文字列から非負整数ハッシュを導く(seed用、暗号強度は不要)。 */
function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/**
 * ラベル配列(index0=正解)を、seed に応じて決定的に回転した4択にする。
 * seed には、写真/セッションをまたいで固定化されない一意な文字列
 * (例: `hazard.id`。既に sessionId を含む)を渡すこと。
 */
export function buildRotatedChoices(
  labels: readonly string[],
  seed: string,
): { choices: HunterQuizChoice[]; correctChoiceId: string } {
  const limited = labels.slice(0, 4)
  const withIds: HunterQuizChoice[] = limited.map((label, i) => ({ id: `c${i}`, label }))
  const correctChoiceId = "c0"
  if (withIds.length === 0) return { choices: withIds, correctChoiceId }
  const shift = hashSeed(seed) % withIds.length
  const rotated = withIds.slice(shift).concat(withIds.slice(0, shift))
  return { choices: rotated, correctChoiceId }
}
