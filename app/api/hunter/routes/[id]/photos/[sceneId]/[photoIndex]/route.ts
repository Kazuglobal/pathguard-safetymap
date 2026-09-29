import { getActor } from '@/lib/auth/actor'
import { requireRouteUser, RepositoryError } from '@/lib/hunter/routes/repository'
import { getRoutePhoto } from '@/lib/hunter/routes/service'
import { routeError } from '@/lib/hunter/routes/http'

export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ id: string; sceneId: string; photoIndex: string }> }) {
  try {
    const actor = requireRouteUser(await getActor())
    const { id, sceneId, photoIndex } = await context.params
    if (!/^[0-7]$/.test(photoIndex)) throw new RepositoryError(404, 'photo', '写真が見つかりません。')
    const object = await getRoutePhoto(actor, id, sceneId, Number(photoIndex))
    return new Response(object.body, { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) { return routeError(error) }
}
