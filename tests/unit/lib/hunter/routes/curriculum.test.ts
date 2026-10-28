import { describe, expect, it } from 'vitest'
import { evaluateRouteAttempt, getScenarioCurriculum, HAZARD_CURRICULUM, ROUTE_SCENARIOS, type RouteAttempt, type RouteScenario } from '@/lib/hunter/routes/curriculum'

function correctAttempt(scenario: RouteScenario = 'normal'): RouteAttempt {
  const lessons = getScenarioCurriculum(scenario, 9)
  return { scenario, foundIds: lessons.map(lesson => lesson.id), answers: lessons.map(lesson => ({ hazardId: lesson.id, prediction: lesson.questions.prediction.correctId, reason: lesson.questions.reason.correctId, action: lesson.questions.action.correctId })) }
}

describe('route curriculum', () => {
  it('covers every requested hazard category across the initial scenarios', () => {
    const categories = new Set(ROUTE_SCENARIOS.flatMap(scenario => getScenarioCurriculum(scenario.id, 1).map(lesson => lesson.category)))
    expect([...categories].sort()).toEqual(['construction', 'darkness', 'earthquake', 'fall', 'personal-safety', 'rain', 'traffic', 'water'])
    expect(new Set(HAZARD_CURRICULUM.map(lesson => lesson.id)).size).toBe(HAZARD_CURRICULUM.length)
    expect(HAZARD_CURRICULUM.every(lesson => lesson.provenance === 'imagined')).toBe(true)
  })
  it('keeps the correct choice available with two options for young learners and three for older students', () => {
    for (const scenario of ROUTE_SCENARIOS) {
      for (const year of [1, 3, 4, 6, 9]) {
        for (const lesson of getScenarioCurriculum(scenario.id, year)) {
          for (const question of Object.values(lesson.questions)) {
            expect(question.choices).toHaveLength(year <= 3 ? 2 : 3)
            expect(question.choices.some(choice => choice.id === question.correctId)).toBe(true)
          }
        }
      }
    }
  })
  it('adds multiple interacting hazards to older students without modifying the base definitions', () => {
    const [young] = getScenarioCurriculum('normal', 1)
    const [older] = getScenarioCurriculum('normal', 9)
    expect(older.situation).toContain(older.advanced)
    expect(young.situation).not.toContain(young.advanced)
    expect(HAZARD_CURRICULUM[0].questions.action.choices).toHaveLength(3)
  })
})

describe('server route attempt evaluation', () => {
  it('requires both finding every hazard and all three correct decisions', () => {
    expect(evaluateRouteAttempt(correctAttempt())).toEqual({ cleared: true, correct: 5, total: 5, invalid: false })
    for (const kind of ['prediction', 'reason', 'action'] as const) {
      const attempt = correctAttempt()
      attempt.answers[0][kind] = 'wrong'
      expect(evaluateRouteAttempt(attempt)).toMatchObject({ cleared: false, correct: 4 })
    }
    const attempt = correctAttempt()
    attempt.foundIds.pop()
    expect(evaluateRouteAttempt(attempt)).toMatchObject({ cleared: false, correct: 4 })
  })
  it('does not award completion for partial or empty lessons', () => {
    expect(evaluateRouteAttempt({ scenario: 'normal', foundIds: [], answers: [] })).toMatchObject({ cleared: false, correct: 0, invalid: false })
    const attempt = correctAttempt()
    attempt.answers.pop()
    expect(evaluateRouteAttempt(attempt)).toMatchObject({ cleared: false, correct: 4 })
  })
  it.each(['rain', 'evening', 'earthquake'] as const)('locks %s until the stored normal clear has been checked by the caller', scenario => {
    expect(evaluateRouteAttempt(correctAttempt(scenario))).toMatchObject({ cleared: false, invalid: true })
    expect(evaluateRouteAttempt(correctAttempt(scenario), true)).toMatchObject({ cleared: true, invalid: false })
  })
  it('rejects duplicate hazard answers rather than counting them twice', () => {
    const attempt = correctAttempt()
    attempt.answers[1] = attempt.answers[0]
    expect(evaluateRouteAttempt(attempt)).toMatchObject({ cleared: false, invalid: true })
  })
  it('rejects duplicated and unknown discovery IDs', () => {
    const attempt = correctAttempt()
    attempt.foundIds[1] = attempt.foundIds[0]
    expect(evaluateRouteAttempt(attempt).invalid).toBe(true)
    attempt.foundIds[1] = 'fabricated-observation'
    expect(evaluateRouteAttempt(attempt).invalid).toBe(true)
  })
  it('rejects answers for different scenario hazards and excess entries', () => {
    const attempt = correctAttempt()
    attempt.answers[0].hazardId = 'shaking-street'
    expect(evaluateRouteAttempt(attempt).invalid).toBe(true)
    const excess = correctAttempt()
    excess.answers.push(excess.answers[0])
    expect(evaluateRouteAttempt(excess).invalid).toBe(true)
  })
  it('fails closed on unknown scenarios and malformed runtime input', () => {
    expect(evaluateRouteAttempt({ ...correctAttempt(), scenario: '__proto__' } as unknown as RouteAttempt).invalid).toBe(true)
    expect(evaluateRouteAttempt(null as unknown as RouteAttempt).invalid).toBe(true)
    expect(evaluateRouteAttempt({ scenario: 'normal', answers: null, foundIds: [] } as unknown as RouteAttempt).invalid).toBe(true)
    expect(evaluateRouteAttempt({ scenario: 'normal', answers: [null], foundIds: [] } as unknown as RouteAttempt).invalid).toBe(true)
  })
})
