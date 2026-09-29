import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoQuizPlayer } from '@/components/safety-quest/hunter/routes/photo-quiz-player'
import { routeRequest } from '@/components/safety-quest/hunter/routes/route-request'
import type { PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'
vi.mock('@/components/safety-quest/hunter/routes/route-request', () => ({ routeRequest: vi.fn() }))
const initial: PhotoQuizView = { id: 'session', courseId: 'course', revision: 1, version: 0, title: '東側コース', schoolYear: 1, scenario: 'normal', stage: 'find', index: 0, total: 1, learned: [], item: { id: 'item', title: '場所1', photoUrl: '/photo.webp', hypothetical: '自転車が来たら' } }
beforeEach(() => { vi.mocked(routeRequest).mockReset(); window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis })
async function start(session = initial) {
  vi.mocked(routeRequest).mockResolvedValueOnce({ session })
  render(<PhotoQuizPlayer courseId="course" onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'はじめる・続きから遊ぶ' }))
  await screen.findByRole('img')
}
describe('PhotoQuizPlayer', () => {
  it('shows progress when automatically resuming a reason question', async () => {
    const request = vi.fn().mockResolvedValue({ session: { ...initial, stage: 'reason', question: { prompt: 'どうして？', choices: [{ id: 'a', text: '見えにくいから' }] } } })
    render(<PhotoQuizPlayer courseId="course" autoStart request={request} onClose={vi.fn()} />)
    await screen.findByRole('radio', { name: /見えにくいから/ })
    expect(screen.getByRole('progressbar', { name: 'たしかめた場所' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'この写真でクイズをはじめる' })).toBeNull()
  })
  it('opens the photo introduction without a second server start or an automatic answer', async () => {
    const request = vi.fn().mockResolvedValue({ session: initial })
    render(<PhotoQuizPlayer courseId="course" autoStart request={request} onClose={vi.fn()} />)
    fireEvent.load(await screen.findByRole('img'))
    const begin = screen.getByRole('button', { name: 'この写真でクイズをはじめる' })
    await waitFor(() => expect(begin).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'この場所をたしかめる' })).toBeNull()
    fireEvent.click(begin)
    expect(screen.getByRole('button', { name: 'この場所をたしかめる' })).toBeDisabled()
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('supports selecting a point without tapping and requires explicit confirmation', async () => {
    await start()
    const confirm = screen.getByRole('button', { name: 'この場所をたしかめる' })
    expect(confirm).toBeDisabled()
    fireEvent.load(screen.getByRole('img'))
    fireEvent.click(screen.getByText('タップの代わりに位置を選ぶ'))
    fireEvent.click(screen.getByRole('button', { name: '真ん中を選ぶ' }))
    expect(confirm).toBeEnabled()
    expect(routeRequest).toHaveBeenCalledTimes(1)
    vi.mocked(routeRequest).mockResolvedValueOnce({ session: { ...initial, version: 1, stage: 'reason', question: { prompt: 'どうして？', choices: [{ id: 'a', text: '見えにくいから' }, { id: 'b', text: '車が来ないから' }] } } })
    fireEvent.click(confirm)
    await screen.findByRole('radio', { name: /見えにくいから/ })
    expect(vi.mocked(routeRequest).mock.calls[1][1]).toMatchObject({ kind: 'point', point: { x: .5, y: .5 }, version: 0 })
    expect(screen.getByRole('button', { name: '答えをたしかめる' })).toBeDisabled()
  })
  it('reuses exactly the same request after an uncertain network failure', async () => {
    await start(); fireEvent.load(screen.getByRole('img'))
    vi.mocked(routeRequest).mockRejectedValueOnce(new Error('通信が切れました'))
    fireEvent.click(screen.getByRole('button', { name: 'ヒントを見る' }))
    await screen.findByRole('alert')
    const firstPayload = vi.mocked(routeRequest).mock.calls[1][1]
    expect(screen.getByRole('button', { name: 'ヒントを見る' })).toBeDisabled()
    vi.mocked(routeRequest).mockResolvedValueOnce({ session: { ...initial, version: 1 } })
    fireEvent.click(screen.getByRole('button', { name: '同じ回答をもう一度送る' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(vi.mocked(routeRequest).mock.calls[2][1]).toEqual(firstPayload)
  })
  it('blocks discovery while the photo failed to load', async () => {
    await start(); fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('button', { name: 'この場所をたしかめる' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ヒントを見る' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '写真を読み直す' }))
    fireEvent.load(screen.getByRole('img'))
    expect(screen.getByRole('button', { name: 'ヒントを見る' })).toBeEnabled()
  })
  it('reads the observation and imagined situation before the answer choices', async () => {
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; rate = 1; constructor(public text: string) {} })
    await start({ ...initial, stage: 'reason', item: { ...initial.item!, observed: '塀がある' }, question: { prompt: 'なぜ？', choices: [{ id: 'a', text: '向こうが見えにくい' }] } })
    fireEvent.click(screen.getByRole('button', { name: '読み上げる' }))
    expect(vi.mocked(window.speechSynthesis.speak).mock.calls[0][0].text).toContain('写真でたしかめること。塀がある。もし、こんなことが起きたら。自転車が来たら')
    vi.unstubAllGlobals()
  })
})
