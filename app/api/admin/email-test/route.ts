import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyAdminRequest } from '@/lib/admin-auth'
import { OPERATOR_EMAIL_TO, sendOperatorEmail } from '@/lib/email/operator-mail'

export const runtime = 'nodejs'

const TestEmailSchema = z.object({
  subject: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(1000).optional(),
})

/**
 * 管理者向けの Cloudflare Email Sending 疎通テスト用エンドポイント。
 * 認証済み管理者のみ実行でき、OPERATOR_EMAIL バインディング経由で globalbunny77@gmail.com へ送信する。
 */
export async function POST(request: NextRequest) {
  const { authorized, status, error } = await verifyAdminRequest()
  if (!authorized) {
    return NextResponse.json(
      { error: error ?? '管理者権限が必要です' },
      { status: status ?? 403 },
    )
  }

  let body: unknown = {}
  const rawText = await request.text()
  if (rawText.trim().length > 0) {
    try {
      body = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: '不正なJSONリクエストです' }, { status: 400 })
    }
  }

  const parsed = TestEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const subject = parsed.data.subject ?? '【PathGuardian テスト】Cloudflare Email Sending 疎通確認'
  const text = [
    'PathGuardian の Cloudflare Email Sending (Workers Free) 疎通テストメールです。',
    '',
    `送信時刻(UTC): ${now}`,
    `宛先: ${OPERATOR_EMAIL_TO}`,
    ...(parsed.data.note ? ['', '--- メモ ---', parsed.data.note] : []),
  ].join('\n')

  const result = await sendOperatorEmail({ subject, text })
  if (result.status === 'sent') {
    return NextResponse.json({
      ok: true,
      to: OPERATOR_EMAIL_TO,
      ...result,
    })
  }

  return NextResponse.json(
    {
      ok: false,
      to: OPERATOR_EMAIL_TO,
      ...result,
    },
    { status: result.status === 'skipped' ? 503 : 502 },
  )
}
