import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/social.repo', () => ({
  toggleLike: mocks.toggleLike,
  toggleBookmark: mocks.toggleBookmark,
}))

import { POST } from '@/app/api/reports/[id]/interactions/[kind]/route'

const request = new Request('https://app.example/api/reports/report-1/interactions/like', {
  method: 'POST',
})

describe('report interaction D1 route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue({
      kind: 'user', id: 'user-1', email: null, isAdmin: false,
    })
  })

  it('uses the authenticated actor rather than a client-supplied user id', async () => {
    mocks.toggleLike.mockResolvedValue({ active: true, count: 4 })
    const response = await POST(request, {
      params: Promise.resolve({ id: 'report-1', kind: 'like' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ active: true, count: 4 })
    expect(mocks.toggleLike).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'report-1',
    )
  })

  it('rejects anonymous mutations', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const response = await POST(request, {
      params: Promise.resolve({ id: 'report-1', kind: 'bookmark' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.toggleBookmark).not.toHaveBeenCalled()
  })
})
