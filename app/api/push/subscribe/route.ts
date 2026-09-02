import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getActor } from '@/lib/auth/actor'
import { getPushSubscription, patchPushSubscription, upsertPushSubscription } from '@/lib/db/repos/push.repo'
import { NATIONWIDE, isKnownRegion } from '@/lib/user-region'

const preferencesSchema = z.object({
  danger_reports: z.boolean().optional().default(true),
  news: z.boolean().optional().default(true),
  magazine: z.boolean().optional().default(true),
  local_alerts: z.boolean().optional().default(true),
  daily_digest: z.boolean().optional().default(true),
})
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048), p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512),
  preferences: preferencesSchema.optional(), prefecture: z.string().optional(),
})
const patchSchema = z.object({ endpoint: z.string().url().max(2048), preferences: preferencesSchema, prefecture: z.string().optional() })
const endpointSearchSchema = z.object({ endpoint: z.string().url().max(2048) })

function normalizePrefecture(value: string | undefined): string | null {
  return value && value !== NATIONWIDE && isKnownRegion(value) ? value : null
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const parsed = endpointSearchSchema.safeParse({ endpoint: req.nextUrl.searchParams.get('endpoint') })
  if (!parsed.success) return NextResponse.json({ error: 'パラメータが不正です', details: parsed.error.flatten() }, { status: 400 })
  try {
    const row = await getPushSubscription(actor, parsed.data.endpoint)
    return NextResponse.json(row
      ? { subscribed: true, preferences: row.notificationPreferences }
      : { subscribed: false, preferences: null })
  } catch (error) {
    console.error('[push/subscribe] get error', error)
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 }) }
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'パラメータが不正です', details: parsed.error.flatten() }, { status: 400 })
  try {
    await upsertPushSubscription(actor, {
      endpoint: parsed.data.endpoint, p256dh: parsed.data.p256dh, auth: parsed.data.auth,
      preferences: parsed.data.preferences, prefecture: normalizePrefecture(parsed.data.prefecture),
    })
    return NextResponse.json({ subscribed: true })
  } catch (error) {
    console.error('[push/subscribe] upsert error', error)
    return NextResponse.json({ error: 'サブスクリプションの保存に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 }) }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'パラメータが不正です', details: parsed.error.flatten() }, { status: 400 })
  try {
    const row = await patchPushSubscription(actor, parsed.data.endpoint, {
      preferences: parsed.data.preferences,
      ...(parsed.data.prefecture !== undefined ? { prefecture: normalizePrefecture(parsed.data.prefecture) } : {}),
    })
    return row
      ? NextResponse.json({ updated: true })
      : NextResponse.json({ error: '購読が見つかりません' }, { status: 404 })
  } catch (error) {
    console.error('[push/subscribe] patch error', error)
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 })
  }
}
