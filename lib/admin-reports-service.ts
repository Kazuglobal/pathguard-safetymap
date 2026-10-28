import { inArray } from 'drizzle-orm'

import { getActor } from '@/lib/auth/actor'
import { toDangerReportJson } from '@/lib/danger-report-api'
import { assertCan } from '@/lib/db/authz'
import { getDb } from '@/lib/db/client'
import { listDangerReports, updateDangerReportStatus } from '@/lib/db/repos/danger-reports.repo'
import { profiles } from '@/lib/db/schema'
import { getLeaderboardExclusions, isLeaderboardExcludedEmail } from '@/lib/leaderboard-exclusions'

const D1_IN_CLAUSE_CHUNK_SIZE = 50

export type ReportWithProfile = ReturnType<typeof toDangerReportJson> & {
  profiles: { display_name: string | null } | null
  /** 投稿者がデモ・テストアカウントか(審査キューでデモ用サンプルを隠すため)。メール自体は返さない */
  owner_excluded: boolean
}

async function requireAdminActor() {
  const actor = await getActor()
  if (actor.kind !== 'user' || !actor.isAdmin) throw new Error('管理者権限が必要です')
  return actor
}

export async function getReportsWithProfiles(): Promise<ReportWithProfile[]> {
  const actor = await requireAdminActor()
  const reports = await listDangerReports(actor, { limit: 2_000 })
  if (!reports.length) return []
  // メールはデモ・テストアカウントの判定にだけ使い、レスポンスには含めない(管理者だけが通る経路)。
  assertCan(actor, 'select', 'profiles')
  const userIds = [...new Set(reports.map((report) => report.userId))]
  const db = getDb()
  const profileRows = []
  for (let offset = 0; offset < userIds.length; offset += D1_IN_CLAUSE_CHUNK_SIZE) {
    const chunk = userIds.slice(offset, offset + D1_IN_CLAUSE_CHUNK_SIZE)
    profileRows.push(...await db.select({ id: profiles.id, displayName: profiles.displayName, email: profiles.email })
      .from(profiles).where(inArray(profiles.id, chunk)))
  }
  const byId = new Map(profileRows.map((profile) => [profile.id, profile.displayName]))
  const exclusions = getLeaderboardExclusions()
  const excludedOwnerIds = new Set(profileRows
    .filter((profile) => isLeaderboardExcludedEmail(profile.email, exclusions))
    .map((profile) => profile.id))
  return reports.map((report) => ({
    ...toDangerReportJson(report),
    profiles: byId.has(report.userId) ? { display_name: byId.get(report.userId) ?? null } : null,
    owner_excluded: excludedOwnerIds.has(report.userId),
  }))
}

export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'approved' | 'published' | 'resolved' | 'rejected',
): Promise<void> {
  await updateDangerReportStatus(await requireAdminActor(), reportId, status)
}
