import { describe, expect, it } from 'vitest'
import { learningProfile, stageCleared, scenarioUnlocked } from '@/lib/hunter/routes/learning'

describe('route learning', () => {
  it('automatically adapts to school year without removing safety decisions', () => {
    expect(learningProfile(1)).toEqual({ band: 'lower', readAloud: true, furigana: true, maxChoices: 2 })
    expect(learningProfile(4).band).toBe('middle')
    expect(learningProfile(6).band).toBe('upper')
    expect(learningProfile(9).band).toBe('secondary')
  })
  it.each([0, 10, 1.5, NaN])('rejects invalid school year %s', grade => {
    expect(() => learningProfile(grade)).toThrow()
  })
  it('requires finding, prediction, reason, and action for every required hazard', () => {
    const correct = { hazardId: 'blind-corner', found: true, predictionCorrect: true, reasonCorrect: true, actionCorrect: true }
    expect(stageCleared(['blind-corner'], [correct])).toBe(true)
    for (const field of ['found', 'predictionCorrect', 'reasonCorrect', 'actionCorrect'] as const) {
      expect(stageCleared(['blind-corner'], [{ ...correct, [field]: false }])).toBe(false)
    }
    expect(stageCleared(['blind-corner', 'canal'], [correct])).toBe(false)
    expect(stageCleared([], [])).toBe(false)
    expect(stageCleared(['blind-corner'], [correct, correct])).toBe(false)
  })
  it('unlocks variations only after every normal stage is cleared', () => {
    expect(scenarioUnlocked('normal', ['a', 'b'], [])).toBe(true)
    expect(scenarioUnlocked('rain', ['a', 'b'], ['a'])).toBe(false)
    expect(scenarioUnlocked('earthquake', ['a', 'b'], ['a', 'b'])).toBe(true)
    expect(scenarioUnlocked('evening', [], [])).toBe(false)
  })
})
