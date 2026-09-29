import { describe, expect, it } from 'vitest'
import { evaluateReviewedNotes, sceneNotesSchema, type SceneNote } from '@/lib/hunter/routes/notes'

const note: SceneNote = { id: '11111111-1111-4111-8111-111111111111', source: 'observed',
  category: 'traffic', scenario: 'normal', photoIndex: 0, point: { x: 0.2, y: 0.8 },
  title: '曲がり角', evidence: '高いかべが写っている', detail: 'かべの向こうから自転車が来るかもしれない' }

describe('photo hazard notes', () => {
  it('requires evidence for an observed feature and bounds identifiers, coordinates and counts', () => {
    expect(sceneNotesSchema.safeParse([note]).success).toBe(true)
    for (const patch of [{ evidence: ' ' }, { photoIndex: -1 }, { photoIndex: 8 }, { point: { x: Infinity, y: 0 } },
      { point: { x: 0, y: 1.1 } }, { title: '' }, { source: 'detected' }, { photoUrl: 'https://elsewhere.test' }]) {
      expect(sceneNotesSchema.safeParse([{ ...note, ...patch }]).success).toBe(false)
    }
    expect(sceneNotesSchema.safeParse([{ ...note, source: 'imagined', evidence: '' }]).success).toBe(true)
    expect(sceneNotesSchema.safeParse([note, note]).success).toBe(false)
    expect(sceneNotesSchema.safeParse(Array.from({ length: 17 }, () => ({ ...note, id: crypto.randomUUID() }))).success).toBe(false)
  })
  it('requires all notes in the selected scenario and rejects invented, duplicate and other-scenario IDs', () => {
    const rainy: SceneNote = { ...note, id: '22222222-2222-4222-8222-222222222222', scenario: 'rain', source: 'imagined' }
    expect(evaluateReviewedNotes([note, rainy], 'normal')).toEqual({ invalid: false, complete: false })
    expect(evaluateReviewedNotes([note, rainy], 'normal', [note.id])).toEqual({ invalid: false, complete: true })
    for (const ids of [[note.id, note.id], [rainy.id], ['invented']]) expect(evaluateReviewedNotes([note, rainy], 'normal', ids).invalid).toBe(true)
    expect(evaluateReviewedNotes([], 'normal')).toEqual({ invalid: false, complete: true })
  })
})
