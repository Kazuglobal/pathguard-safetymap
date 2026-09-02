import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  isAdminUser: vi.fn(),
}))

import { isAdminUser } from '@/lib/admin'
import { actorFromUser, resolveActor } from '@/lib/auth/actor'
import { createServerClient } from '@/lib/supabase-server'

describe('Supabase-backed request actor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps an authenticated user through the single admin predicate', () => {
    vi.mocked(isAdminUser).mockReturnValue(true)

    expect(actorFromUser({ id: 'admin-1', email: 'ADMIN@example.com' })).toEqual({
      kind: 'user',
      id: 'admin-1',
      email: 'ADMIN@example.com',
      isAdmin: true,
    })
    expect(isAdminUser).toHaveBeenCalledWith({ id: 'admin-1', email: 'ADMIN@example.com' })
  })

  it('returns an anonymous actor for a missing user', () => {
    expect(actorFromUser(null)).toEqual({ kind: 'anon' })
  })

  it('uses getUser so deleted, banned, and signed-out users are revalidated', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    })
    vi.mocked(createServerClient).mockResolvedValue({ auth: { getUser } } as never)
    vi.mocked(isAdminUser).mockReturnValue(false)

    await expect(resolveActor()).resolves.toEqual({
      kind: 'user',
      id: 'user-1',
      email: 'user@example.com',
      isAdmin: false,
    })
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('fails closed to anonymous when Supabase rejects the session', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error('invalid session'),
    })
    vi.mocked(createServerClient).mockResolvedValue({ auth: { getUser } } as never)

    await expect(resolveActor()).resolves.toEqual({ kind: 'anon' })
  })
})
