import { z } from 'zod'
import type { RouteHazardCategory, RouteScenario } from './curriculum'

export const NOTE_CATEGORIES: Record<RouteHazardCategory, string> = {
  traffic: '車・自転車・交差点', fall: '転落', water: '水路', construction: '工事',
  darkness: '暗い道', 'personal-safety': '防犯', rain: '大雨', earthquake: '地震',
}
export const NOTE_SOURCES = { observed: '写真で確認した特徴', imagined: '学習のための想定' } as const
export const MAX_SCENE_NOTES = 16
export const sceneNoteSchema = z.object({
  id: z.string().uuid(),
  photoIndex: z.number().int().min(0).max(7),
  point: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict(),
  category: z.enum(['traffic', 'fall', 'water', 'construction', 'darkness', 'personal-safety', 'rain', 'earthquake']),
  scenario: z.enum(['normal', 'rain', 'evening', 'earthquake']),
  source: z.enum(['observed', 'imagined']),
  title: z.string().trim().min(1, 'メモの名前を記入してください。').max(60, 'メモの名前は60文字以内にしてください。'),
  detail: z.string().trim().min(1, 'どんな危険を考えるか記入してください。').max(240, '危険の説明は240文字以内にしてください。'),
  evidence: z.string().trim().max(240),
}).strict().refine(note => note.source !== 'observed' || note.evidence.length > 0, {
  message: '写真で確認できた特徴を記入してください。', path: ['evidence'],
})
export type SceneNote = z.infer<typeof sceneNoteSchema>
export const sceneNotesSchema = z.array(sceneNoteSchema).max(MAX_SCENE_NOTES)
  .refine(notes => new Set(notes.map(note => note.id)).size === notes.length, '同じメモを重複して保存できません。')
export const saveSceneNotesSchema = z.object({
  revision: z.number().int().positive(), sceneId: z.string().uuid(), notes: sceneNotesSchema,
}).strict()

export function notesForScenario(notes: readonly SceneNote[], scenario: RouteScenario) {
  return notes.filter(note => note.scenario === scenario)
}

/** Check IDs against the saved scene, never the learner's claimed note list. */
export function evaluateReviewedNotes(notes: readonly SceneNote[], scenario: RouteScenario, reviewed: readonly string[] = []) {
  const required = notesForScenario(notes, scenario)
  const known = new Set(required.map(note => note.id))
  const seen = new Set(reviewed)
  const invalid = seen.size !== reviewed.length || reviewed.some(id => !known.has(id))
  return { invalid, complete: !invalid && required.every(note => seen.has(note.id)) }
}

export function routePhotoUrl(courseId: string, sceneId: string, photoIndex: number) {
  return `/api/hunter/routes/${encodeURIComponent(courseId)}/photos/${encodeURIComponent(sceneId)}/${photoIndex}`
}
