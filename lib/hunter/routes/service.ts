import 'server-only'
import { z } from 'zod'
import type { Actor } from '@/lib/db/authz'
import { createCourse, getCourse, getRouteDatabase, readSchoolMembership, RepositoryError, requireRouteUser, updateCourseOwned, type CourseRecord } from './repository'
import { WorldLabsClient } from './world-labs'
import { cacheWorldSplat, putRoutePhoto, routeBucket, stripWebpMetadata } from './media'
import type { CourseView, StoredScene } from './types'
import { saveSceneNotesSchema } from './notes'
import { photoQuizConfigSchema } from './photo-quiz-schema'

export const courseInput = z.object({
  title: z.string().trim().min(1).max(64), schoolYear: z.number().int().min(1).max(9),
  model: z.enum(['marble-1.0-draft', 'marble-1.1']), consent: z.literal(true),
  learningMode: z.enum(['photo-quiz-v1', 'legacy-3d']).default('photo-quiz-v1'),
  scenes: z.array(z.object({ name: z.string().trim().min(1).max(60), photos: z.array(z.string().max(2_000_000)).min(1).max(8) })).min(1).max(8),
}).refine(input => input.scenes.reduce((count, scene) => count + scene.photos.length, 0) <= 24)

export async function canEditCourse(actor: Actor, course: CourseRecord) {
  const user = requireRouteUser(actor)
  if (user.id === course.ownerId) return true
  const membership = await readSchoolMembership(getRouteDatabase(), actor)
  return membership?.role === 'teacher' && membership.schoolId === course.schoolId
}

export async function courseView(actor: Actor, course: CourseRecord): Promise<CourseView> {
  const membership = await readSchoolMembership(getRouteDatabase(), actor)
  const canEdit = await canEditCourse(actor, course)
  const learningMode = course.data.learningMode === 'photo-quiz-v1' ? 'photo-quiz-v1' : 'legacy-3d'
  return { ownedByMe: requireRouteUser(actor).id === course.ownerId, id: course.id, revision: course.revision, title: course.data.title, schoolYear: course.data.schoolYear,
    learningMode,
    learnerSchoolYear: membership?.schoolYear ?? course.data.schoolYear,
    status: course.data.status, published: course.published, reviewed: course.data.reviewed,
    canEdit, model: course.data.model === 'marble-1.1' ? 'marble-1.1' : 'marble-1.0-draft',
    scenes: (course.data.scenes as StoredScene[]).map(scene => ({ id: scene.id, name: scene.name, status: scene.status,
      photoCount: scene.photoKeys.length, notes: learningMode === 'photo-quiz-v1' && !canEdit ? [] : scene.notes ?? [],
      splatUrl: scene.splatKey ? `/api/hunter/routes/${course.id}/assets/${scene.id}` : undefined,
      scale: scene.scale, groundOffset: scene.groundOffset, error: scene.error })),
  }
}

export async function saveSceneNotes(actor: Actor, id: string, raw: unknown) {
  const input = saveSceneNotesSchema.parse(raw)
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  if (input.revision !== course.revision) throw new RepositoryError(409, 'revision', 'コースが更新されています。読み直してからやり直してください。')
  const scenes = course.data.scenes as StoredScene[]
  if (scenes.some(scene => scene.status === 'submitting' || scene.status === 'running')) {
    throw new RepositoryError(409, 'generating', '生成が終わってから危険のメモを編集してください。')
  }
  const scene = scenes.find(item => item.id === input.sceneId)
  if (!scene) throw new RepositoryError(404, 'scene', '地点が見つかりません。')
  if (input.notes.some(note => note.photoIndex >= scene.photoKeys.length)) {
    throw new RepositoryError(400, 'photo', 'メモの写真を確認してください。')
  }
  if (JSON.stringify(scene.notes ?? []) === JSON.stringify(input.notes)) return course
  // A changed lesson needs another review and a fresh learning revision.
  return updateCourseOwned(actor, id, input.revision, { ...course.data, reviewed: false,
    scenes: scenes.map(item => item.id === input.sceneId ? { ...item, notes: input.notes } : item) })
}

/** Only previously masked, metadata-stripped course photos can be read here. */
export async function getRoutePhoto(actor: Actor, id: string, sceneId: string, photoIndex: number) {
  const course = await getCourse(actor, id)
  const scene = (course.data.scenes as StoredScene[]).find(item => item.id === sceneId)
  const key = Number.isInteger(photoIndex) && photoIndex >= 0 ? scene?.photoKeys[photoIndex] : undefined
  if (!key) throw new RepositoryError(404, 'photo', '写真が見つかりません。')
  const object = await routeBucket().get(key)
  if (!object) throw new RepositoryError(404, 'photo', '写真が見つかりません。')
  return object
}

