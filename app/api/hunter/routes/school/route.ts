import { NextRequest, NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { RepositoryError } from '@/lib/hunter/routes/repository'
import { createSchool, createSchoolInvite, getSchoolMembership, joinSchool } from '@/lib/hunter/routes/school'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { readRouteJson, requireSameOrigin } from '@/lib/hunter/routes/http'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }

function failure(error: unknown) {
  if (error instanceof RepositoryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers })
  return NextResponse.json({ error: '学校の情報を読み込めませんでした。もう一度ためしてください。' }, { status: 503, headers })
}

export async function GET() {
  try {
    const actor = await getActor()
    if (actor.kind !== 'user') return NextResponse.json({ error: 'ログインしてください。' }, { status: 401, headers })
    const rate = await checkApiRateLimit(`hunter-school:${actor.id}`)
    if (!rate.success) return rateLimitedResponse(rate.reset)
    return NextResponse.json({ membership: await getSchoolMembership(actor), canCreateSchool: actor.isAdmin }, { headers })
  } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor()
    if (actor.kind !== 'user') return NextResponse.json({ error: 'ログインしてください。' }, { status: 401, headers })
    requireSameOrigin(request)
    const rate = await checkApiRateLimit(`hunter-school-write:${actor.id}`)
    if (!rate.success) return rateLimitedResponse(rate.reset)
    const body = await readRouteJson(request, 2048) as { action?: unknown; name?: unknown; code?: unknown; schoolYear?: unknown }
    if (!body || typeof body !== 'object') return NextResponse.json({ error: '入力を確認してください。' }, { status: 400, headers })
    if (body.action === 'create-school' && typeof body.name === 'string') {
      return NextResponse.json({ membership: await createSchool(actor, body.name) }, { status: 201, headers })
    }
    if (body.action === 'create-invite') return NextResponse.json(await createSchoolInvite(actor), { status: 201, headers })
    if (body.action === 'join' && typeof body.code === 'string' && typeof body.schoolYear === 'number') {
      return NextResponse.json({ membership: await joinSchool(actor, body.code, body.schoolYear) }, { headers })
    }
    return NextResponse.json({ error: '入力を確認してください。' }, { status: 400, headers })
  } catch (error) { return failure(error) }
}
