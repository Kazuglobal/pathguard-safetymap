import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockRedirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}))

import ThreeDRoutePocPage from '@/app/3d-route-poc/page'

describe('3d-route-poc page auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証時は /login にリダイレクトする', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
    })

    await ThreeDRoutePocPage()

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('認証済み時はリダイレクトしない', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
    })

    await ThreeDRoutePocPage()

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
