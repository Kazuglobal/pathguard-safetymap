import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// push_subscriptions テーブルは生成型未反映のため any キャスト
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

const preferencesSchema = z.object({
  danger_reports: z.boolean().optional().default(true),
  news: z.boolean().optional().default(true),
  magazine: z.boolean().optional().default(true),
})

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  preferences: preferencesSchema.optional(),
})

const patchSchema = z.object({
  endpoint: z.string().url(),
  preferences: preferencesSchema,
})

const endpointSearchSchema = z.object({
  endpoint: z.string().url(),
})

async function getAuthenticatedUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const parsed = endpointSearchSchema.safeParse({
    endpoint: req.nextUrl.searchParams.get('endpoint'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await db()
    .from('push_subscriptions')
    .select('endpoint, notification_preferences')
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint)
    .maybeSingle()

  if (error) {
    console.error('[push/subscribe] get error', error)
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ subscribed: false, preferences: null })
  }

  return NextResponse.json({
    subscribed: true,
    preferences: data.notification_preferences,
  })
}

// POST: サブスクリプション登録
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { endpoint, p256dh, auth, preferences } = parsed.data

  const { error } = await db().from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      notification_preferences: {
        danger_reports: preferences?.danger_reports ?? true,
        news: preferences?.news ?? true,
        magazine: preferences?.magazine ?? true,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) {
    console.error('[push/subscribe] upsert error', error)
    return NextResponse.json({ error: 'サブスクリプションの保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ subscribed: true })
}

// PATCH: 通知設定更新
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { endpoint, preferences } = parsed.data

  const { error } = await db()
    .from('push_subscriptions')
    .update({
      notification_preferences: preferences,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('[push/subscribe] patch error', error)
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
