// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/db/authz'
import { createRouteRepository, type RouteDatabase, type RouteStatement } from '@/lib/hunter/routes/repository'
import { createSchoolRepository } from '@/lib/hunter/routes/school'
import { courseView, getRoutePhoto, persistScene, reviewCourse, saveSceneNotes, startScene } from '@/lib/hunter/routes/service'
import type { SceneNote } from '@/lib/hunter/routes/notes'
import type { StoredScene } from '@/lib/hunter/routes/types'

const mocks = vi.hoisted(() => ({
  db: null as RouteDatabase | null,
  uploadImage: vi.fn(), generate: vi.fn(), getOperation: vi.fn(), getObject: vi.fn(),
}))

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: { DB: mocks.db } }) }))
vi.mock('@/lib/hunter/routes/world-labs', async (original) => {
  const real = await original<typeof import('@/lib/hunter/routes/world-labs')>()
  return { ...real, WorldLabsClient: class {
    uploadImage = mocks.uploadImage
    generate = mocks.generate
    getOperation = mocks.getOperation
  } }
})
vi.mock('@/lib/hunter/routes/media', () => ({
  routeBucket: () => ({ get: mocks.getObject }),
  cacheWorldSplat: vi.fn(), putRoutePhoto: vi.fn(), stripWebpMetadata: vi.fn(),
}))

class SqliteStatement implements RouteStatement {
  private values: unknown[] = []
  constructor(private readonly statement: Database.Statement) {}
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>() { return (this.statement.get(...this.values) as T | undefined) ?? null }
  async all<T>() { return { results: this.statement.all(...this.values) as T[] } }
  runSync() { return { meta: { changes: this.statement.run(...this.values).changes } } }
  async run() { return this.runSync() }
}

function adaptSqlite(sqlite: Database.Database): RouteDatabase {
  return {
    prepare: (sql) => new SqliteStatement(sqlite.prepare(sql)),
    batch: async (statements) => sqlite.transaction(() => statements.map((stmt) => (stmt as SqliteStatement).runSync()))(),
  }
}

const owner: Actor = { kind: 'user', id: 'owner', email: 'owner@example.test', isAdmin: false }
const outsider: Actor = { kind: 'user', id: 'outsider', email: 'outsider@example.test', isAdmin: false }
const teacher: Actor = { kind: 'user', id: 'teacher', email: 'teacher@example.test', isAdmin: true }
const scene = (id: string, status: StoredScene['status'] = 'submitting', operationId?: string): StoredScene => ({
  id, name: `${id}地点`, status, photoKeys: [`hunter-routes/test/${id}/photo-0.webp`], ...(operationId ? { operationId } : {}),
})

