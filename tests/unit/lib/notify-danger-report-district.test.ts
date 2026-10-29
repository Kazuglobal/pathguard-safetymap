// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listNotificationRoutes: vi.fn(),
  listDistrictBoundariesAround: vi.fn(),
  listDistrictNotificationUsers: vi.fn(),
  sendPushToUser: vi.fn(),
}))

vi.mock('@/lib/db/repos/push.repo', () => ({
  claimDangerReport: vi.fn(),
  completeDangerReportClaim: vi.fn(),
  confirmDangerReportClaim: vi.fn(),
  releaseDangerReportClaim: vi.fn(),
  listNotificationRoutes: mocks.listNotificationRoutes,
  listDistrictBoundariesAround: mocks.listDistrictBoundariesAround,
  listDistrictNotificationUsers: mocks.listDistrictNotificationUsers,
}))
vi.mock('@/lib/web-push', () => ({ sendPushToUser: mocks.sendPushToUser }))
vi.mock('@/lib/auth/service-actor', () => ({ getServiceActor: () => ({ kind: 'service' }) }))

import { notifyUsersNearReport } from '@/lib/push-notifications/notify-danger-report'

const DISTRICT_POLYGON = { type: 'Polygon' as const, coordinates: [[[139.0, 35.0], [139.02, 35.0], [139.02, 35.02], [139.0, 35.02], [139.0, 35.0]]] }
const report = { id: 'report-1', dangerType: 'traffic', prefecture: '東京都', latitude: 35.01, longitude: 139.01 }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listNotificationRoutes.mockResolvedValue([])
  mocks.listDistrictBoundariesAround.mockResolvedValue([{ districtId: 'd1', name: '第一小学校区', geometry: DISTRICT_POLYGON }])
  mocks.listDistrictNotificationUsers.mockResolvedValue([{ userId: 'coarse-1', districtId: 'd1' }])
  mocks.sendPushToUser.mockResolvedValue(1)
})

describe('「粗く保存」の人には小学校区で知らせる(UIUX改装 項目59)', () => {
  it('報告の地点を含む小学校区にお子さまを登録している人へ、学区の名前で知らせる', async () => {
    const notified = await notifyUsersNearReport(report)

    expect(notified).toBe(1)
    expect(mocks.listDistrictNotificationUsers).toHaveBeenCalledWith({ kind: 'service' }, ['d1'])
    expect(mocks.sendPushToUser).toHaveBeenCalledWith('coarse-1', expect.objectContaining({ title: '第一小学校区で危険報告' }), 'danger_reports')
  })

  it('矩形には入っても学区の外の地点なら知らせない', async () => {
    await notifyUsersNearReport({ ...report, latitude: 35.03, longitude: 139.03 })

    expect(mocks.listDistrictNotificationUsers).not.toHaveBeenCalled()
    expect(mocks.sendPushToUser).not.toHaveBeenCalled()
  })

  it('学区の境界の道の上(境界から 50m 以内)の報告は、境界のすぐ外でも知らせる', async () => {
    // 学区の東の境界(139.02)の約30m外
    await notifyUsersNearReport({ ...report, latitude: 35.01, longitude: 139.0203 })

    expect(mocks.listDistrictNotificationUsers).toHaveBeenCalledWith({ kind: 'service' }, ['d1'])
    expect(mocks.sendPushToUser).toHaveBeenCalledWith('coarse-1', expect.objectContaining({ title: '第一小学校区で危険報告' }), 'danger_reports')
  })

  it('通学路の近くで知らせる人には、学区の知らせを重ねて送らない', async () => {
    mocks.listNotificationRoutes.mockResolvedValue([{ id: 'route-1', userId: 'coarse-1', name: '通学路', routeGeometry: { type: 'LineString', coordinates: [[139.0099, 35.01], [139.0101, 35.01]] } }])

    await notifyUsersNearReport(report)

    expect(mocks.sendPushToUser).toHaveBeenCalledTimes(1)
    expect(mocks.sendPushToUser).toHaveBeenCalledWith('coarse-1', expect.objectContaining({ title: '近隣の通学路に危険報告' }), 'danger_reports')
  })
})
