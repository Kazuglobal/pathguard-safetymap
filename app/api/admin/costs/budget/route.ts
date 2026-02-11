import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'
import { getBudgetSettings, updateBudgetSettings } from '@/lib/admin-costs-service'

const VALID_PROVIDERS = ['gemini', 'openai', 'mapbox'] as const

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

export async function GET() {
  try {
    const { authorized, errorResponse } = await verifyAdmin()
    if (!authorized) {
      return errorResponse
    }

    const settings = await getBudgetSettings()
    return NextResponse.json(settings)
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました'
    return NextResponse.json(
      { error: `予算設定の取得に失敗しました: ${message}` },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { authorized, errorResponse } = await verifyAdmin()
    if (!authorized) {
      return errorResponse
    }

    const body = await request.json()
    const { provider, monthly_budget_usd, alert_threshold_percent } = body

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `provider が不正です。${VALID_PROVIDERS.join(', ')} のいずれかを指定してください` },
        { status: 400 }
      )
    }

    if (monthly_budget_usd !== undefined && (typeof monthly_budget_usd !== 'number' || monthly_budget_usd < 0)) {
      return NextResponse.json(
        { error: 'monthly_budget_usd は 0 以上の数値を指定してください' },
        { status: 400 }
      )
    }

    if (alert_threshold_percent !== undefined && (typeof alert_threshold_percent !== 'number' || alert_threshold_percent < 0 || alert_threshold_percent > 100)) {
      return NextResponse.json(
        { error: 'alert_threshold_percent は 0〜100 の数値を指定してください' },
        { status: 400 }
      )
    }

    const settings: { monthly_budget_usd?: number; alert_threshold_percent?: number } = {}
    if (monthly_budget_usd !== undefined) {
      settings.monthly_budget_usd = monthly_budget_usd
    }
    if (alert_threshold_percent !== undefined) {
      settings.alert_threshold_percent = alert_threshold_percent
    }

    const updated = await updateBudgetSettings(provider, settings)
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました'
    return NextResponse.json(
      { error: `予算設定の更新に失敗しました: ${message}` },
      { status: 500 }
    )
  }
}
