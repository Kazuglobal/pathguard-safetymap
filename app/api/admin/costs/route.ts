import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'
import { getCostSummary, getDailyBreakdown, getEndpointBreakdown, getBudgetSettings } from '@/lib/admin-costs-service'

const VALID_PERIODS = ['month', 'day'] as const
type Period = (typeof VALID_PERIODS)[number]

function isValidPeriod(value: string | null): value is Period {
  return value !== null && VALID_PERIODS.includes(value as Period)
}

function isValidYearMonth(value: string | null): value is string {
  if (!value) return false
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = parseInt(value.split('-')[1], 10)
  return month >= 1 && month <= 12
}

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

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const date = searchParams.get('date')

    if (!isValidPeriod(period)) {
      return NextResponse.json(
        { error: 'period パラメータが不正です。month または day を指定してください' },
        { status: 400 }
      )
    }

    if (!isValidYearMonth(date)) {
      return NextResponse.json(
        { error: 'date パラメータが不正です。YYYY-MM 形式で指定してください' },
        { status: 400 }
      )
    }

    const [summary, daily_breakdown, by_endpoint, budgetSettings] = await Promise.all([
      getCostSummary(date),
      getDailyBreakdown(date),
      getEndpointBreakdown(date),
      getBudgetSettings(),
    ])

    // Transform summary object → providers array for the client
    const providers = (['gemini', 'openai', 'mapbox'] as const).map((key) => {
      const s = summary[key]
      const bs = budgetSettings.find((b) => b.api_provider === key)
      return {
        provider: key,
        total_cost_usd: s.total_cost,
        request_count: s.request_count,
        budget_usd: s.budget,
        alert_threshold_percent: bs?.alert_threshold_percent ?? 80,
      }
    })

    const total_cost_usd = providers.reduce((sum, p) => sum + p.total_cost_usd, 0)

    // Map endpoint field names: total_cost → cost_usd
    const endpoint_breakdown = by_endpoint.map((e) => ({
      endpoint: e.endpoint,
      cost_usd: e.total_cost,
      request_count: e.request_count,
    }))

    return NextResponse.json({
      providers,
      daily_trends: daily_breakdown,
      endpoint_breakdown,
      total_cost_usd,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました'
    return NextResponse.json(
      { error: `コストデータの取得に失敗しました: ${message}` },
      { status: 500 }
    )
  }
}
