import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'

const MAPBOX_USERNAME = process.env.MAPBOX_USERNAME || process.env.NEXT_PUBLIC_MAPBOX_USERNAME

export async function GET(request: NextRequest) {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    if (!MAPBOX_USERNAME) {
      return NextResponse.json(
        { error: 'Mapbox Usage API を利用するには .env.local に MAPBOX_USERNAME を設定してください（例: MAPBOX_USERNAME=kazu1988）' },
        { status: 501 }
      )
    }

    const accessToken = process.env.MAPBOX_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mapbox Usage API を利用するには .env.local に MAPBOX_ACCESS_TOKEN（シークレットトークン sk.xxx）を設定してください' },
        { status: 501 }
      )
    }

    const { searchParams } = new URL(request.url)
    const periodParam = searchParams.get('period') || ''
    if (periodParam && !/^\d{6}$/.test(periodParam)) {
      return NextResponse.json(
        { error: 'period パラメータが不正です。YYYYMM 形式で指定してください' },
        { status: 400 }
      )
    }
    const period = periodParam

    const url = new URL(`https://api.mapbox.com/usage/v1/${encodeURIComponent(MAPBOX_USERNAME)}`)
    if (period) {
      url.searchParams.set('period', period)
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id') || response.headers.get('x-mapbox-request-id')
      const requestIdInfo = requestId ? ` (request_id: ${requestId})` : ''
      console.error(`[api/admin/costs/mapbox-usage] Mapbox API error: status=${response.status}${requestIdInfo}`)
      return NextResponse.json(
        { error: `Mapbox API から使用量データを取得できませんでした（status: ${response.status}）${requestIdInfo}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[api/admin/costs/mapbox-usage] Failed to fetch Mapbox usage data:', error)
    return NextResponse.json(
      { error: 'Mapbox 使用量データの取得に失敗しました' },
      { status: 500 }
    )
  }
}
