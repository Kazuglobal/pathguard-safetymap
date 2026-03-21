import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST: サブスクリプション登録
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const admin = getAdminClient()

  const { error } = await admin.from('push_subscriptions').upsert(
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
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const admin = getAdminClient()

  const { error } = await admin
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
