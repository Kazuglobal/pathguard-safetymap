import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RouteNotebook } from '@/components/safety-quest/hunter/routes/route-notebook'
vi.mock('@/components/safety-quest/hunter/routes/school-panel', () => ({ SchoolPanel: () => null }))
const course = { id: 'own', revision: 1, title: '東側コース', scenes: [{ id: 'scene', name: '曲がり角', photoCount: 1 }], learningMode: 'photo-quiz-v1', ownedByMe: true, canEdit: true, published: false, status: 'ready' }
describe('RouteNotebook', () => {
  it('keeps other owners unpublished courses accessible to teachers in management', async () => {
    window.scrollTo = vi.fn()
    const draft = { ...course, id: 'draft', title: '確認待ちコース', ownedByMe: false }
    const request = vi.fn(async (path: string) => path.endsWith('/quiz') ? { outline: { items: [], latestCompleted: null } } : path.endsWith('/routes') ? { courses: [draft] } : { course: draft })
    render(<RouteNotebook refreshKey={0} request={request} onCreate={vi.fn()} />)
    await waitFor(() => expect(request).toHaveBeenCalled())
    fireEvent.click(screen.getByText('学校で使う場合の設定（任意）'))
    fireEvent.click(await screen.findByRole('button', { name: '確認待ちコースの下書きを確認' }))
    await screen.findByRole('heading', { name: '確認待ちコース' })
    expect(screen.getByText('写真・問題の編集')).toBeInTheDocument()
  })
  it('separates personally owned courses from school courses even for a teacher', async () => {
    window.scrollTo = vi.fn()
    const request = vi.fn().mockResolvedValue({ courses: [course, { ...course, id: 'school', title: '学校共有コース', ownedByMe: false, published: true }] })
    const create = vi.fn()
    render(<RouteNotebook refreshKey={0} request={request} onCreate={create} />)
    await screen.findByRole('button', { name: '東側コースのコースを見る' })
    expect(screen.queryByRole('button', { name: '学校共有コースのコースを見る' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '学校のコース', exact: true }))
    await screen.findByRole('button', { name: '学校共有コースのコースを見る' })
    expect(screen.queryByRole('button', { name: '東側コースのコースを見る' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /写真からコースをつくる/ }))
    expect(create).toHaveBeenCalledOnce()
  })
  it('uses saved outline progress and does not unlock weather questions before normal completion', async () => {
    window.scrollTo = vi.fn()
    const request = vi.fn(async (path: string) => path.endsWith('/quiz') ? { outline: { items: [
      { id: 'first', sceneId: 'scene', title: '曲がり角', photoUrl: '/photo.png', scenario: 'normal', cleared: false },
      { id: 'rain', sceneId: 'scene', title: '雨の曲がり角', photoUrl: '/photo.png', scenario: 'rain', cleared: false },
    ], latestCompleted: null } } : path.endsWith('/routes') ? { courses: [course] } : { course })
    render(<RouteNotebook refreshKey={0} request={request} onCreate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '東側コースのコースを見る' }))
    await screen.findByRole('list', { name: 'コースの道順' })
    expect(screen.getByRole('option', { name: /雨の日/ })).toBeDisabled()
    expect(screen.getByText(/0 \/ 1か所/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '次の場所へ' })).toBeEnabled())
  })
})
