// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyPhotoQuizAnswer, buildPhotoQuizState, photoQuizView } from '@/lib/hunter/routes/photo-quiz-engine'
import { photoQuizItemSchema, type PhotoQuizAnswer, type PhotoQuizItem } from '@/lib/hunter/routes/photo-quiz-schema'
const item: PhotoQuizItem = { id: crypto.randomUUID(), sceneId: crypto.randomUUID(), photoIndex: 0, title: 'かべの向こう', templateId: 'hidden-traffic', scenario: 'normal', observed: 'かべで先が見えにくい', hypothetical: 'もし自転車が来たら？', region: { x: .2, y: .3, width: .2, height: .3 } }
const answer = (fields: Partial<PhotoQuizAnswer>): PhotoQuizAnswer => ({ kind: 'point', requestId: crypto.randomUUID(), version: 0, ...fields })
describe('photo quiz learning sequence', () => {
  it('withholds the region and correct IDs before an answer', () => {
    const state = buildPhotoQuizState('東側コース', 1, [item])
    const view = photoQuizView(state, { id: 'session', version: 0, courseId: 'course', revision: 1, scenario: 'normal' })
    expect(view.item?.region).toBeUndefined()
    expect(view.item?.observed).toBeUndefined()
    expect(JSON.stringify(view)).not.toContain(state.lessons[0].reason.correctId)
    expect(state.lessons[0].reason.choices).toHaveLength(2)
  })
  it('requires finding, reason and safe action before a completed stage', () => {
    let state = buildPhotoQuizState('東側コース', 8, [item])
    expect(() => applyPhotoQuizAnswer(state, answer({ kind: 'next' }))).toThrow()
    state = applyPhotoQuizAnswer(state, answer({ point: { x: .25, y: .4 } }))
    expect(state.stage).toBe('reason')
    state = applyPhotoQuizAnswer(state, answer({ kind: 'choice', choiceId: state.lessons[0].reason.correctId }))
    expect(state.stage).toBe('action')
    state = applyPhotoQuizAnswer(state, answer({ kind: 'choice', choiceId: state.lessons[0].action.correctId }))
    expect(state.stage).toBe('feedback')
    state = applyPhotoQuizAnswer(state, answer({ kind: 'next' }))
    expect(state.stage).toBe('complete')
  })
  it('records help without awarding discovery or completion', () => {
    const initial = buildPhotoQuizState('東側コース', 1, [item])
    const hinted = applyPhotoQuizAnswer(initial, answer({ kind: 'hint' }))
    expect(hinted.lessons[0]).toMatchObject({ hintUsed: true, found: false, actionCorrect: false })
    expect(initial.lessons[0].hintUsed).toBe(false)
    const missed = applyPhotoQuizAnswer(hinted, answer({ point: { x: .9, y: .9 } }))
    expect(missed.stage).toBe('find')
    expect(missed.feedback?.text).not.toContain('安全')
  })
  it('rejects rectangles extending outside the processed photo', () => {
    expect(photoQuizItemSchema.safeParse({ ...item, region: { x: .9, y: 0, width: .2, height: .2 } }).success).toBe(false)
  })
  it('adjusts prompts and prediction reasoning across four grade bands', () => {
    const grades = [1, 3, 5, 8].map(year => buildPhotoQuizState('東側コース', year, [item]).lessons[0])
    expect(new Set(grades.map(lesson => lesson.reason.prompt)).size).toBe(4)
    expect(grades.map(lesson => lesson.reason.choices.length)).toEqual([2, 3, 3, 3])
    for (const lesson of grades.slice(2)) expect(lesson.reason.choices.find(choice => choice.id === lesson.reason.correctId)?.text).toContain('かげから車や自転車が出てくる。')
  })
})