/** Review changes publication readiness, not the scene or its learning revision. */
export async function reviewCourse(actor: Actor, id: string, revision: number) {
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  const scenes = course.data.scenes as StoredScene[]
  if (course.data.learningMode === 'photo-quiz-v1') {
    const quiz = photoQuizConfigSchema.parse({ revision: course.revision, items: course.data.quizItems ?? [] })
    if (course.data.status !== 'ready' || !quiz.items.some(item => item.scenario === 'normal') || quiz.items.some(item => !scenes.find(scene => scene.id === item.sceneId)?.photoKeys[item.photoIndex])) throw new RepositoryError(409, 'not_ready', '写真と問題を確認してください。')
  } else if (course.data.status !== 'ready' || !scenes.length || !scenes.every(scene => scene.status === 'ready' && scene.splatKey)) throw new RepositoryError(409, 'not_ready', '3Dの完成を待ってください。')
  const result = await getRouteDatabase().prepare(`UPDATE hunter_route_courses SET data_json = json_set(data_json, '$.reviewed', json('true')), updated_at = ? WHERE id = ? AND revision = ?`)
    .bind(new Date().toISOString(), id, revision).run()
  if (!result.meta.changes) throw new RepositoryError(409, 'revision', 'コースを読み直してください。')
  return getCourse(actor, id)
}

export async function prepareCourse(actor: Actor, raw: unknown) {
  const input = courseInput.parse(raw)
  requireRouteUser(actor)
  // Validate all image envelopes before saving anything.
  input.scenes.forEach(scene => scene.photos.forEach(stripWebpMetadata))
  const scenes: StoredScene[] = input.scenes.map(scene => ({ id: crypto.randomUUID(), name: scene.name, photoKeys: [], status: 'queued' }))
  let course = await createCourse(actor, { title: input.title, schoolYear: input.schoolYear, status: 'draft', reviewed: false, model: input.model, learningMode: input.learningMode, scenes })
  const uploaded: string[] = []
  try {
    for (let i = 0; i < scenes.length; i++) {
      for (let p = 0; p < input.scenes[i].photos.length; p++) {
        const key = `hunter-routes/${course.id}/${scenes[i].id}/photo-${p}.webp`
        await putRoutePhoto(key, input.scenes[i].photos[p]); scenes[i].photoKeys.push(key); uploaded.push(key)
      }
    }
    course = await updateCourseOwned(actor, course.id, course.revision, { ...course.data, scenes })
    return course
  } catch (error) {
    await Promise.allSettled(uploaded.map(key => routeBucket().delete(key)))
    await updateCourseOwned(actor, course.id, course.revision, { ...course.data, status: 'failed', scenes: [] }).catch(() => {})
    throw error
  }
}

function client() { return new WorldLabsClient(process.env.WORLD_LABS_API_KEY ?? '') }

/** Atomic per-scene result persistence. It neither overwrites other scenes nor
 * reapplies a duplicate completion after review/publication. Saved scenes are immutable. */
export async function persistScene(actor: Actor, id: string, expected: StoredScene, updated: StoredScene) {
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  const index = (course.data.scenes as StoredScene[]).findIndex(scene => scene.id === expected.id)
  if (index < 0) throw new RepositoryError(404, 'scene', '地点が見つかりません。')
  const path = `$.scenes[${index}]`
  const patched = `json_set(data_json, ?, json(?))`
  // The CTE reads the currently stored version inside the same SQL statement.
  await getRouteDatabase().prepare(`WITH next AS (
    SELECT id, ${patched} AS doc FROM hunter_route_courses WHERE id = ?
      AND json_extract(data_json, ?) = ? AND json_extract(data_json, ?) = ?
      AND COALESCE(json_extract(data_json, ?), '') = ?
  ) UPDATE hunter_route_courses SET data_json = (
    SELECT json_set(doc, '$.reviewed', json('false'), '$.status', CASE
      WHEN NOT EXISTS (SELECT 1 FROM json_each(doc, '$.scenes') WHERE json_extract(value, '$.status') != 'ready') THEN 'ready'
      WHEN EXISTS (SELECT 1 FROM json_each(doc, '$.scenes') WHERE json_extract(value, '$.status') IN ('failed','unknown')) THEN 'failed'
      ELSE 'generating' END) FROM next), revision = revision + 1, published = 0, updated_at = ?
    WHERE id IN (SELECT id FROM next)`)
    .bind(path, JSON.stringify(updated), id, `${path}.id`, expected.id, `${path}.status`, expected.status,
      `${path}.operationId`, expected.operationId ?? '', new Date().toISOString()).run()
  return getCourse(actor, id)
}

export async function startScene(actor: Actor, id: string, sceneId: string): Promise<never> {
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '作成者のみ生成できます。')
  if (!(course.data.scenes as StoredScene[]).some(scene => scene.id === sceneId)) throw new RepositoryError(404, 'scene', '地点が見つかりません。')
  throw new RepositoryError(410, 'generation_disabled', '新しい3D生成は停止しました。保存した写真は引き続き確認・編集できます。')
}

export async function syncCourse(actor: Actor, id: string) {
  let course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) return course
  for (const scene of course.data.scenes as StoredScene[]) {
    if (scene.status !== 'running' || !scene.operationId) continue
    const result = await client().getOperation(scene.operationId)
    if (result.state === 'running') continue
    let updated: StoredScene = { ...scene, status: 'failed', error: '3D生成に失敗しました。' }
    if (result.state === 'ready') {
      const key = `hunter-routes/${id}/${scene.id}/scene.spz`
      await cacheWorldSplat(result.world.assets.splats.spz_urls['100k'], key)
      const semantics = result.world.assets.splats.semantics_metadata
      updated = { ...scene, status: 'ready', splatKey: key, scale: semantics?.metric_scale_factor, groundOffset: semantics?.ground_plane_offset }
    }
    course = await persistScene(actor, id, scene, updated)
  }
  return course
}
