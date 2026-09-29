import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/actor'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'
import { startQuizSession, getQuizOutline } from '@/lib/hunter/routes/photo-quiz-service'
import { quizScenarios } from '@/lib/hunter/routes/photo-quiz-schema'
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json({ outline: await getQuizOutline(await getActor(), id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const { id } = await context.params
    const input = z.object({ scenario: z.enum(quizScenarios) }).strict().parse(await readRouteJson(request))
    return NextResponse.json({ session: await startQuizSession(await getActor(), id, input.scenario) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
