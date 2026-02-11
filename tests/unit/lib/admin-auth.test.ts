import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

import { getCurrentUserAdminStatus, verifyAdminRequest } from '@/lib/admin-auth'

describe('admin-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未認証ユーザーは管理者ではない', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const status = await getCurrentUserAdminStatus()

    expect(status).toEqual({
      isAuthenticated: false,
      isAdmin: false,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('管理者メールは role 照会なしで管理者扱いになる', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1', email: 'globalbunny77@gmail.com' } },
      error: null,
    })

    const status = await getCurrentUserAdminStatus()

    expect(status).toEqual({
      isAuthenticated: true,
      isAdmin: true,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('管理者メールでなくても profile.role=admin なら管理者になる', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-2', email: 'member@example.com' } },
      error: null,
    })
    mockMaybeSingle.mockResolvedValueOnce({
      data: { role: 'admin' },
      error: null,
    })

    const status = await getCurrentUserAdminStatus()

    expect(status).toEqual({
      isAuthenticated: true,
      isAdmin: true,
    })
  })

  it('profile.role 照会が失敗した場合は管理者として扱わない', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-3', email: 'member@example.com' } },
      error: null,
    })
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'query failed' },
    })

    const status = await getCurrentUserAdminStatus()

    expect(status).toEqual({
      isAuthenticated: true,
      isAdmin: false,
    })
  })

  it('verifyAdminRequest は未認証時に 401 を返す', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const result = await verifyAdminRequest()

    expect(result).toEqual({
      authorized: false,
      status: 401,
      error: '認証が必要です',
    })
  })

  it('verifyAdminRequest は非管理者に 403 を返す', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-4', email: 'member@example.com' } },
      error: null,
    })
    mockMaybeSingle.mockResolvedValueOnce({
      data: { role: 'member' },
      error: null,
    })

    const result = await verifyAdminRequest()

    expect(result).toEqual({
      authorized: false,
      status: 403,
      error: '管理者権限が必要です',
    })
  })

  it('verifyAdminRequest は管理者を通す', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-5', email: 'globalbunny77@gmail.com' } },
      error: null,
    })

    const result = await verifyAdminRequest()

    expect(result).toEqual({
      authorized: true,
    })
  })
})
