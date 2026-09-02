import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getActor } from '@/lib/auth/actor'
import { deletePushSubscription } from '@/lib/db/repos/push.repo'

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) })

export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 }) }
  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'パラメータが不正です', details: parsed.error.flatten() }, { status: 400 })
  try {
    await deletePushSubscription(actor, parsed.data.endpoint)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[push/unsubscribe] delete error', error)
    return NextResponse.json({ error: '解除に失敗しました' }, { status: 500 })
  }
}
