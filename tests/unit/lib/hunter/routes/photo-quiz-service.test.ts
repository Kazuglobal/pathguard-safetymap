// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/db/authz'
import { createRouteRepository, type RouteDatabase, type RouteStatement } from '@/lib/hunter/routes/repository'
import { createSchoolRepository } from '@/lib/hunter/routes/school'
import { answerQuizSession, copyPhotoQuizCourse, getQuizOutline, getQuizSession, listPhotoQuizTeacherRecords, saveQuizConfig, startQuizSession } from '@/lib/hunter/routes/photo-quiz-service'
import type { PhotoQuizState } from '@/lib/hunter/routes/photo-quiz-engine'
import type { PhotoQuizAnswer, PhotoQuizItem, PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'

const mocks = vi.hoisted(() => ({ db: null as RouteDatabase | null }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: { DB: mocks.db } }) }))
vi.mock('@/lib/hunter/routes/media', () => ({ routeBucket: vi.fn(), cacheWorldSplat: vi.fn(), putRoutePhoto: vi.fn(), stripWebpMetadata: vi.fn() }))
class Statement implements RouteStatement {
  private values: unknown[] = []
  constructor(private statement: Database.Statement) {}
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>() { return (this.statement.get(...this.values) as T | undefined) ?? null }
  async all<T>() { return { results: this.statement.all(...this.values) as T[] } }
  runSync() { return { meta: { changes: this.statement.run(...this.values).changes } } }
  async run() { return this.runSync() }
}
const owner: Actor = { kind: 'user', id: 'owner', email: 'owner@example.test', isAdmin: false }
const pupil: Actor = { kind: 'user', id: 'pupil', email: 'pupil@example.test', isAdmin: false }
const teacher: Actor = { kind: 'user', id: 'teacher', email: 'teacher@example.test', isAdmin: true }
const outsider: Actor = { kind: 'user', id: 'outsider', email: 'outsider@example.test', isAdmin: false }
const sceneId = '22222222-2222-4222-8222-222222222222'
function item(scenario: PhotoQuizItem['scenario'] = 'normal'): PhotoQuizItem {
  return { id: crypto.randomUUID(), sceneId, photoIndex: 0, title: '曲がり角', templateId: 'hidden-traffic', scenario, observed: '塀で先が見えにくい', hypothetical: '自転車が来るかもしれない', region: { x: .2, y: .2, width: .4, height: .4 } }
}
describe('photo quiz persistence with real SQLite', () => {
  let sqlite: Database.Database
  let repo: ReturnType<typeof createRouteRepository>
  beforeEach(() => {
    sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys = ON')
    for (const filename of ['20260905190000_hunter_route_courses.sql', '20260908090000_hunter_photo_quiz_sessions.sql']) sqlite.exec(readFileSync(resolve('lib/db/migrations', filename), 'utf8'))
    mocks.db = { prepare: sql => new Statement(sqlite.prepare(sql)), batch: async statements => sqlite.transaction(() => statements.map(statement => (statement as Statement).runSync()))() }
    repo = createRouteRepository(mocks.db)
  })
  afterEach(() => { sqlite.close(); mocks.db = null })
  async function create(items = [item(), item('rain')]) {
    return repo.createCourse(owner, { title: '学校東側コース', schoolYear: 2, status: 'ready', reviewed: true, learningMode: 'photo-quiz-v1', quizItems: items,
      scenes: [{ id: sceneId, name: '曲がり角', status: 'queued', photoKeys: ['hunter-routes/test/photo.webp'], notes: [] }] })
  }
  function state(sessionId: string): PhotoQuizState { return JSON.parse((sqlite.prepare('SELECT state_json FROM hunter_photo_quiz_sessions WHERE id=?').get(sessionId) as { state_json: string }).state_json) }
  async function answer(actor: Actor, session: PhotoQuizView, fields: Partial<PhotoQuizAnswer>) {
    return answerQuizSession(actor, session.courseId, session.id, { requestId: crypto.randomUUID(), version: session.version, kind: 'point', ...fields })
  }
  async function finish(actor: Actor, initial: PhotoQuizView) {
    let session = initial
    while (session.stage !== 'complete') {
      const saved = state(session.id), lesson = saved.lessons[saved.index]
      session = await answer(actor, session, session.stage === 'find' ? { point: { x: .3, y: .3 } } : session.stage === 'feedback' ? { kind: 'next' } : { kind: 'choice', choiceId: lesson[session.stage].correctId })
    }
    return session
  }
  it('resumes one active session, persists each step, and unlocks rain only after learning every normal item', async () => {
    const course = await create([item(), item(), item(), item(), item('rain')])
    const first = await startQuizSession(owner, course.id, 'normal')
    expect(first.total).toBe(3)
    expect((await startQuizSession(owner, course.id, 'normal')).id).toBe(first.id)
    await expect(startQuizSession(owner, course.id, 'rain')).rejects.toMatchObject({ code: 'locked' })
    const complete = await finish(owner, first)
    expect(complete.learned).toHaveLength(3)
    await expect(startQuizSession(owner, course.id, 'rain')).rejects.toMatchObject({ code: 'locked' })
    const rest = await startQuizSession(owner, course.id, 'normal')
    expect(rest.total).toBe(1); expect(rest.id).not.toBe(first.id)
    await finish(owner, rest)
    expect((await startQuizSession(owner, course.id, 'rain')).scenario).toBe('rain')
  })
  it('returns only this learner current progress and completed worksheet without answer details', async () => {
    const course = await create()
    const initial = await getQuizOutline(owner, course.id)
    expect(initial.items).toHaveLength(2)
    expect(initial.items.every(value => !value.cleared)).toBe(true)
    expect(initial.latestCompleted).toBeNull()
    expect(JSON.stringify(initial)).not.toContain('region')
    expect(JSON.stringify(initial)).not.toContain('hypothetical')
    await expect(getQuizOutline(outsider, course.id)).rejects.toBeDefined()
    await finish(owner, await startQuizSession(owner, course.id, 'normal'))
    const learned = await getQuizOutline(owner, course.id)
    expect(learned.items.filter(value => value.cleared)).toHaveLength(1)
    expect(learned.latestCompleted?.stage).toBe('complete')
    await saveQuizConfig(owner, course.id, { revision: course.revision, items: [item()] })
    expect((await getQuizOutline(owner, course.id)).latestCompleted).toBeNull()
  })
  it('makes retries idempotent and accepts only one concurrent version', async () => {
    const course = await create(), session = await startQuizSession(owner, course.id, 'normal')
    const payload = { requestId: crypto.randomUUID(), version: 0, kind: 'point', point: { x: .3, y: .3 } }
    const first = await answerQuizSession(owner, course.id, session.id, payload)
    expect(await answerQuizSession(owner, course.id, session.id, payload)).toEqual(first)
    expect((await getQuizSession(owner, course.id, session.id)).version).toBe(1)
    const choices = state(session.id).lessons[0].reason
    const results = await Promise.allSettled([answer(owner, first, { kind: 'choice', choiceId: choices.correctId }), answer(owner, first, { kind: 'choice', choiceId: choices.correctId })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((await getQuizSession(owner, course.id, session.id)).version).toBe(2)
  })
  it('rejects invalid and stale configuration; copies legacy courses without changing them', async () => {
    const course = await create()
    await expect(saveQuizConfig(owner, course.id, { revision: course.revision, items: [{ ...item(), photoIndex: 3 }] })).rejects.toMatchObject({ status: 400 })
    await expect(saveQuizConfig(owner, course.id, { revision: course.revision, items: [{ ...item(), templateId: 'shaking-street' }] })).rejects.toMatchObject({ code: 'quiz_scenario' })
    const session = await startQuizSession(owner, course.id, 'normal')
    const saved = await saveQuizConfig(owner, course.id, { revision: course.revision, items: [item()] })
    expect(saved.revision).toBe(course.revision + 1)
    await expect(getQuizSession(owner, course.id, session.id)).rejects.toMatchObject({ code: 'revision' })
    await expect(saveQuizConfig(owner, course.id, { revision: course.revision, items: [] })).rejects.toMatchObject({ status: 409 })
    const legacy = await repo.createCourse(owner, { ...course.data, learningMode: 'legacy-3d' })
    const copied = await copyPhotoQuizCourse(owner, legacy.id)
    expect(copied.id).not.toBe(legacy.id)
    expect(copied.data).toMatchObject({ learningMode: 'photo-quiz-v1', status: 'draft', quizItems: [] })
    expect(await repo.getCourse(owner, legacy.id)).toEqual(legacy)
  })
  it('isolates pupils, denies editing and stops access when the school course is unpublished', async () => {
    const schools = createSchoolRepository(mocks.db!)
    await schools.createSchool(teacher, '見本の学校')
    await schools.joinSchool(owner, (await schools.createInvite(teacher)).code, 3)
    await schools.joinSchool(pupil, (await schools.createInvite(teacher)).code, 1)
    const course = await create(); await repo.publishCourse(owner, course.id, course.revision)
    const session = await startQuizSession(pupil, course.id, 'normal')
    expect(session.schoolYear).toBe(1)
    await finish(pupil, session)
    expect(await listPhotoQuizTeacherRecords(teacher)).toEqual([expect.objectContaining({ userId: 'pupil', cleared: true, courseTitle: '学校東側コース（写真クイズ）' })])
    await expect(listPhotoQuizTeacherRecords(pupil)).rejects.toMatchObject({ status: 403 })
    await expect(getQuizSession(owner, course.id, session.id)).rejects.toMatchObject({ status: 404 })
    await expect(startQuizSession(outsider, course.id, 'normal')).rejects.toMatchObject({ status: 404 })
    await expect(saveQuizConfig(pupil, course.id, { revision: course.revision, items: [] })).rejects.toMatchObject({ status: 403 })
    await repo.unpublishCourse(owner, course.id, course.revision)
    await expect(answer(pupil, session, { kind: 'hint' })).rejects.toMatchObject({ status: 404 })
  })
  it('does not permanently strand a session after many attempts', async () => {
    const course = await create(), session = await startQuizSession(owner, course.id, 'normal')
    sqlite.prepare('UPDATE hunter_photo_quiz_sessions SET version=500 WHERE id=?').run(session.id)
    expect((await answer(owner, { ...session, version: 500 }, { kind: 'hint' })).version).toBe(501)
  })
})
