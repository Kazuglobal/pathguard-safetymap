export type RouteScenario = 'normal' | 'rain' | 'evening' | 'earthquake'

/** School year: primary 1–6; secondary 7–9. */
export function learningProfile(schoolYear: number) {
  if (!Number.isInteger(schoolYear) || schoolYear < 1 || schoolYear > 9) {
    throw new RangeError('学年を1〜9で指定してください')
  }
  const band = schoolYear <= 2 ? 'lower' : schoolYear <= 4 ? 'middle' : schoolYear <= 6 ? 'upper' : 'secondary'
  return { band, readAloud: schoolYear <= 2, furigana: schoolYear <= 6, maxChoices: schoolYear <= 2 ? 2 : 3 }
}

export interface EvaluatedHazard {
  hazardId: string
  found: boolean
  predictionCorrect: boolean
  reasonCorrect: boolean
  actionCorrect: boolean
}

/** Trusted server evaluation only. These booleans must never be accepted
 * directly from a submitted client payload in lieu of checking answer keys.
 */
export function stageCleared(requiredHazardIds: readonly string[], evaluations: readonly EvaluatedHazard[]): boolean {
  if (!requiredHazardIds.length || new Set(requiredHazardIds).size !== requiredHazardIds.length) return false
  const byId = new Map(evaluations.map(result => [result.hazardId, result]))
  if (byId.size !== evaluations.length) return false
  return requiredHazardIds.every(id => {
    const result = byId.get(id)
    return result?.found === true && result.predictionCorrect === true && result.reasonCorrect === true && result.actionCorrect === true
  })
}

/** Use persisted clears for the SAME course version, never client claims. */
export function scenarioUnlocked(scenario: RouteScenario, normalStageIds: readonly string[], clearedStageIds: readonly string[]): boolean {
  if (scenario === 'normal') return true
  const cleared = new Set(clearedStageIds)
  return normalStageIds.length > 0 && normalStageIds.every(id => cleared.has(id))
}
