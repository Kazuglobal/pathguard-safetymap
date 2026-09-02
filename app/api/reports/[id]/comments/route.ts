import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { addComment, listComments } from '@/lib/db/repos/social.repo'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const actor = await getActor()
  try {
    const { id } = await context.params
    const rows = await listComments(actor, id)
    if (!rows) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ comments: rows.map((row) => ({
      id: row.id, content: row.content, created_at: row.createdAt, updated_at: row.updatedAt,
      user_id: row.userId, report_id: row.reportId, is_edited: row.isEdited,
      parent_comment_id: row.parentCommentId, profiles: { display_name: row.displayName },
    })) })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to list comments' }, { status: 500 })
  }
}

export async function POST(request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    if (typeof body.content !== 'string') throw new RangeError('Invalid comment')
    const comment = await addComment(actor, id, body.content,
      typeof body.parent_comment_id === 'string' ? body.parent_comment_id : null)
    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
