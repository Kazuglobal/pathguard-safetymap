import 'server-only'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Actor } from '@/lib/db/authz'

export interface RouteStatement {
  bind(...values: unknown[]): RouteStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes?: number } }>
}

export interface RouteDatabase {
  prepare(sql: string): RouteStatement
  batch(statements: RouteStatement[]): Promise<unknown[]>
}

export function getRouteDatabase(): RouteDatabase {
  return (getCloudflareContext().env as unknown as { DB: RouteDatabase }).DB
}

export class RepositoryError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export function requireRouteUser(actor: Actor): Extract<Actor, { kind: 'user' }> {
  if (actor.kind !== 'user') throw new RepositoryError(401, 'unauthorized', 'Googleアカウントでログインしてください。')
  return actor
}

export interface CourseData {
  title: string
  schoolYear: number
  status: 'draft' | 'generating' | 'ready' | 'failed'
  reviewed: boolean
  scenes: unknown[]
  [key: string]: unknown
}

export interface CourseRecord {
  id: string
  ownerId: string
  schoolId: string | null
  revision: number
  published: boolean
  createdAt: string
  data: CourseData
}

export interface SchoolMembership {
  schoolId: string
  schoolName: string
  role: 'student' | 'teacher'
  schoolYear: number | null
}

export interface ProgressRecord {
  courseId: string
  revision: number
  sceneId: string
  scenario: string
  cleared: boolean
  missedKinds: string[]
  attempts: number
  updatedAt: string
}

interface CourseRow {
  id: string
  owner_id: string
  school_id: string | null
  revision: number
  published: number
  created_at: string
  data_json: string
}

interface ProgressRow {
  course_id: string
  revision: number
  scene_id: string
  scenario: string
  cleared: number
  missed_kinds_json: string
  attempts: number
  updated_at: string
}

export async function readSchoolMembership(db: RouteDatabase, actor: Actor): Promise<SchoolMembership | null> {
  const user = requireRouteUser(actor)
  return db.prepare(`SELECT m.school_id AS schoolId, s.name AS schoolName, m.role,
    m.school_year AS schoolYear FROM hunter_route_memberships m
    JOIN hunter_route_schools s ON s.id = m.school_id WHERE m.user_id = ?`).bind(user.id).first<SchoolMembership>()
}

function toCourse(row: CourseRow): CourseRecord {
  return { id: row.id, ownerId: row.owner_id, schoolId: row.school_id, revision: row.revision,
    published: row.published === 1, createdAt: row.created_at, data: JSON.parse(row.data_json) as CourseData }
}

function toProgress(row: ProgressRow): ProgressRecord {
  return { courseId: row.course_id, revision: row.revision, sceneId: row.scene_id,
    scenario: row.scenario, cleared: row.cleared === 1, missedKinds: JSON.parse(row.missed_kinds_json) as string[],
    attempts: row.attempts, updatedAt: row.updated_at }
}

function validateCourseData(data: CourseData): string {
  if (!data || typeof data !== 'object' || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 100 ||
    !Number.isInteger(data.schoolYear) || data.schoolYear < 1 || data.schoolYear > 9 ||
    !['draft', 'generating', 'ready', 'failed'].includes(data.status) || typeof data.reviewed !== 'boolean' ||
    !Array.isArray(data.scenes) || data.scenes.length > 100) {
    throw new RepositoryError(400, 'invalid_course', 'コース名・学年・場面を確認してください。')
  }
  const serialized = JSON.stringify({ ...data, title: data.title.trim() })
  if (serialized.length > 2_000_000) throw new RepositoryError(413, 'course_too_large', 'コースの情報が大きすぎます。')
  return serialized
}

function requireRevision(revision: number) {
  if (!Number.isInteger(revision) || revision < 1) throw new RepositoryError(400, 'invalid_revision', 'コースの版を確認してください。')
}

