import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { listTeacherRecords, RepositoryError } from '@/lib/hunter/routes/repository'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { listPhotoQuizTeacherRecords } from '@/lib/hunter/routes/photo-quiz-service'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  try {
    const actor = await getActor()
    if (actor.kind !== 'user') return NextResponse.json({ error: 'ログインしてください。' }, { status: 401, headers })
    const rate = await checkApiRateLimit(`hunter-school-records:${actor.id}`)
    if (!rate.success) return rateLimitedResponse(rate.reset)
    const [legacy, photos] = await Promise.all([listTeacherRecords(actor), listPhotoQuizTeacherRecords(actor)])
    return NextResponse.json({ records: [...photos, ...legacy] }, { headers })
  } catch (error) {
    if (error instanceof RepositoryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers })
    return NextResponse.json({ error: '学習記録を読み込めませんでした。' }, { status: 503, headers })
  }
}
