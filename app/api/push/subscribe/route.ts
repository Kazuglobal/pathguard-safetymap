import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { NATIONWIDE, isKnownRegion } from '@/lib/user-region'

// push_subscriptions テーブルは生成型未反映のため any キャスト
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

// 注意: ここに無いキーはzodが黙って捨てる。NotificationPreferences に
// キーを足したら必ずこのスキーマにも足すこと（過去に local_alerts が
// 欠けており、クライアントの設定が保存されないバグがあった）
const preferencesSchema = z.object({
  danger_reports: z.boolean().optional().default(true),
  news: z.boolean().optional().default(true),
  magazine: z.boolean().optional().default(true),
  local_alerts: z.boolean().optional().default(true),
  daily_digest: z.boolean().optional().default(true),
})

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  preferences: preferencesSchema.optional(),
  prefecture: z.string().optional(),
})

const patchSchema = z.object({
  endpoint: z.string().url(),
  preferences: preferencesSchema,
  prefecture: z.string().optional(),
})

/** 地域別Push出し分け用。47都道府県の正式名称のみ保存し、「全国」・不正値は null */
function normalizePrefecture(value: string | undefined): string | null {
  if (!value || value === NATIONWIDE || !isKnownRegion(value)) return null
  return value
}

/**
 * push_subscriptions.prefecture カラム未追加（マイグレーション
 * 20260706100000 未適用）の環境かどうかの判定。
 * 適用前でも購読の保存自体は成功させるためのデプロイ順ガード。
 * マイグレーション適用後はこの分岐は通らなくなる。
 */
function isMissingPrefectureColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  return error.code === 'PGRST204' && (error.message ?? '').includes('prefecture')
}

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

  const row: Record<string, unknown> = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    notification_preferences: {
      danger_reports: preferences?.danger_reports ?? true,
      news: preferences?.news ?? true,
      magazine: preferences?.magazine ?? true,
      local_alerts: preferences?.local_alerts ?? true,
      daily_digest: preferences?.daily_digest ?? true,
    },
    prefecture: normalizePrefecture(parsed.data.prefecture),
    updated_at: new Date().toISOString(),
  }

  let { error } = await db()
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'user_id,endpoint' })

  if (isMissingPrefectureColumn(error)) {
    console.warn('[push/subscribe] prefecture column missing - retrying without it (apply migration 20260706100000)')
    const { prefecture: _prefecture, ...rowWithoutPrefecture } = row
    ;({ error } = await db()
      .from('push_subscriptions')
      .upsert(rowWithoutPrefecture, { onConflict: 'user_id,endpoint' }))
  }

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

  const updatePayload: Record<string, unknown> = {
    notification_preferences: preferences,
    updated_at: new Date().toISOString(),
  }
  // 地域はクライアントが送ってきたときだけ同期する（未送信時は既存値を保持）
  if (parsed.data.prefecture !== undefined) {
    updatePayload.prefecture = normalizePrefecture(parsed.data.prefecture)
  }

  let { error } = await db()
    .from('push_subscriptions')
    .update(updatePayload)
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (isMissingPrefectureColumn(error) && 'prefecture' in updatePayload) {
    console.warn('[push/subscribe] prefecture column missing - retrying without it (apply migration 20260706100000)')
    const { prefecture: _prefecture, ...payloadWithoutPrefecture } = updatePayload
    ;({ error } = await db()
      .from('push_subscriptions')
      .update(payloadWithoutPrefecture)
      .eq('user_id', user.id)
      .eq('endpoint', endpoint))
  }

  if (error) {
    console.error('[push/subscribe] patch error', error)
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