export function createRouteRepository(db: RouteDatabase) {
  async function getCourse(actor: Actor, id: string): Promise<CourseRecord> {
    const user = requireRouteUser(actor)
    const row = await db.prepare(`SELECT c.* FROM hunter_route_courses c WHERE c.id = ? AND (
      c.owner_id = ? OR EXISTS (SELECT 1 FROM hunter_route_memberships m
      WHERE m.user_id = ? AND m.school_id = c.school_id AND (c.published = 1 OR m.role = 'teacher'))
    )`).bind(id, user.id, user.id).first<CourseRow>()
    if (!row) throw new RepositoryError(404, 'course_not_found', 'このコースは見つからないか、公開されていません。')
    return toCourse(row)
  }

  async function editableCourse(actor: Actor, id: string): Promise<CourseRecord> {
    const user = requireRouteUser(actor)
    const course = await getCourse(actor, id)
    if (course.ownerId === user.id) return course
    const membership = await readSchoolMembership(db, actor)
    if (membership?.role !== 'teacher' || membership.schoolId !== course.schoolId) {
      throw new RepositoryError(403, 'forbidden', 'コースを編集できるのは作成者か同じ学校の先生です。')
    }
    return course
  }

  function assertChanged(changes: number | undefined) {
    if (changes !== 1) throw new RepositoryError(409, 'revision_conflict', 'コースが更新されています。読み直してからやり直してください。')
  }

  return {
    getCourse,

    async createCourse(actor: Actor, input: CourseData): Promise<CourseRecord> {
      const user = requireRouteUser(actor)
      const dataJson = validateCourseData(input)
      const membership = await readSchoolMembership(db, actor)
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const created = await db.prepare(`INSERT INTO hunter_route_courses
        (id, owner_id, school_id, revision, published, data_json, created_at, updated_at)
        SELECT ?, ?, ?, 1, 0, ?, ?, ? WHERE (SELECT COUNT(*) FROM hunter_route_courses
        WHERE owner_id = ? AND created_at >= ?) < 3`)
        .bind(id, user.id, membership?.schoolId ?? null, dataJson, now, now, user.id, `${now.slice(0, 10)}T00:00:00.000Z`).run()
      if (created.meta.changes !== 1) throw new RepositoryError(429, 'daily_course_limit', '今日作れるコースは3つまでです。また明日ためしてください。')
      return getCourse(actor, id)
    },

    async listCourses(actor: Actor): Promise<CourseRecord[]> {
      const user = requireRouteUser(actor)
      const rows = await db.prepare(`SELECT c.* FROM hunter_route_courses c WHERE c.owner_id = ? OR EXISTS (
        SELECT 1 FROM hunter_route_memberships m WHERE m.user_id = ? AND m.school_id = c.school_id
        AND (c.published = 1 OR m.role = 'teacher')) ORDER BY c.updated_at DESC LIMIT 100`)
        .bind(user.id, user.id).all<CourseRow>()
      return rows.results.map(toCourse)
    },

    async updateCourseOwned(actor: Actor, id: string, expectedRevision: number, data: CourseData): Promise<CourseRecord> {
      requireRevision(expectedRevision)
      await editableCourse(actor, id)
      const serialized = validateCourseData(data)
      const result = await db.prepare(`UPDATE hunter_route_courses SET data_json = ?, revision = revision + 1,
        published = 0, updated_at = ? WHERE id = ? AND revision = ?`)
        .bind(serialized, new Date().toISOString(), id, expectedRevision).run()
      assertChanged(result.meta.changes)
      return getCourse(actor, id)
    },

    async publishCourse(actor: Actor, id: string, expectedRevision: number): Promise<CourseRecord> {
      requireRevision(expectedRevision)
      const course = await editableCourse(actor, id)
      const membership = await readSchoolMembership(db, actor)
      if (!membership || (course.schoolId !== null && course.schoolId !== membership.schoolId)) {
        throw new RepositoryError(403, 'school_required', '学校に参加してから公開してください。')
      }
      if (course.data.status !== 'ready' || !course.data.reviewed || course.data.scenes.length === 0) {
        throw new RepositoryError(409, 'review_required', '完成したコースを確認してから公開してください。')
      }
      const result = await db.prepare(`UPDATE hunter_route_courses SET published = 1, school_id = ?, updated_at = ?
        WHERE id = ? AND revision = ? AND json_extract(data_json, '$.status') = 'ready'
        AND json_extract(data_json, '$.reviewed') = 1`)
        .bind(membership.schoolId, new Date().toISOString(), id, expectedRevision).run()
      assertChanged(result.meta.changes)
      return getCourse(actor, id)
    },

    async unpublishCourse(actor: Actor, id: string, expectedRevision: number): Promise<CourseRecord> {
      requireRevision(expectedRevision)
      await editableCourse(actor, id)
      const result = await db.prepare(`UPDATE hunter_route_courses SET published = 0, updated_at = ?
        WHERE id = ? AND revision = ?`).bind(new Date().toISOString(), id, expectedRevision).run()
      assertChanged(result.meta.changes)
      return getCourse(actor, id)
    },

    async saveProgress(actor: Actor, courseId: string, revision: number, sceneId: string, scenario: string,
      cleared: boolean, missedKinds: string[]): Promise<ProgressRecord[]> {
      const user = requireRouteUser(actor)
      requireRevision(revision)
      const course = await getCourse(actor, courseId)
      if (course.revision !== revision) throw new RepositoryError(409, 'revision_conflict', '新しいコースを読み直してください。')
      if (!course.data.scenes.some((scene) => scene && typeof scene === 'object' && 'id' in scene && scene.id === sceneId) ||
        !['normal', 'rain', 'evening', 'earthquake'].includes(scenario) || typeof cleared !== 'boolean' || !Array.isArray(missedKinds) ||
        missedKinds.length > 20 || missedKinds.some((kind) => typeof kind !== 'string' || kind.length > 80)) {
        throw new RepositoryError(400, 'invalid_progress', '学習記録を確認してください。')
      }
      const now = new Date().toISOString()
      await db.prepare(`INSERT INTO hunter_route_progress
        (user_id, course_id, revision, scene_id, scenario, cleared, missed_kinds_json, attempts, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(user_id, course_id, revision, scene_id, scenario) DO UPDATE SET
        cleared = MAX(hunter_route_progress.cleared, excluded.cleared),
        missed_kinds_json = excluded.missed_kinds_json, attempts = hunter_route_progress.attempts + 1,
        updated_at = excluded.updated_at`)
        .bind(user.id, courseId, revision, sceneId, scenario, cleared ? 1 : 0, JSON.stringify([...new Set(missedKinds)]), now).run()
      return this.getProgress(actor, courseId, revision)
    },

    async getProgress(actor: Actor, courseId: string, revision?: number): Promise<ProgressRecord[]> {
      const user = requireRouteUser(actor)
      const course = await getCourse(actor, courseId)
      const rows = await db.prepare(`SELECT * FROM hunter_route_progress WHERE user_id = ? AND course_id = ?
        AND revision = ? ORDER BY updated_at`).bind(user.id, courseId, revision ?? course.revision).all<ProgressRow>()
      return rows.results.map(toProgress)
    },

    async listTeacherRecords(actor: Actor): Promise<Array<ProgressRecord & { userId: string; schoolYear: number | null; courseTitle: string }>> {
      const membership = await readSchoolMembership(db, actor)
      if (membership?.role !== 'teacher') throw new RepositoryError(403, 'teacher_required', '学校の先生のみ確認できます。')
      const rows = await db.prepare(`SELECT p.*, m.user_id, m.school_year, json_extract(c.data_json, '$.title') AS course_title
        FROM hunter_route_progress p JOIN hunter_route_memberships m ON m.user_id = p.user_id
        JOIN hunter_route_courses c ON c.id = p.course_id AND c.revision = p.revision
        WHERE m.school_id = ? AND c.school_id = ? ORDER BY p.updated_at DESC LIMIT 1000`)
        .bind(membership.schoolId, membership.schoolId)
        .all<ProgressRow & { user_id: string; school_year: number | null; course_title: string }>()
      return rows.results.map((row) => ({ ...toProgress(row), userId: row.user_id,
        schoolYear: row.school_year, courseTitle: row.course_title }))
    },
  }
}

