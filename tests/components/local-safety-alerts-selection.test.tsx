import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalSafetyAlertsSection } from '@/components/landing/LocalSafetyAlertsSection'
import { ALERTS_REGION_STORAGE_KEY, CITY_STORAGE_KEY, REGION_STORAGE_KEY, SCHOOL_DISTRICT_STORAGE_KEY } from '@/lib/user-region'
import { REGION_REQUEST_TIMEOUT_MS } from '@/lib/region-request'

vi.mock('@/hooks/use-push-subscription', () => ({ syncPushSubscriptionRegion: vi.fn() }))
const district = { id: '13104:B1', municipalityCode: '13104', schoolCode: 'B1', prefecture: '東京都', city: '新宿区', name: '第一小学校', dataYear: 2023, sourceUrl: 'https://nlftp.mlit.go.jp/' }
const fetchMock = vi.fn()
function mount() { return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><LocalSafetyAlertsSection /></SWRConfig>) }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const alertsPayload = { alerts: [{ id: 'alert1', prefecture: '東京都', city: '新宿区', category: 'suspicious', description: '選択した学区の情報です', occurred_at: new Date().toISOString() }] }
const defaultResponse = async (input: string) => input.startsWith('/api/school-districts') ? json({ cities: ['新宿区'], districts: input.includes('city=') ? [district] : [] }) : json(alertsPayload)
const storedAlertsRegion = () => JSON.parse(localStorage.getItem(ALERTS_REGION_STORAGE_KEY) ?? 'null')
const masterCalls = (filter: (params: URLSearchParams) => boolean) => fetchMock.mock.calls
  .map(([url]) => new URL(url, 'https://example.test'))
  .filter(url => url.pathname === '/api/school-districts' && filter(url.searchParams))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
