import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import ImageGenLayout from '@/app/tools/image-gen/layout'

const ADMIN_EMAIL = 'admin-for-test@example.com'

// 開発・試作の画面は管理者だけが開ける(判定はサーバで。UIUX改装 項目53)
describe.each([
  { name: '3D通学路(試作)', path: '/3d-route-poc', open: () => ThreeDRoutePocPage() },
  { name: '画像生成', path: '/tools/image-gen', open: () => ImageGenLayout({ children: null }) },
])('$name の画面の管理者チェック', ({ path, open }) => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAILS = ADMIN_EMAIL
  })

  afterEach(() => {
    delete process.env.ADMIN_EMAILS
  })

  it('ログインしていなければ、戻り先つきのログインへ送る', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    await expect(open()).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(path)}`)
  })

  it('ログインしていても管理者でなければ /access-denied へ送る', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1', email: 'parent@example.com' } }, error: null })

    await expect(open()).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/access-denied')
  })

  it('管理者なら開ける', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } }, error: null })

    await open()

    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
