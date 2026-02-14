import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Database } from '@/lib/database.types'

type DangerReportRow = Database['public']['Tables']['danger_reports']['Row']

interface ProfileEntry {
  id: string
  display_name: string | null
}

export interface ReportWithProfile extends DangerReportRow {
  profiles: { display_name: string | null } | null
}

// danger_reports には profiles への FK がないため、
// 2 つのクエリで取得し、メモリ上で結合する
export async function getReportsWithProfiles(): Promise<ReportWithProfile[]> {
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('danger_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (reportsError) {
    throw new Error(`レポートの取得に失敗しました: ${reportsError.message}`)
  }

  const rows = reports ?? []
  if (rows.length === 0) {
    return []
  }

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]

  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  if (profilesError) {
    throw new Error(`プロフィールの取得に失敗しました: ${profilesError.message}`)
  }

  const profileMap = new Map<string, ProfileEntry>(
    ((profilesData ?? []) as ProfileEntry[]).map((p) => [p.id, p])
  )

  return rows.map((report) => {
    const profile = profileMap.get(report.user_id) ?? null
    return {
      ...report,
      profiles: profile ? { display_name: profile.display_name } : null,
    }
  })
}
