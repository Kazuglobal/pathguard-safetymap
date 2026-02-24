import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'

// Mapbox は使用量統計の公開 REST API を提供していない。
// 使用量データは Mapbox ダッシュボード (https://account.mapbox.com/) の
// Statistics ページでのみ確認可能。
// 参考: https://docs.mapbox.com/accounts/guides/statistics/

export async function GET() {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    return NextResponse.json({
      unavailable: true,
      message: 'Mapbox は使用量統計の公開 API を提供していません。使用量データは Mapbox ダッシュボードで確認してください。',
      dashboardUrl: 'https://account.mapbox.com/',
    })
  } catch (err) {
    console.error('[api/admin/costs/mapbox-usage] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Mapbox 使用量データの取得に失敗しました' },
      { status: 500 }
    )
  }
}
