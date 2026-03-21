import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// モック設定
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { POST, PATCH } from '@/app/api/push/subscribe/route'

const mockUser = { id: 'user-1', email: 'test@example.com' }

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

function mockAdminUpsert(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  vi.mocked(createClient).mockReturnValue({
    from: vi.fn().mockReturnValue({ upsert }),
  } as any)
  return upsert
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('未認証の場合は401を返す', async () => {
    mockAuth(null)
    const res = await POST(makeRequest({ endpoint: 'https://example.com', p256dh: 'key', auth: 'secret' }))
    expect(res.status).toBe(401)
  })

  it('有効なリクエストでサブスクリプションを登録する', async () => {
    mockAuth(mockUser)
    mockAdminUpsert(null)

    const res = await POST(makeRequest({
      endpoint: 'https://fcm.googleapis.com/push/abc',
      p256dh: 'some-p256dh-key',
      auth: 'some-auth-secret',
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ subscribed: true })
  })

  it('無効なエンドポイントURLで400を返す', async () => {
    mockAuth(mockUser)

    const res = await POST(makeRequest({
      endpoint: 'not-a-url',
      p256dh: 'key',
      auth: 'secret',
    }))

    expect(res.status).toBe(400)
  })

  it('DBエラー時は500を返す', async () => {
    mockAuth(mockUser)
    mockAdminUpsert({ message: 'DB error' })

    const res = await POST(makeRequest({
      endpoint: 'https://fcm.googleapis.com/push/abc',
      p256dh: 'key',
      auth: 'secret',
    }))

    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/push/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('通知設定を更新する', async () => {
    mockAuth(mockUser)
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as any)

    const req = new NextRequest('http://localhost/api/push/subscribe', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/push/abc',
        preferences: { danger_reports: false, news: true, magazine: true },
      }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ updated: true })
  })
})
