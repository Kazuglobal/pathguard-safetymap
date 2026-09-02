import { NextRequest, NextResponse } from 'next/server'

import { getMaintenanceMode } from '@/lib/maintenance'

/**
 * CRON_SECRET bearer token 認証チェック。
 * 失敗した場合は 401 レスポンスを返す。成功した場合は null を返す。
 */
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  if (getMaintenanceMode() === 'read_only') {
    return NextResponse.json(
      { error: 'メンテナンス中のため書き込みを停止しています' },
      { status: 503, headers: { 'Retry-After': '300' } },
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'production') return null
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  return null
}
