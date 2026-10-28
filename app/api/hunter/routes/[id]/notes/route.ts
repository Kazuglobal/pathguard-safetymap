import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { requireRouteUser, getProgress } from '@/lib/hunter/routes/repository'
import { courseView, saveSceneNotes } from '@/lib/hunter/routes/service'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'

export const runtime = 'nodejs'
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const actor = requireRouteUser(await getActor())
    const { id } = await context.params
    const course = await saveSceneNotes(actor, id, await readRouteJson(request, 48_000))
    return NextResponse.json({ course: await courseView(actor, course), progress: await getProgress(actor, id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
