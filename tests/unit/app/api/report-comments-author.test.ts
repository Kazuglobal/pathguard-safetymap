// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getActor: vi.fn(), listComments: vi.fn() }))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/social.repo', () => ({ listComments: mocks.listComments, addComment: vi.fn() }))

import { GET } from '@/app/api/reports/[id]/comments/route'

const row = (id: string, userId: string) => ({
  id, content: '気をつけます', createdAt: '2026-10-29T07:00:00.000Z', updatedAt: '2026-10-29T07:00:00.000Z',
  userId, reportId: 'report-1', isEdited: false, parentCommentId: null, displayName: 'ニックネーム',
})

async function commentsAs(actor: unknown) {
  mocks.getActor.mockResolvedValue(actor)
  const response = await GET(new Request('http://localhost/api/reports/report-1/comments'), { params: Promise.resolve({ id: 'report-1' }) })
  return ((await response.json()) as { comments: Array<{ id: string; user_id: string | null }> }).comments
}

beforeEach(() => {
  vi.clearAllMocks()
  // 報告の投稿者(owner-1)が自分の報告にコメントしている
  mocks.listComments.mockResolvedValue([row('by-owner', 'owner-1'), row('by-viewer', 'viewer-1')])
})

describe('コメントを書いた人の id(UIUX改装 項目61)', () => {
  it('未ログイン・ほかの人には返さない(報告の投稿者のコメントから投稿者の id が分からない)', async () => {
    expect((await commentsAs({ kind: 'anon' })).map((comment) => comment.user_id)).toEqual([null, null])
    expect((await commentsAs({ kind: 'user', id: 'viewer-1', email: null, isAdmin: false })).map((comment) => comment.user_id))
      .toEqual([null, 'viewer-1'])
  })

  it('管理者には返す', async () => {
    expect((await commentsAs({ kind: 'user', id: 'admin-1', email: null, isAdmin: true })).map((comment) => comment.user_id))
      .toEqual(['owner-1', 'viewer-1'])
  })
})
