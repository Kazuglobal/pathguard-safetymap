import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/actor'
import { getCourse, getProgress, RepositoryError, requireRouteUser, saveProgress } from '@/lib/hunter/routes/repository'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'
import { evaluateRouteAttempt, getMissedRouteCategories, type RouteAnswer } from '@/lib/hunter/routes/curriculum'
import type { StoredScene } from '@/lib/hunter/routes/types'
import { evaluateReviewedNotes, MAX_SCENE_NOTES } from '@/lib/hunter/routes/notes'
const schema = z.object({
  revision: z.number().int().positive(), sceneId: z.string().uuid(), scenario: z.enum(['normal', 'rain', 'evening', 'earthquake']),
  foundIds: z.array(z.string().max(80)).max(20),
  reviewedNoteIds: z.array(z.string().uuid()).max(MAX_SCENE_NOTES).optional(),
  answers: z.array(z.object({ hazardId: z.string().max(80), prediction: z.string().max(80), reason: z.string().max(80), action: z.string().max(80) })).max(20),
  mistakes: z.array(z.object({ hazardId: z.string().max(80), prediction: z.string().max(80), reason: z.string().max(80), action: z.string().max(80) })).max(120).optional(),
})
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const actor = requireRouteUser(await getActor()); const { id } = await context.params
    const input = schema.parse(await readRouteJson(request))
    const course = await getCourse(actor, id)
    if (course.data.status !== 'ready' || course.revision !== input.revision) throw new RepositoryError(409, 'course', '完成したコースを読み直してください。')
    const scene = (course.data.scenes as StoredScene[]).find(item => item.id === input.sceneId)
    if (!scene || scene.status !== 'ready') throw new RepositoryError(404, 'scene', '地点が見つかりません。')
    const noteReview = evaluateReviewedNotes(scene.notes ?? [], input.scenario, input.reviewedNoteIds)
    if (noteReview.invalid) throw new RepositoryError(400, 'notes', '確認した危険のメモを読み直してください。')
    const progress = await getProgress(actor, id)
    const normalCleared = (course.data.scenes as StoredScene[]).every(scene => progress.some(item => item.sceneId === scene.id && item.scenario === 'normal' && item.cleared))
    const result = evaluateRouteAttempt({
      scenario: input.scenario, foundIds: input.foundIds,
      answers: input.answers.map(answer => ({ hazardId: answer.hazardId, prediction: answer.prediction, reason: answer.reason, action: answer.action })),
    }, normalCleared)
    if (result.invalid) throw new RepositoryError(400, 'answers', '回答とシナリオを確認してください。')
    result.cleared = result.cleared && noteReview.complete
    const submitted = [...input.answers, ...input.mistakes ?? []].map((answer): RouteAnswer => ({ hazardId: answer.hazardId, prediction: answer.prediction, reason: answer.reason, action: answer.action }))
    const missedKinds = getMissedRouteCategories(input.scenario, submitted)
    return NextResponse.json({ result, progress: await saveProgress(actor, id, input.revision, input.sceneId, input.scenario, result.cleared, missedKinds) })
  } catch (error) { return routeError(error) }
}
