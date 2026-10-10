import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalSafetyAlertsSection } from '@/components/landing/LocalSafetyAlertsSection'
import { CITY_STORAGE_KEY, REGION_STORAGE_KEY, SCHOOL_DISTRICT_STORAGE_KEY } from '@/lib/user-region'

vi.mock('@/hooks/use-push-subscription', () => ({ syncPushSubscriptionRegion: vi.fn() }))
const district = { id: '13104:B1', municipalityCode: '13104', schoolCode: 'B1', prefecture: '東京都', city: '新宿区', name: '第一小学校', dataYear: 2023, sourceUrl: 'https://nlftp.mlit.go.jp/' }
const fetchMock = vi.fn()
function mount() { return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><LocalSafetyAlertsSection /></SWRConfig>) }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (input: string) => input.startsWith('/api/school-districts') ? json({ cities: ['新宿区'], districts: input.includes('city=') ? [district] : [] }) : json({ alerts: [{ id: 'alert1', prefecture: '東京都', city: '新宿区', category: 'suspicious', description: '選択した学区の情報です', occurred_at: new Date().toISOString() }] }))
})
afterEach(() => { vi.unstubAllGlobals() })
describe('required school district selection', () => {
  it('makes no request until a region is chosen and no alert request until the district is chosen', async () => {
    mount()
    expect(screen.getByText('地域と小学校区を選ぶと、この地域の最新情報を確認できます。')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })
    await screen.findByRole('option', { name: '新宿区' })
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '新宿区' } })
    await screen.findByRole('option', { name: /第一小学校/ })
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
    fireEvent.change(screen.getByLabelText('小学校区'), { target: { value: district.id } })
    await screen.findByText('選択した学区の情報です')
    expect(fetchMock.mock.calls.some(([url]) => new URL(url, 'https://example.test').searchParams.get('schoolDistrictId') === district.id)).toBe(true)
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '大阪府' } })
    expect(screen.queryByText('選択した学区の情報です')).not.toBeInTheDocument()
    expect(screen.getByLabelText('市区町村')).toHaveValue('')
    expect(screen.getByLabelText('小学校区')).toHaveValue('')
  })
  it('restores a saved selection only after validating it against the master', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区' }))
    localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区', id: district.id }))
    mount()
    await screen.findByText('選択した学区の情報です')
    expect(fetchMock.mock.calls[0][0]).toMatch('/api/school-districts?')
    expect(screen.getByLabelText('小学校区')).toHaveValue(district.id)
  })
  it('does not mistake unavailable master data for no alerts', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    fetchMock.mockResolvedValue(json({ cities: [], districts: [] }))
    mount()
    await screen.findByText('この地域の小学校区データは現在未対応です。')
    expect(screen.queryByText(/新しいアラートは/)).not.toBeInTheDocument()
  })
  it('reports a failed master request without fetching nationwide alerts', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    fetchMock.mockResolvedValue(json({ error: 'unavailable' }, 503))
    mount()
    await screen.findByText('学区情報の読み込みに失敗しました。')
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
  })
  it('persists clearing the prefecture and removes the previous city and district', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区' }))
    localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区', id: district.id }))
    mount()
    await screen.findByText('選択した学区の情報です')
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '' } })
    expect(localStorage.getItem(REGION_STORAGE_KEY)).toBe('全国')
    expect(localStorage.getItem(CITY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(SCHOOL_DISTRICT_STORAGE_KEY)).toBeNull()
    expect(screen.queryByText('選択した学区の情報です')).not.toBeInTheDocument()
  })
  it('does not restore a district saved for a different municipality', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区' }))
    localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify({ prefecture: '大阪府', city: '大阪市', id: district.id }))
    mount()
    await screen.findByRole('option', { name: /第一小学校/ })
    expect(screen.getByLabelText('小学校区')).toHaveValue('')
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
  })
})