describe('route generation persistence with real SQLite', () => {
  let sqlite: Database.Database
  let repository: ReturnType<typeof createRouteRepository>

  beforeEach(() => {
    vi.clearAllMocks()
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(readFileSync(resolve('lib/db/migrations/20260905190000_hunter_route_courses.sql'), 'utf8'))
    mocks.db = adaptSqlite(sqlite)
    repository = createRouteRepository(mocks.db)
    mocks.getObject.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
    mocks.uploadImage.mockResolvedValue('media-id')
    mocks.generate.mockResolvedValue({ state: 'running', operationId: 'operation-paid' })
  })
  afterEach(() => { sqlite.close(); mocks.db = null })

  function create(scenes: StoredScene[]) {
    return repository.createCourse(owner, { title: '東側の通学路', schoolYear: 3, status: 'generating', reviewed: false,
      scenes, model: 'marble-1.0-draft' })
  }

  const note: SceneNote = { id: '11111111-1111-4111-8111-111111111111', photoIndex: 0, point: { x: 0.5, y: 0.5 },
    source: 'observed', category: 'traffic', scenario: 'normal', title: '曲がり角', evidence: 'かべで見通しが悪い', detail: '自転車が来るかもしれない' }

  it('changes notes, revokes publication and review, and rejects stale edits without losing the saved notes', async () => {
    const schools = createSchoolRepository(mocks.db!)
    await schools.createSchool(teacher, '東小学校')
    await schools.joinSchool(owner, (await schools.createInvite(teacher)).code, 3)
    const first = { ...scene(crypto.randomUUID(), 'ready'), splatKey: 'ready.spz' }
    const created = await create([first])
    const ready = await repository.updateCourseOwned(owner, created.id, created.revision, { ...created.data, status: 'ready', reviewed: true })
    const published = await repository.publishCourse(owner, ready.id, ready.revision)
    await repository.saveProgress(owner, ready.id, ready.revision, first.id, 'normal', true, [])
    const unchanged = await saveSceneNotes(owner, ready.id, { revision: ready.revision, sceneId: first.id, notes: [] })
    expect(unchanged).toEqual(published)
    expect(await repository.getProgress(owner, ready.id)).toEqual([expect.objectContaining({ cleared: true })])
    const saved = await saveSceneNotes(owner, ready.id, { revision: ready.revision, sceneId: first.id, notes: [note] })
    expect(saved).toMatchObject({ revision: published.revision + 1, published: false, data: { reviewed: false } })
    expect(await repository.getProgress(owner, ready.id)).toEqual([])
    await expect(saveSceneNotes(owner, ready.id, { revision: ready.revision, sceneId: first.id, notes: [] })).rejects.toMatchObject({ status: 409 })
    expect((await repository.getCourse(owner, ready.id)).data.scenes).toEqual([{ ...first, notes: [note] }])
    const removed = await saveSceneNotes(teacher, ready.id, { revision: saved.revision, sceneId: first.id, notes: [] })
    expect(removed.data.scenes).toEqual([{ ...first, notes: [] }])
  })

  it('refuses missing photo references, edits during generation and cross-school edits', async () => {
    const first = scene(crypto.randomUUID(), 'queued')
    const created = await create([first])
    const input = { revision: created.revision, sceneId: first.id, notes: [note] }
    await expect(saveSceneNotes(owner, created.id, { ...input, notes: [{ ...note, photoIndex: 1 }] })).rejects.toMatchObject({ status: 400 })
    await expect(saveSceneNotes(outsider, created.id, input)).rejects.toMatchObject({ status: 404 })
    await repository.updateCourseOwned(owner, created.id, created.revision, { ...created.data, scenes: [{ ...first, status: 'running' }] })
    const running = await repository.getCourse(owner, created.id)
    await expect(saveSceneNotes(owner, created.id, { ...input, revision: running.revision })).rejects.toMatchObject({ status: 409, code: 'generating' })
  })

  it('serves only the referenced private photo to authorized users and removes access after unpublishing', async () => {
    const schools = createSchoolRepository(mocks.db!)
    await schools.createSchool(teacher, '東小学校')
    await schools.joinSchool(owner, (await schools.createInvite(teacher)).code, 3)
    const pupil: Actor = { kind: 'user', id: 'pupil', isAdmin: false }
    await schools.joinSchool(pupil, (await schools.createInvite(teacher)).code, 2)
    const first = scene(crypto.randomUUID(), 'ready')
    const created = await create([first])
    await expect(getRoutePhoto(pupil, created.id, first.id, 0)).rejects.toMatchObject({ status: 404 })
    expect(mocks.getObject).not.toHaveBeenCalled()
    const ready = await repository.updateCourseOwned(owner, created.id, created.revision, { ...created.data, status: 'ready', reviewed: true })
    await repository.publishCourse(owner, ready.id, ready.revision)
    await getRoutePhoto(pupil, ready.id, first.id, 0)
    expect(mocks.getObject).toHaveBeenLastCalledWith(first.photoKeys[0])
    await expect(getRoutePhoto(outsider, ready.id, first.id, 0)).rejects.toMatchObject({ status: 404 })
    await expect(getRoutePhoto(pupil, ready.id, first.id, -1)).rejects.toMatchObject({ status: 404 })
    await expect(getRoutePhoto(pupil, ready.id, first.id, 1)).rejects.toMatchObject({ status: 404 })
    await expect(saveSceneNotes(pupil, ready.id, { revision: ready.revision, sceneId: first.id, notes: [note] })).rejects.toMatchObject({ status: 403 })
    await repository.unpublishCourse(owner, ready.id, ready.revision)
    await expect(getRoutePhoto(pupil, ready.id, first.id, 0)).rejects.toMatchObject({ status: 404 })
  })

  it('persists concurrent scene submissions without losing either operation id', async () => {
    const first = scene('first')
    const second = scene('second')
    const course = await create([first, second])
    await Promise.all([
      persistScene(owner, course.id, first, { ...first, status: 'running', operationId: 'operation-first' }),
      persistScene(owner, course.id, second, { ...second, status: 'running', operationId: 'operation-second' }),
    ])
    const saved = await repository.getCourse(owner, course.id)
    expect(saved.data.scenes).toEqual([
      { ...first, status: 'running', operationId: 'operation-first' },
      { ...second, status: 'running', operationId: 'operation-second' },
    ])
    expect(saved).toMatchObject({ revision: 3, published: false, data: { status: 'generating' } })
  })

  it('computes the aggregate status from all scenes after concurrent completions', async () => {
    const first = scene('first', 'running', 'op-first')
    const second = scene('second', 'running', 'op-second')
    const course = await create([first, second])
    await Promise.all([
      persistScene(owner, course.id, first, { ...first, status: 'ready', splatKey: 'first.spz' }),
      persistScene(owner, course.id, second, { ...second, status: 'ready', splatKey: 'second.spz' }),
    ])
    const saved = await repository.getCourse(owner, course.id)
    expect(saved.data.status).toBe('ready')
    expect(saved.data.scenes).toEqual([
      { ...first, status: 'ready', splatKey: 'first.spz' },
      { ...second, status: 'ready', splatKey: 'second.spz' },
    ])
  })

  it.each(['failed', 'unknown'] as const)('keeps course failed when one scene is %s and another completes', async (status) => {
    const first = scene('first', 'running', 'op-first')
    const second = scene('second', 'running', 'op-second')
    const course = await create([first, second])
    await persistScene(owner, course.id, first, { ...first, status })
    const saved = await persistScene(owner, course.id, second, { ...second, status: 'ready', splatKey: 'second.spz' })
    expect(saved.data.status).toBe('failed')
    expect((saved.data.scenes as StoredScene[])[0].status).toBe(status)
  })

  it('ignores a stale operation result without altering a newer operation', async () => {
    const current = scene('first', 'running', 'new-operation')
    const course = await create([current])
    const saved = await persistScene(owner, course.id, { ...current, operationId: 'old-operation' },
      { ...current, operationId: 'old-operation', status: 'ready', splatKey: 'stale.spz' })
    expect(saved).toEqual(course)
  })

  it('does not reapply duplicate completion after review and publication or invalidate progress', async () => {
    const schools = createSchoolRepository(mocks.db!)
    await schools.createSchool(teacher, '東小学校')
    const invite = await schools.createInvite(teacher)
    await schools.joinSchool(owner, invite.code, 3)
    const running = scene('first', 'running', 'operation-first')
    const completed: StoredScene = { ...running, status: 'ready', splatKey: 'first.spz' }
    const course = await create([running])
    const generated = await persistScene(owner, course.id, running, completed)
    const reviewed = await repository.updateCourseOwned(owner, course.id, generated.revision, { ...generated.data, reviewed: true })
    const published = await repository.publishCourse(owner, course.id, reviewed.revision)
    await repository.saveProgress(owner, course.id, published.revision, running.id, 'normal', true, [])
    const progress = await repository.getProgress(owner, course.id)
    await Promise.all([persistScene(owner, course.id, running, completed), persistScene(owner, course.id, running, completed)])
    expect(await repository.getCourse(owner, course.id)).toEqual(published)
    expect(await repository.getProgress(owner, course.id)).toEqual(progress)
  })

  it('does not let a different user persist private generation results', async () => {
    const first = scene('first')
    const course = await create([first])
    await expect(persistScene(outsider, course.id, first, { ...first, status: 'ready' })).rejects.toMatchObject({ status: 404 })
    expect(await repository.getCourse(owner, course.id)).toEqual(course)
  })

  it('reviews a ready course without discarding previously earned learning records', async () => {
    const course = await create([{ ...scene('first', 'ready'), splatKey: 'first.spz' }])
    const ready = await repository.updateCourseOwned(owner, course.id, course.revision, { ...course.data, status: 'ready' })
    await repository.saveProgress(owner, course.id, ready.revision, 'first', 'normal', true, [])
    const reviewed = await reviewCourse(owner, course.id, ready.revision)
    expect(reviewed.revision).toBe(ready.revision)
    expect(reviewed.data.reviewed).toBe(true)
    expect(await repository.getProgress(owner, course.id)).toEqual([expect.objectContaining({ cleared: true })])
    await expect(reviewCourse(outsider, course.id, ready.revision)).rejects.toMatchObject({ status: 404 })
    await expect(reviewCourse(owner, course.id, ready.revision - 1)).rejects.toMatchObject({ status: 409 })
  })

  it('uses the learner grade instead of the creator grade for a shared course', async () => {
    const schools = createSchoolRepository(mocks.db!)
    await schools.createSchool(teacher, '東小学校')
    const invite = await schools.createInvite(teacher)
    await schools.joinSchool(owner, invite.code, 7)
    const course = await create([scene('first')])
    expect(await courseView(owner, course)).toMatchObject({ schoolYear: 3, learnerSchoolYear: 7 })
  })

  it('rejects all new generation starts without sending a paid request or changing saved photos', async () => {
    const queued = scene('first', 'queued')
    const course = await create([queued])
    const starts = await Promise.allSettled([startScene(owner, course.id, queued.id), startScene(owner, course.id, queued.id)])
    expect(starts.every((start) => start.status === 'rejected')).toBe(true)
    await expect(startScene(owner, course.id, queued.id)).rejects.toMatchObject({ status: 410, code: 'generation_disabled' })
    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
    const saved = await repository.getCourse(owner, course.id)
    expect(saved).toEqual(course)
  })

  it('keeps private courses private when the disabled generation endpoint is called', async () => {
    const course = await create([scene('first', 'queued')])
    await expect(startScene(outsider, course.id, 'first')).rejects.toMatchObject({ status: 404 })
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
