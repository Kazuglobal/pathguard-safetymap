import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getReportsWithProfiles, updateReportStatus } from '@/lib/admin-reports-service'

export async function GET() {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    const reports = await getReportsWithProfiles()

    return NextResponse.json({ reports })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'レポートの取得に失敗しました'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

const ALLOWED_STATUSES = ['pending', 'approved', 'published', 'resolved', 'rejected'] as const
type AllowedStatus = typeof ALLOWED_STATUSES[number]

export async function PATCH(request: NextRequest) {
  try {
    const { authorized, status, error } = await verifyAdminRequest()
    if (!authorized) {
      return NextResponse.json(
        { error: error ?? '管理者権限が必要です' },
        { status: status ?? 403 }
      )
    }

    const body = await request.json()
    const { reportId, newStatus } = body as { reportId?: string; newStatus?: string }

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({ error: 'reportId が必要です' }, { status: 400 })
    }
    if (!newStatus || !ALLOWED_STATUSES.includes(newStatus as AllowedStatus)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }

    await updateReportStatus(reportId, newStatus as AllowedStatus)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ステータス更新に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
