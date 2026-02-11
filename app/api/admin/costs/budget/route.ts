import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getBudgetSettings, updateBudgetSettings } from '@/lib/admin-costs-service'

const VALID_PROVIDERS = ['gemini', 'openai', 'mapbox'] as const

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isFinitePercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

export async function GET() {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    const settings = await getBudgetSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('[api/admin/costs/budget] Failed to fetch budget settings:', error)
    return NextResponse.json(
      { error: '予算設定の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    const body = await request.json()
    const { provider, monthly_budget_usd, alert_threshold_percent } = body

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `provider が不正です。${VALID_PROVIDERS.join(', ')} のいずれかを指定してください` },
        { status: 400 }
      )
    }

    if (monthly_budget_usd !== undefined && !isFiniteNonNegative(monthly_budget_usd)) {
      return NextResponse.json(
        { error: 'monthly_budget_usd は 0 以上の数値を指定してください' },
        { status: 400 }
      )
    }

    if (alert_threshold_percent !== undefined && !isFinitePercent(alert_threshold_percent)) {
      return NextResponse.json(
        { error: 'alert_threshold_percent は 0〜100 の数値を指定してください' },
        { status: 400 }
      )
    }

    if (monthly_budget_usd === undefined && alert_threshold_percent === undefined) {
      return NextResponse.json(
        { error: '更新する項目がありません。monthly_budget_usd または alert_threshold_percent を指定してください' },
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
    console.error('[api/admin/costs/budget] Failed to update budget settings:', error)
    return NextResponse.json(
      { error: '予算設定の更新に失敗しました' },
      { status: 500 }
    )
  }
}
