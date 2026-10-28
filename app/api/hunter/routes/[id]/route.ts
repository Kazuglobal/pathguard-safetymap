import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/actor'
import { getCourse, getProgress, publishCourse, RepositoryError, requireRouteUser, unpublishCourse } from '@/lib/hunter/routes/repository'
import { courseView, reviewCourse, startScene, syncCourse } from '@/lib/hunter/routes/service'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'
import { copyPhotoQuizCourse } from '@/lib/hunter/routes/photo-quiz-service'

type Context = { params: Promise<{ id: string }> }
export const runtime = 'nodejs'
export async function GET(_request: Request, context: Context) {
  try {
    const actor = requireRouteUser(await getActor()); const { id } = await context.params
    const course = await getCourse(actor, id)
    return NextResponse.json({ course: await courseView(actor, course), progress: await getProgress(actor, id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
const actionSchema = z.object({ action: z.enum(['start', 'sync', 'review', 'publish', 'unpublish', 'copy-photo-quiz']), sceneId: z.string().uuid().optional(), revision: z.number().int().positive().optional() })
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    const actor = requireRouteUser(await getActor()); const { id } = await context.params
    const input = actionSchema.parse(await readRouteJson(request))
    let course = await getCourse(actor, id)
    if (input.action === 'copy-photo-quiz') course = await copyPhotoQuizCourse(actor, id)
    else if (input.action === 'start') {
      if (!input.sceneId) throw new RepositoryError(400, 'scene', '地点を指定してください。')
      course = await startScene(actor, id, input.sceneId)
    } else if (input.action === 'sync') course = await syncCourse(actor, id)
    else {
      if (!input.revision || input.revision !== course.revision) throw new RepositoryError(409, 'revision', 'コースを読み直してください。')
      if (input.action === 'review') course = await reviewCourse(actor, id, input.revision)
      if (input.action === 'publish') course = await publishCourse(actor, id, input.revision)
      if (input.action === 'unpublish') course = await unpublishCourse(actor, id, input.revision)
    }
    return NextResponse.json({ course: await courseView(actor, course), progress: await getProgress(actor, course.id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
