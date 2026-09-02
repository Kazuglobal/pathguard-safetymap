import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { listNotifications, markNotificationsRead } from '@/lib/db/repos/notifications.repo'

export const runtime = 'nodejs'

export async function GET() {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ notifications: [] })
  const rows = await listNotifications(actor)
  return NextResponse.json({ notifications: rows.map((row) => ({
    id: row.id, user_id: row.userId, report_id: row.reportId, type: row.type,
    title: row.title, content: row.content, link: row.link, is_read: row.isRead, created_at: row.createdAt,
  })) })
}

export async function PATCH(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json() as Record<string, unknown>
    if (body.id != null && (typeof body.id !== 'string' || body.id.length > 128)) {
      return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 })
    }
    await markNotificationsRead(actor, typeof body.id === 'string' ? body.id : undefined)
    return NextResponse.json({ updated: true })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
