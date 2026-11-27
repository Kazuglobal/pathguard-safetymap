import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyCronSecret } from '@/lib/cron-auth'
import { sendCiDeployNotification } from '@/lib/email/operator-mail'

export const runtime = 'nodejs'

const CiDeployNotifySchema = z.object({
  status: z.enum(['success', 'failure', 'cancelled']),
  workflow: z.string().trim().min(1).max(120),
  ref: z.string().trim().min(1).max(200),
  sha: z.string().trim().min(7).max(64),
  actor: z.string().trim().min(1).max(120),
  runUrl: z.string().trim().url().optional(),
  summary: z.string().trim().max(1000).optional(),
})

/**
 * GitHub Actions の本番デプロイ結果を受け取り、運営者へメール通知する Webhook エンドポイント。
 * Authorization: Bearer <CRON_SECRET> で認証する。
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '不正なJSONリクエストです' }, { status: 400 })
  }

  const parsed = CiDeployNotifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'ペイロードが不正です' }, { status: 400 })
  }

  const { status, workflow, ref, sha, actor, runUrl, summary } = parsed.data
  const result = await sendCiDeployNotification({
    status: status ?? 'failure',
    workflow: workflow ?? 'Cloudflare Production',
    ref: ref ?? 'refs/heads/main',
    sha: sha ?? '0000000',
    actor: actor ?? 'github-actions',
    runUrl,
    summary,
  })
  return NextResponse.json(
    {
      ok: result.status === 'sent',
      delivery: result,
    },
    { status: result.status === 'failed' ? 502 : 200 },
  )
}
