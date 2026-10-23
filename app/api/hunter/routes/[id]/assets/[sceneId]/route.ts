import { getActor } from '@/lib/auth/actor'
import { getCourse, RepositoryError, requireRouteUser } from '@/lib/hunter/routes/repository'
import { routeBucket } from '@/lib/hunter/routes/media'
import { routeError } from '@/lib/hunter/routes/http'
import type { StoredScene } from '@/lib/hunter/routes/types'

export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const actor = requireRouteUser(await getActor())
    const { id, sceneId } = await context.params
    const course = await getCourse(actor, id)
    const scene = (course.data.scenes as StoredScene[]).find(item => item.id === sceneId)
    if (!scene?.splatKey || scene.status !== 'ready') throw new RepositoryError(404, 'not_ready', '3D素材が見つかりません。')
    const object = await routeBucket().get(scene.splatKey)
    if (!object) throw new RepositoryError(404, 'asset', '3D素材が見つかりません。')
    return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(object.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) { return routeError(error) }
}
