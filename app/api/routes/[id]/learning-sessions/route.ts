import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { upsertRouteLearningSession } from '@/lib/db/repos/routes.repo'

type Context = { params: Promise<{ id: string }> }

function nonNegativeInteger(value: unknown): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new RangeError('Invalid session count')
  return number
}

export async function POST(request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id: routeId } = await context.params
    const body = await request.json() as Record<string, unknown>
    const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
    const startedAt = typeof body.started_at === 'string' ? body.started_at : ''
    if (!routeId || routeId.length > 128 || !sessionId || sessionId.length > 64
      || !startedAt || Number.isNaN(Date.parse(startedAt))) throw new RangeError('Invalid learning session')
    const quizTotal = nonNegativeInteger(body.quiz_total)
    const quizScore = nonNegativeInteger(body.quiz_score)
    if (quizTotal > 3 || quizScore > quizTotal) throw new RangeError('Invalid quiz score')
    const checklist = Array.isArray(body.checklist) ? body.checklist.slice(0, 100) : []
    const stopResults = Array.isArray(body.stop_results) ? body.stop_results.slice(0, 100) : []
    const row = await upsertRouteLearningSession(actor, {
      id: crypto.randomUUID(), userId: actor.id, routeId, sessionId,
      childId: typeof body.child_id === 'string' ? body.child_id.slice(0, 128) : null,
      childName: typeof body.child_name === 'string' ? body.child_name.slice(0, 100) : null,
      schemaVersion: Math.max(1, nonNegativeInteger(body.schema_version)),
      startedAt,
      completedAt: typeof body.completed_at === 'string' && !Number.isNaN(Date.parse(body.completed_at))
        ? body.completed_at : null,
      reviewedCount: nonNegativeInteger(body.reviewed_count),
      savedCount: nonNegativeInteger(body.saved_count),
      quizScore, quizTotal, checklist, stopResults,
    })
    return NextResponse.json({ session: row })
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('[api/routes/learning-sessions] failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to save learning session' }, { status: 500 })
  }
}
