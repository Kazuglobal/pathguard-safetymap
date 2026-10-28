// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/hunter/routes/[id]/progress/route'
import { getScenarioCurriculum } from '@/lib/hunter/routes/curriculum'

const sceneId = '11111111-1111-4111-8111-111111111111'
const noteId = '22222222-2222-4222-8222-222222222222'
const mocks = vi.hoisted(() => ({ course: vi.fn(), progress: vi.fn(), save: vi.fn() }))
vi.mock('@/lib/auth/actor', () => ({ getActor: async () => ({ kind: 'user', id: 'pupil', isAdmin: false }) }))
vi.mock('@/lib/hunter/routes/repository', async original => ({
  ...await original<typeof import('@/lib/hunter/routes/repository')>(),
  getCourse: mocks.course, getProgress: mocks.progress, saveProgress: mocks.save,
}))
function request(reviewedNoteIds?: string[], targetScene = sceneId) {
  const lessons = getScenarioCurriculum('normal', 9)
  return new Request('https://example.test/api/hunter/routes/course/progress', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' },
    body: JSON.stringify({ sceneId: targetScene, revision: 3, scenario: 'normal', reviewedNoteIds,
      foundIds: lessons.map(item => item.id), answers: lessons.map(item => ({ hazardId: item.id,
        prediction: item.questions.prediction.correctId, reason: item.questions.reason.correctId, action: item.questions.action.correctId })) }) })
}
const context = { params: Promise.resolve({ id: 'course' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.course.mockResolvedValue({ revision: 3, data: { status: 'ready', scenes: [{ id: sceneId, status: 'ready',
    notes: [{ id: noteId, scenario: 'normal' }] }] } })
  mocks.progress.mockResolvedValue([])
  mocks.save.mockResolvedValue([])
})
describe('saved photo notes in server completion checks', () => {
  it('does not clear a course merely because all generic answers are correct', async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect((await response.json()).result.cleared).toBe(false)
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), 'course', 3, sceneId, 'normal', false, [])
  })
  it('clears only after every saved scenario note is acknowledged', async () => {
    const response = await POST(request([noteId]), context)
    expect(response.status).toBe(200)
    expect((await response.json()).result.cleared).toBe(true)
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), 'course', 3, sceneId, 'normal', true, [])
  })
  it.each([[noteId, noteId], ['33333333-3333-4333-8333-333333333333']])('rejects invalid note claims before saving (%j)', async (...ids) => {
    const response = await POST(request(ids), context)
    expect(response.status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects a scene outside the saved course before evaluating notes', async () => {
    const response = await POST(request([noteId], '44444444-4444-4444-8444-444444444444'), context)
    expect(response.status).toBe(404)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