/** 中止されるまで応答しない(実際の fetch と同じく中止で AbortError を投げる) */
function stalled(init?: RequestInit) {
  return new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
}
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(defaultResponse)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
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
    expect(storedAlertsRegion()).toEqual({ prefecture: '東京都', city: '新宿区', schoolDistrictId: district.id })
  })
  it('does not mistake unavailable master data for no alerts', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    fetchMock.mockResolvedValue(json({ cities: [], districts: [] }))
    mount()
    await screen.findByText('この地域の小学校区データは現在未対応です。')
    expect(screen.queryByText(/新しいアラートは/)).not.toBeInTheDocument()
  })
  it('reports a failed master request with its reason and without fetching nationwide alerts', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    fetchMock.mockResolvedValue(json({ error: 'unavailable' }, 503))
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('市区町村の一覧を読み込めませんでした。')
    expect(alert).toHaveTextContent('サーバーが一時的に応答できません。')
    expect(within(alert).getByRole('button', { name: 'もう一度読み込む' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
  })
  it('persists clearing the prefecture without touching the report filter’s city', async () => {
    localStorage.setItem(REGION_STORAGE_KEY, '東京都')
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区' }))
    localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区', id: district.id }))
    mount()
    await screen.findByText('選択した学区の情報です')
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '' } })
    expect(localStorage.getItem(REGION_STORAGE_KEY)).toBe('全国')
    expect(storedAlertsRegion()).toEqual({ prefecture: '', city: null, schoolDistrictId: null })
    // 共有の市町村キーは報告フィルタの旧データでもあるため消さない
    expect(JSON.parse(localStorage.getItem(CITY_STORAGE_KEY) ?? 'null')).toEqual({ prefecture: '東京都', city: '新宿区' })
    expect(screen.queryByText('選択した学区の情報です')).not.toBeInTheDocument()
  })
  it('never combines a saved district with a municipality it does not belong to', async () => {
    localStorage.setItem(ALERTS_REGION_STORAGE_KEY, JSON.stringify({ prefecture: '東京都', city: '新宿区', schoolDistrictId: '27100:Z9' }))
    mount()
    await screen.findByRole('option', { name: /第一小学校/ })
    expect(screen.getByLabelText('小学校区')).toHaveValue('')
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/school-districts'))).toBe(true)
    await waitFor(() => expect(storedAlertsRegion()).toEqual({ prefecture: '東京都', city: '新宿区', schoolDistrictId: null }))
  })
})
describe('loading states of the region selects', () => {
  it('keeps the chosen city selected and enabled while its districts load', async () => {
    const districtsResponse = deferred<Response>()
    fetchMock.mockImplementation(async (input: string) => input.startsWith('/api/school-districts?') && input.includes('city=')
      ? districtsResponse.promise
      : input.startsWith('/api/school-districts') ? json({ cities: ['新宿区', '渋谷区'], districts: [] }) : json(alertsPayload))
    mount()
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })
    await screen.findByRole('option', { name: '新宿区' })
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '新宿区' } })

    const citySelect = screen.getByLabelText('市区町村')
    const districtSelect = screen.getByLabelText('小学校区')
    expect(citySelect).toHaveValue('新宿区')
    expect(citySelect).toBeEnabled()
    expect(within(citySelect).getByRole('option', { name: '渋谷区' })).toBeInTheDocument()
    expect(within(citySelect).queryByRole('option', { name: '読み込み中…' })).not.toBeInTheDocument()
    expect(districtSelect).toBeDisabled()
    expect(within(districtSelect).getByRole('option', { name: '読み込み中…' })).toBeInTheDocument()
    expect(screen.queryByText('学区情報を読み込んでいます…')).not.toBeInTheDocument()
    // 市区町村を選んでも市区町村の一覧は取り直さない
    expect(masterCalls(params => !params.has('city'))).toHaveLength(1)

    await act(async () => { districtsResponse.resolve(json({ cities: ['新宿区', '渋谷区'], districts: [district] })) })
    await screen.findByRole('option', { name: '第一小学校' })
    expect(citySelect).toHaveValue('新宿区')
    expect(districtSelect).toBeEnabled()
  })
  it('shows loading only on the city select while the cities load', async () => {
    const citiesResponse = deferred<Response>()
    fetchMock.mockImplementation(async (input: string) => input.startsWith('/api/school-districts') ? citiesResponse.promise : json(alertsPayload))
    mount()
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })

    expect(screen.getByLabelText('都道府県')).toBeEnabled()
    expect(within(screen.getByLabelText('市区町村')).getByRole('option', { name: '読み込み中…' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('小学校区')).queryByRole('option', { name: '読み込み中…' })).not.toBeInTheDocument()

    await act(async () => { citiesResponse.resolve(json({ cities: ['新宿区'], districts: [] })) })
    await screen.findByRole('option', { name: '新宿区' })
    expect(within(screen.getByLabelText('市区町村')).queryByRole('option', { name: '読み込み中…' })).not.toBeInTheDocument()
  })
  it('gives up a stalled request after the timeout, explains why and retries on demand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let stall = true
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => stall && input.startsWith('/api/school-districts') ? stalled(init) : defaultResponse(input))
    mount()
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })
    const citySelect = screen.getByLabelText('市区町村')
    expect(citySelect).toBeDisabled()
    expect(within(citySelect).getByRole('option', { name: '読み込み中…' })).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(REGION_REQUEST_TIMEOUT_MS) })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('市区町村の一覧を読み込めませんでした。')
    expect(alert).toHaveTextContent('時間内に応答がありませんでした。')
    expect(within(citySelect).queryByRole('option', { name: '読み込み中…' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)

    stall = false
    fireEvent.click(within(alert).getByRole('button', { name: 'もう一度読み込む' }))
    await screen.findByRole('option', { name: '新宿区' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(citySelect).toBeEnabled()
  })
  it('reports a failed district request without locking the city select, and retries it', async () => {
    let failDistricts = true
    fetchMock.mockImplementation(async (input: string) => failDistricts && input.startsWith('/api/school-districts?') && input.includes('city=')
      ? json({ error: 'unavailable' }, 503)
      : defaultResponse(input))
    mount()
    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })
    await screen.findByRole('option', { name: '新宿区' })
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '新宿区' } })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('小学校区の一覧を読み込めませんでした。')
    expect(screen.getByLabelText('市区町村')).toBeEnabled()
    expect(screen.getByLabelText('市区町村')).toHaveValue('新宿区')
    expect(screen.getByLabelText('小学校区')).toBeDisabled()

    failDistricts = false
    fireEvent.click(within(alert).getByRole('button', { name: 'もう一度読み込む' }))
    await screen.findByRole('option', { name: '第一小学校' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('小学校区')).toBeEnabled()
  })
})
