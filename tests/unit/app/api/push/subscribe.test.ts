import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(), get: vi.fn(), upsert: vi.fn(), patch: vi.fn(),
}))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/push.repo', () => ({
  getPushSubscription: mocks.get,
  upsertPushSubscription: mocks.upsert,
  patchPushSubscription: mocks.patch,
}))

import { GET, PATCH, POST } from '@/app/api/push/subscribe/route'

const actor = { kind: 'user', id: 'user-1', email: 'u@example.com', isAdmin: false } as const
const endpoint = 'https://fcm.googleapis.com/push/abc'
const bodyRequest = (method: string, body: unknown) => new NextRequest('http://localhost/api/push/subscribe', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('push subscription D1 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(actor)
  })

  it('requires authentication and validates endpoint URLs', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    expect((await POST(bodyRequest('POST', { endpoint, p256dh: 'p', auth: 'a' }))).status).toBe(401)
    mocks.getActor.mockResolvedValue(actor)
    expect((await POST(bodyRequest('POST', { endpoint: 'bad', p256dh: 'p', auth: 'a' }))).status).toBe(400)
  })

  it('upserts a validated subscription with normalized preferences', async () => {
    mocks.upsert.mockResolvedValue(undefined)
    const response = await POST(bodyRequest('POST', { endpoint, p256dh: 'p', auth: 'a', prefecture: '東京都' }))
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(actor, expect.objectContaining({ endpoint, prefecture: '東京都' }))
  })

  it('reads and patches only the actor subscription', async () => {
    mocks.get.mockResolvedValue({ notificationPreferences: { danger_reports: false } })
    const getResponse = await GET(new NextRequest(`http://localhost/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`))
    expect(await getResponse.json()).toEqual({ subscribed: true, preferences: { danger_reports: false } })
    mocks.patch.mockResolvedValue({ id: 'sub-1' })
    const patchResponse = await PATCH(bodyRequest('PATCH', { endpoint, preferences: { danger_reports: true } }))
    expect(await patchResponse.json()).toEqual({ updated: true })
    expect(mocks.patch).toHaveBeenCalledWith(actor, endpoint, expect.objectContaining({ preferences: expect.any(Object) }))
  })
})
