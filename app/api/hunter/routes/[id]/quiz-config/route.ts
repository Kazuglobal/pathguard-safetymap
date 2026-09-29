import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'
import { getQuizConfig, saveQuizConfig } from '@/lib/hunter/routes/photo-quiz-service'
import { courseView } from '@/lib/hunter/routes/service'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, context: Context) {
  try { const { id } = await context.params; return NextResponse.json(await getQuizConfig(await getActor(), id), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return routeError(error) }
}
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request); const { id } = await context.params; const actor = await getActor()
    const course = await saveQuizConfig(actor, id, await readRouteJson(request, 128_000))
    return NextResponse.json({ course: await courseView(actor, course) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
