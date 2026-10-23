import { describe, expect, it } from 'vitest'
import { getMissedRouteCategories, getScenarioCurriculum } from '@/lib/hunter/routes/curriculum'

describe('teacher review categories', () => {
  it('does not label unanswered questions as weaknesses', () => {
    const lesson = getScenarioCurriculum('normal', 1)[0]
    expect(getMissedRouteCategories('normal', [{ hazardId: lesson.id, prediction: '', reason: '', action: '' }])).toEqual([])
  })
  it('preserves a mistaken category after the final answer is corrected', () => {
    const lesson = getScenarioCurriculum('normal', 1)[0]
    const correct = { hazardId: lesson.id, prediction: lesson.questions.prediction.correctId, reason: lesson.questions.reason.correctId, action: lesson.questions.action.correctId }
    const wrong = { ...correct, action: lesson.questions.action.choices.find(choice => choice.id !== lesson.questions.action.correctId)!.id }
    expect(getMissedRouteCategories('normal', [wrong, wrong, correct])).toEqual([lesson.category])
    expect(getMissedRouteCategories('normal', [correct])).toEqual([])
  })
  it('ignores invented hazards or choice identifiers', () => {
    const lesson = getScenarioCurriculum('normal', 1)[0]
    expect(getMissedRouteCategories('normal', [{ hazardId: lesson.id, prediction: 'invented', reason: '', action: '' }, { hazardId: 'invented', prediction: 'risk', reason: '', action: '' }])).toEqual([])
  })
})
