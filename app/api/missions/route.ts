import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { listUserMissions } from '@/lib/db/repos/gamification.repo'

export const runtime = 'nodejs'

export async function GET() {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ missions: [], progress: {} })
  const result = await listUserMissions(actor, actor.id)
  return NextResponse.json({
    missions: result.missions.map((row) => ({
      id: String(row.id), title: row.title, description: row.description, period: row.period,
      target_type: row.targetType, target_value: row.targetValue ?? 0,
      reward_points: row.rewardPoints, reward_badge_id: row.rewardBadgeId,
    })),
    progress: Object.fromEntries(result.progress.map((row) => [String(row.missionId), {
      mission_id: row.missionId, progress: row.progress, completed: row.completed,
    }])),
  })
}
