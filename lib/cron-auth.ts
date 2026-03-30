import { NextRequest, NextResponse } from 'next/server'

/**
 * CRON_SECRET bearer token 認証チェック。
 * 失敗した場合は 401 レスポンスを返す。成功した場合は null を返す。
 */
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  // Vercel 外（ローカル開発）では認証をスキップ
  // VERCEL 環境変数は Vercel デプロイ時のみ自動設定される
  if (!process.env.VERCEL) return null

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  return null
}
