import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { routeError } from '@/lib/hunter/routes/http'
import { getQuizSession } from '@/lib/hunter/routes/photo-quiz-service'
export async function GET(_request: Request, context: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    const { id, sessionId } = await context.params
    return NextResponse.json({ session: await getQuizSession(await getActor(), id, sessionId) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
