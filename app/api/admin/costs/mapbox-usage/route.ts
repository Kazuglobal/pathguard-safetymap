import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

const MAPBOX_USERNAME = process.env.MAPBOX_USERNAME || process.env.NEXT_PUBLIC_MAPBOX_USERNAME

async function verifyAdmin(): Promise<{ authorized: boolean; errorResponse?: NextResponse }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      ),
    }
  }

  if (!isAdminEmail(user.email)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          { error: '管理者権限が必要です' },
          { status: 403 }
        ),
      }
    }
  }

  return { authorized: true }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, errorResponse } = await verifyAdmin()
    if (!authorized) {
      return errorResponse
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

    const url = new URL(`https://api.mapbox.com/usage/v1/${MAPBOX_USERNAME}`)
    url.searchParams.set('access_token', accessToken)
    if (period) {
      url.searchParams.set('period', period)
    }

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const sanitizedError = errorText.slice(0, 200).replace(/[<>]/g, '')
      return NextResponse.json(
        { error: `Mapbox API エラー: ${response.status} ${sanitizedError}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました'
    return NextResponse.json(
      { error: `Mapbox 使用量データの取得に失敗しました: ${message}` },
      { status: 500 }
    )
  }
}
