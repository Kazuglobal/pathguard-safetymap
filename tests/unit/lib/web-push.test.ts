import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), markNotified: vi.fn(), send: vi.fn(), setVapid: vi.fn() }))
vi.mock('@/lib/db/repos/push.repo', () => ({
  listPushSubscriptions: mocks.list,
  deletePushSubscriptionById: mocks.remove,
  markPushSubscriptionsNotified: mocks.markNotified,
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
    mocks.markNotified.mockResolvedValue(undefined)
    const { sendPushToUser } = await import('@/lib/web-push')
    await expect(sendPushToUser('u1', { title: '危険', body: '注意' }, 'danger_reports')).resolves.toBe(1)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    // 配信できた購読だけに時刻を残す(保持期間の掃除で、配信が続いている購読を消さないため)
    expect(mocks.markNotified).toHaveBeenCalledWith({ kind: 'service' }, ['s2'], expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
  })

  it('配信した時刻を残せなくても、送れた数はそのまま返す', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public'
    process.env.VAPID_PRIVATE_KEY = 'private'
    mocks.list.mockResolvedValue([
      { id: 's3', userId: 'u2', endpoint: 'https://push/3', p256dh: 'p', auth: 'a', notificationPreferences: {}, lastNotifiedAt: null, prefecture: null },
    ])
    mocks.send.mockResolvedValue(undefined)
    mocks.markNotified.mockRejectedValue(new Error('D1 unavailable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { sendPushToUser } = await import('@/lib/web-push')

    await expect(sendPushToUser('u2', { title: '危険', body: '注意' }, 'danger_reports')).resolves.toBe(1)
    expect(error).toHaveBeenCalledWith('[web-push] Failed to record delivery time', 'D1 unavailable')
    error.mockRestore()
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
