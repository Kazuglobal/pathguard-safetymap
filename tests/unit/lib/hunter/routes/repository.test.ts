// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/db/authz'
import { createRouteRepository, type CourseData, type RouteDatabase, type RouteStatement } from '@/lib/hunter/routes/repository'
import { createSchoolRepository } from '@/lib/hunter/routes/school'

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn() }))

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

const user = (id: string, isAdmin = false): Actor => ({ kind: 'user', id, email: `${id}@school.example`, isAdmin })
const teacher = user('teacher', true)
const owner = user('owner')
const classmate = user('classmate')
const outsider = user('outsider')
const ready = (): CourseData => ({ title: '学校東側コース', schoolYear: 3, status: 'ready', reviewed: true,
  scenes: [{ id: 'intersection' }, { id: 'canal' }] })

describe('hunter route storage with actual SQLite queries', () => {
  let sqlite: Database.Database
  let routes: ReturnType<typeof createRouteRepository>
  let schools: ReturnType<typeof createSchoolRepository>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(readFileSync(resolve('lib/db/migrations/20260905190000_hunter_route_courses.sql'), 'utf8'))
    const db = adaptSqlite(sqlite)
    routes = createRouteRepository(db)
    schools = createSchoolRepository(db)
  })
  afterEach(() => { sqlite.close(); vi.useRealTimers() })

  async function classmates() {
    const membership = await schools.createSchool(teacher, '東小学校')
    const invite = await schools.createInvite(teacher)
    await schools.joinSchool(owner, invite.code, 3)
    await schools.joinSchool(classmate, invite.code, 6)
    return { membership, invite }
  }

  it('requires a user actor for courses and school membership', async () => {
    await expect(routes.createCourse({ kind: 'anon' }, ready())).rejects.toMatchObject({ status: 401 })
    await expect(routes.createCourse({ kind: 'service' }, ready())).rejects.toMatchObject({ status: 401 })
    await expect(schools.getMembership({ kind: 'anon' })).rejects.toMatchObject({ status: 401 })
  })

  it('allows personal drafts but never publishes them without membership', async () => {
    const course = await routes.createCourse(owner, ready())
    expect(course).toMatchObject({ ownerId: 'owner', schoolId: null, revision: 1, published: false })
    expect(await routes.listCourses(outsider)).toEqual([])
    await expect(routes.getCourse(outsider, course.id)).rejects.toMatchObject({ status: 404 })
    await expect(routes.publishCourse(owner, course.id, 1)).rejects.toMatchObject({ code: 'school_required' })
  })

  it('never lets a user appoint themselves teacher or create an invitation', async () => {
    await expect(schools.createSchool(owner, '私の学校')).rejects.toMatchObject({ status: 403 })
    await classmates()
    expect(await schools.getMembership(owner)).toMatchObject({ role: 'student', schoolYear: 3 })
    await expect(schools.createInvite(owner)).rejects.toMatchObject({ status: 403 })
    await expect(schools.createSchool(teacher, '別の学校')).rejects.toMatchObject({ code: 'already_joined' })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM hunter_route_schools').get()).toEqual({ n: 1 })
  })

  it('stores only invitation hashes and rejects invalid or expired tokens', async () => {
    await schools.createSchool(teacher, '東小学校')
    const invite = await schools.createInvite(teacher)
    const saved = sqlite.prepare('SELECT token_hash FROM hunter_route_invitations').get() as { token_hash: string }
    expect(invite.code).toHaveLength(48)
    expect(saved.token_hash).toHaveLength(64)
    expect(saved.token_hash).not.toContain(invite.code)
    await expect(schools.joinSchool(owner, 'a'.repeat(48), 3)).rejects.toMatchObject({ code: 'invalid_invitation' })
    await expect(schools.joinSchool(owner, invite.code, 10)).rejects.toMatchObject({ code: 'invalid_invitation' })
    sqlite.prepare("UPDATE hunter_route_invitations SET expires_at = '2000-01-01T00:00:00.000Z'").run()
    await expect(schools.joinSchool(owner, invite.code, 3)).rejects.toMatchObject({ code: 'invalid_invitation' })
    expect(await schools.getMembership(owner)).toBeNull()
  })

  it('ignores invitations whose issuer no longer has the teacher role', async () => {
    await schools.createSchool(teacher, '東小学校')
    const invite = await schools.createInvite(teacher)
    sqlite.prepare('DELETE FROM hunter_route_memberships WHERE user_id = ?').run('teacher')
    await expect(schools.joinSchool(owner, invite.code, 2)).rejects.toMatchObject({ code: 'invalid_invitation' })
  })

  it('allows sharing with classmates, but hides drafts and other schools', async () => {
    const { membership } = await classmates()
    const course = await routes.createCourse(owner, ready())
    expect(course.schoolId).toBe(membership.schoolId)
    await expect(routes.getCourse(classmate, course.id)).rejects.toMatchObject({ status: 404 })
    expect(await routes.getCourse(teacher, course.id)).toMatchObject({ id: course.id })
    await routes.publishCourse(owner, course.id, 1)
    expect(await routes.getCourse(classmate, course.id)).toMatchObject({ published: true })
    await expect(routes.getCourse(outsider, course.id)).rejects.toMatchObject({ status: 404 })
    await schools.createSchool(user('other-teacher', true), '西小学校')
    await expect(routes.getCourse(user('other-teacher', true), course.id)).rejects.toMatchObject({ status: 404 })
    await expect(routes.updateCourseOwned(classmate, course.id, 1, ready())).rejects.toMatchObject({ status: 403 })
  })

  it('attaches a personal course to school only when its owner publishes after joining', async () => {
    const course = await routes.createCourse(owner, ready())
    const { membership } = await classmates()
    const shared = await routes.publishCourse(owner, course.id, 1)
    expect(shared).toMatchObject({ schoolId: membership.schoolId, published: true, revision: 1 })
  })

  it('requires ready, reviewed and nonempty scenes for publication', async () => {
    await classmates()
    for (const data of [{ ...ready(), reviewed: false }, { ...ready(), status: 'generating' as const }, { ...ready(), scenes: [] }]) {
      const course = await routes.createCourse(owner, data)
      await expect(routes.publishCourse(owner, course.id, 1)).rejects.toMatchObject({ code: 'review_required' })
    }
  })

  it('uses revision CAS and unpublishes edited courses while preserving the successful write', async () => {
    await classmates()
    const course = await routes.createCourse(owner, ready())
    await routes.publishCourse(owner, course.id, 1)
    const changed = await routes.updateCourseOwned(teacher, course.id, 1, { ...ready(), title: '先生が修正したコース' })
    expect(changed).toMatchObject({ revision: 2, published: false })
    await expect(routes.updateCourseOwned(owner, course.id, 1, ready())).rejects.toMatchObject({ status: 409 })
    await expect(routes.publishCourse(owner, course.id, 1)).rejects.toMatchObject({ status: 409 })
    expect((await routes.getCourse(owner, course.id)).data.title).toBe('先生が修正したコース')
    await routes.publishCourse(owner, course.id, 2)
    await routes.unpublishCourse(teacher, course.id, 2)
    await expect(routes.getCourse(classmate, course.id)).rejects.toMatchObject({ status: 404 })
  })

  it('atomically limits concurrent course creation to three per UTC day per user', async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => routes.createCourse(owner, ready())))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
    expect(failures.every((result) => result.reason.code === 'daily_course_limit')).toBe(true)
    expect(await routes.listCourses(owner)).toHaveLength(3)
    await expect(routes.createCourse(outsider, ready())).resolves.toMatchObject({ ownerId: 'outsider' })
  })

  it('allows the quota again on the next UTC day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T23:59:00Z'))
    for (let i = 0; i < 3; i++) await routes.createCourse(owner, ready())
    vi.setSystemTime(new Date('2026-09-06T00:01:00Z'))
    await expect(routes.createCourse(owner, ready())).resolves.toMatchObject({ revision: 1 })
  })

  it('saves per-user, per-revision learning records without changing course revision', async () => {
    await classmates()
    const course = await routes.createCourse(owner, ready())
    await routes.publishCourse(owner, course.id, 1)
    await routes.saveProgress(classmate, course.id, 1, 'intersection', 'normal', false, ['traffic'])
    const progress = await routes.saveProgress(classmate, course.id, 1, 'intersection', 'normal', true, [])
    expect(progress).toEqual([expect.objectContaining({ cleared: true, attempts: 2, revision: 1 })])
    expect(await routes.getProgress(owner, course.id)).toEqual([])
    expect((await routes.getCourse(owner, course.id)).revision).toBe(1)
    await routes.saveProgress(classmate, course.id, 1, 'intersection', 'normal', false, ['traffic'])
    expect(await routes.getProgress(classmate, course.id)).toEqual([expect.objectContaining({ cleared: true, attempts: 3 })])
    await expect(routes.saveProgress(classmate, course.id, 1, 'invented', 'normal', true, [])).rejects.toMatchObject({ status: 400 })
    await expect(routes.saveProgress(classmate, course.id, 1, 'intersection', 'invented', true, [])).rejects.toMatchObject({ status: 400 })
    await expect(routes.saveProgress(outsider, course.id, 1, 'intersection', 'normal', true, [])).rejects.toMatchObject({ status: 404 })
    await routes.updateCourseOwned(owner, course.id, 1, ready())
    await expect(routes.saveProgress(owner, course.id, 1, 'intersection', 'normal', true, [])).rejects.toMatchObject({ status: 409 })
    expect(await routes.getProgress(owner, course.id)).toEqual([])
  })

  it('lets only same-school teachers read members records and excludes old revisions', async () => {
    await classmates()
    const course = await routes.createCourse(owner, ready())
    await routes.publishCourse(owner, course.id, 1)
    await routes.saveProgress(classmate, course.id, 1, 'canal', 'normal', false, ['water'])
    expect(await routes.listTeacherRecords(teacher)).toEqual([expect.objectContaining({ userId: 'classmate', schoolYear: 6, missedKinds: ['water'] })])
    await expect(routes.listTeacherRecords(owner)).rejects.toMatchObject({ status: 403 })
    const otherTeacher = user('other-teacher', true)
    await schools.createSchool(otherTeacher, '西小学校')
    expect(await routes.listTeacherRecords(otherTeacher)).toEqual([])
    await routes.updateCourseOwned(owner, course.id, 1, ready())
    expect(await routes.listTeacherRecords(teacher)).toEqual([])
  })
})
