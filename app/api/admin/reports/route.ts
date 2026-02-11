import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getReportsWithProfiles } from '@/lib/admin-reports-service'

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
