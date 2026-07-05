import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/web-push', () => ({
  broadcastPush: vi.fn().mockResolvedValue(5),
}))

import { broadcastPush } from '@/lib/web-push'

function makeRequest(body: unknown, secret = 'test-secret') {
  return new NextRequest('http://localhost/api/push/notify-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/notify-content', () => {
  const originalVercel = process.env.VERCEL

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.CRON_SECRET = 'test-secret'
    // verifyCronSecret は Vercel 環境外では認証をスキップするため、
    // 認証ロジックを検証するテストでは VERCEL を立てて本番相当の分岐を通す。
    process.env.VERCEL = '1'
  })

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
  })

  it('CRON_SECRET認証が通らない場合は401を返す', async () => {
    const { POST } = await import('@/app/api/push/notify-content/route')
    const res = await POST(makeRequest({ type: 'news', title: 'テスト', slug: 'test-slug' }, 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('ニュース通知を送信する', async () => {
    const { POST } = await import('@/app/api/push/notify-content/route')
    const res = await POST(makeRequest({ type: 'news', title: 'テスト記事', slug: 'test-slug' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ notified: 5 })
    expect(broadcastPush).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'news-test-slug' }),
      'news'
    )
  })

  it('マガジン通知を送信する', async () => {
    const { POST } = await import('@/app/api/push/notify-content/route')
    const res = await POST(makeRequest({ type: 'magazine', title: 'マガジン記事', slug: 'magazine-slug' }))

    expect(res.status).toBe(200)
    expect(broadcastPush).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'magazine-magazine-slug' }),
      'magazine'
    )
  })

  it('無効なtypeで400を返す', async () => {
    const { POST } = await import('@/app/api/push/notify-content/route')
    const res = await POST(makeRequest({ type: 'invalid', title: 'テスト', slug: 'slug' }))
    expect(res.status).toBe(400)
  })
})
