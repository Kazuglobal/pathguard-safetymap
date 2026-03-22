import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { broadcastPush } from '@/lib/web-push'
import { buildNewsPushPayload, buildMagazinePushPayload } from '@/lib/notifications/builders'
import { verifyCronSecret } from '@/lib/cron-auth'

const bodySchema = z.object({
  type: z.enum(['news', 'magazine']),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  slug: z.string().min(1).max(200),
})

// コンテンツ通知の最終送信時刻を追跡（インメモリ、1時間制限）
// Note: サーバーレス環境では各コンテナがリセットされるため実質ベストエフォート
const lastSentAt = new Map<string, number>()
const CONTENT_NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { type, title, slug } = parsed.data

  // レート制限: 同typeで1時間以内の再送防止
  const cooldownKey = `${type}:${slug}`
  const now = Date.now()
  const lastSent = lastSentAt.get(cooldownKey)
  if (lastSent && now - lastSent < CONTENT_NOTIFICATION_COOLDOWN_MS) {
    return NextResponse.json(
      { error: '同じコンテンツへの通知は1時間以内に再送できません' },
      { status: 429 }
    )
  }

  const payload =
    type === 'news'
      ? buildNewsPushPayload({ slug, title })
      : buildMagazinePushPayload({ slug, title })

  const notified = await broadcastPush(payload, type)

  lastSentAt.set(cooldownKey, now)

  return NextResponse.json({ notified })
}
