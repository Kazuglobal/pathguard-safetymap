import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PhotoQuizEditor } from '@/components/safety-quest/hunter/routes/photo-quiz-editor'
import { routeRequest } from '@/components/safety-quest/hunter/routes/route-request'
import { photoQuizItemSchema } from '@/lib/hunter/routes/photo-quiz-schema'
import type { CourseView } from '@/lib/hunter/routes/types'
vi.mock('@/components/safety-quest/hunter/routes/route-request', () => ({ routeRequest: vi.fn() }))
const sceneId = '22222222-2222-4222-8222-222222222222'
const item = photoQuizItemSchema.parse({ id: '11111111-1111-4111-8111-111111111111', sceneId, photoIndex: 0, title: '自分の問題', templateId: 'hidden-traffic', scenario: 'normal', observed: '塀で見えにくい', hypothetical: '自転車が来たら', region: { x: .2, y: .2, width: .3, height: .3 } })
const course = { id: 'course', revision: 1, scenes: [{ id: sceneId, photoCount: 1, name: '曲がり角' }] } as CourseView
beforeEach(() => { vi.mocked(routeRequest).mockReset() })
it('recovers a successful save whose response was lost without saving twice', async () => {
  const onSaved = vi.fn()
  vi.mocked(routeRequest).mockResolvedValueOnce({ revision: 1, items: [item], templates: [] })
  render(<PhotoQuizEditor course={course} onSaved={onSaved} onClose={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'コースに保存する' })).toBeEnabled())
  vi.mocked(routeRequest).mockRejectedValueOnce(new Error('通信が切れました'))
  fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
  await screen.findByRole('alert')
  vi.mocked(routeRequest).mockResolvedValueOnce({ revision: 2, items: [item] }).mockResolvedValueOnce({ course: { ...course, revision: 2 } })
  fireEvent.click(screen.getByRole('button', { name: '保存された内容を確認する' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...course, revision: 2 }))
  expect(vi.mocked(routeRequest).mock.calls.filter(call => call[1] !== undefined)).toHaveLength(1)
})
it('shows conflicting content and preserves local notes before explicitly loading the latest version', async () => {
  vi.mocked(routeRequest).mockResolvedValueOnce({ revision: 1, items: [item], templates: [] })
  render(<PhotoQuizEditor course={course} onSaved={vi.fn()} onClose={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'コースに保存する' })).toBeEnabled())
  vi.mocked(routeRequest).mockRejectedValueOnce(new Error('別の編集があります'))
  fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
  await screen.findByRole('alert')
  vi.mocked(routeRequest).mockResolvedValueOnce({ revision: 2, items: [{ ...item, title: '先生の修正' }] })
  fireEvent.click(screen.getByRole('button', { name: '保存された内容を確認する' }))
  await screen.findByText('1. 先生の修正')
  expect(screen.getByText('1. 自分の問題')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '自分の編集をメモに残して、最新を読み込む' }))
  expect((screen.getByLabelText('自分の編集メモ') as HTMLTextAreaElement).value).toContain('自分の問題')
})
