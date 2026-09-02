import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), send: vi.fn(), setVapid: vi.fn() }))
vi.mock('@/lib/db/repos/push.repo', () => ({
  listPushSubscriptions: mocks.list,
  deletePushSubscriptionById: mocks.remove,
}))
vi.mock('web-push', () => ({ default: { sendNotification: mocks.send, setVapidDetails: mocks.setVapid } }))

describe('web-push with D1 subscriptions', () => {
  beforeEach(() => vi.resetModules())

  it('filters disabled preferences and sends enabled subscriptions', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public'
    process.env.VAPID_PRIVATE_KEY = 'private'
    mocks.list.mockResolvedValue([
      { id: 's1', userId: 'u1', endpoint: 'https://push/1', p256dh: 'p', auth: 'a', notificationPreferences: { danger_reports: false }, lastNotifiedAt: null, prefecture: null },
      { id: 's2', userId: 'u1', endpoint: 'https://push/2', p256dh: 'p', auth: 'a', notificationPreferences: { danger_reports: true }, lastNotifiedAt: null, prefecture: null },
    ])
    mocks.send.mockResolvedValue(undefined)
    const { sendPushToUser } = await import('@/lib/web-push')
    await expect(sendPushToUser('u1', { title: '危険', body: '注意' }, 'danger_reports')).resolves.toBe(1)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('removes expired subscriptions after a 410 response', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public'
    process.env.VAPID_PRIVATE_KEY = 'private'
    mocks.send.mockRejectedValue({ statusCode: 410 })
    const { sendPushNotification } = await import('@/lib/web-push')
    await expect(sendPushNotification({
      id: 's1', user_id: 'u1', endpoint: 'https://push/1', p256dh: 'p', auth: 'a',
      notification_preferences: {}, last_notified_at: null,
    }, { title: '危険', body: '注意' })).resolves.toEqual({ success: false, removed: true })
    expect(mocks.remove).toHaveBeenCalledWith({ kind: 'service' }, 's1')
  })
})