export const createCourse = (actor: Actor, input: CourseData) => createRouteRepository(getRouteDatabase()).createCourse(actor, input)
export const listCourses = (actor: Actor) => createRouteRepository(getRouteDatabase()).listCourses(actor)
export const getCourse = (actor: Actor, id: string) => createRouteRepository(getRouteDatabase()).getCourse(actor, id)
export const updateCourseOwned = (actor: Actor, id: string, revision: number, data: CourseData) =>
  createRouteRepository(getRouteDatabase()).updateCourseOwned(actor, id, revision, data)
export const publishCourse = (actor: Actor, id: string, revision: number) => createRouteRepository(getRouteDatabase()).publishCourse(actor, id, revision)
export const unpublishCourse = (actor: Actor, id: string, revision: number) => createRouteRepository(getRouteDatabase()).unpublishCourse(actor, id, revision)
export const saveProgress = (actor: Actor, courseId: string, revision: number, sceneId: string, scenario: string, cleared: boolean, missedKinds: string[]) =>
  createRouteRepository(getRouteDatabase()).saveProgress(actor, courseId, revision, sceneId, scenario, cleared, missedKinds)
export const getProgress = (actor: Actor, courseId: string, revision?: number) => createRouteRepository(getRouteDatabase()).getProgress(actor, courseId, revision)
export const listTeacherRecords = (actor: Actor) => createRouteRepository(getRouteDatabase()).listTeacherRecords(actor)
