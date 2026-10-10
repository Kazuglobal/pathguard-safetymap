// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const repos = vi.hoisted(() => ({ options: vi.fn(), district: vi.fn(), alerts: vi.fn() }))
vi.mock('@/lib/auth/actor', () => ({ getActor: async () => ({ kind: 'anon' }) }))
vi.mock('@/lib/db/repos/school-districts.repo', () => ({ getSchoolDistrictOptions: repos.options, getSchoolDistrict: repos.district }))
vi.mock('@/lib/db/repos/push.repo', () => ({ listLocalSafetyAlerts: repos.alerts }))
import { GET as getOptions } from '@/app/api/school-districts/route'
import { GET as getAlerts } from '@/app/api/local-safety-alerts/route'
beforeEach(() => { vi.clearAllMocks(); repos.alerts.mockResolvedValue([]); repos.district.mockResolvedValue({ id: 'district-a', prefecture: '東京都' }) })
describe('district selection APIs', () => {
  it('serves public master options independently of alert records', async () => {
    repos.options.mockResolvedValue({ cities: ['新宿区'], districts: [] })
    const response = await getOptions(new Request('https://example.test/api/school-districts?prefecture=東京都'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ cities: ['新宿区'], districts: [] })
    expect(repos.alerts).not.toHaveBeenCalled()
  })
  it('validates region inputs and distinguishes master failures', async () => {
    expect((await getOptions(new Request('https://example.test/api/school-districts?prefecture=全国'))).status).toBe(400)
    repos.options.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await getOptions(new Request('https://example.test/api/school-districts?prefecture=東京都'))).status).toBe(503)
  })
  it('passes district filtering into the repository and preserves legacy prefecture queries', async () => {
    expect((await getAlerts(new Request('https://example.test/api/local-safety-alerts?schoolDistrictId=district-a&prefecture=東京都'))).status).toBe(200)
    expect(repos.alerts).toHaveBeenLastCalledWith({ kind: 'anon' }, expect.objectContaining({ schoolDistrictId: 'district-a', limit: 50 }))
    expect((await getAlerts(new Request('https://example.test/api/local-safety-alerts?prefecture=東京都'))).status).toBe(200)
    expect(repos.alerts.mock.calls[1][1]).not.toHaveProperty('schoolDistrictId')
  })
  it('rejects unknown and inconsistent districts before querying any alerts', async () => {
    repos.district.mockResolvedValueOnce(null)
    expect((await getAlerts(new Request('https://example.test/api/local-safety-alerts?schoolDistrictId=unknown'))).status).toBe(404)
    expect((await getAlerts(new Request('https://example.test/api/local-safety-alerts?schoolDistrictId=district-a&prefecture=大阪府'))).status).toBe(400)
    expect((await getAlerts(new Request('https://example.test/api/local-safety-alerts?schoolDistrictId='))).status).toBe(400)
    expect(repos.alerts).not.toHaveBeenCalled()
  })
})
