import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'
import { answerQuizSession } from '@/lib/hunter/routes/photo-quiz-service'
export async function POST(request: Request, context: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    requireSameOrigin(request); const { id, sessionId } = await context.params
    return NextResponse.json({ session: await answerQuizSession(await getActor(), id, sessionId, await readRouteJson(request)) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
