import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

import ThreeDRoutePocPage from '@/app/3d-route-poc/page'

describe('3d-route-poc page auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証時は /login にリダイレクトする', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    })

    await expect(ThreeDRoutePocPage()).rejects.toThrow('NEXT_REDIRECT')

    expect(mockGetUser).toHaveBeenCalledTimes(1)
    // ログイン後に同じ画面へ戻れるよう、戻り先(next)つきでログインへ送る
    expect(mockRedirect).toHaveBeenCalledWith('/login?next=%2F3d-route-poc')
  })

  it('認証済み時はリダイレクトしない', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    })

    await ThreeDRoutePocPage()

    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
