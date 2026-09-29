import 'server-only'

import type { Actor } from '@/lib/db/authz'
import { getRouteDatabase, readSchoolMembership, RepositoryError, requireRouteUser,
  type RouteDatabase, type SchoolMembership } from './repository'

async function hashInvitation(code: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createSchoolRepository(db: RouteDatabase) {
  return {
    getMembership(actor: Actor): Promise<SchoolMembership | null> {
      return readSchoolMembership(db, actor)
    },

    async createSchool(actor: Actor, name: string): Promise<SchoolMembership> {
      const user = requireRouteUser(actor)
      if (!user.isAdmin) throw new RepositoryError(403, 'admin_required', '学校の登録は管理者が行います。')
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        throw new RepositoryError(400, 'invalid_school_name', '学校名は100文字以内で入力してください。')
      }
      if (await readSchoolMembership(db, actor)) throw new RepositoryError(409, 'already_joined', 'すでに学校に参加しています。')
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      // D1 batch is a transaction; a conflicting membership must also roll back the school.
      try {
        await db.batch([
          db.prepare('INSERT INTO hunter_route_schools (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
            .bind(id, name.trim(), user.id, now),
          db.prepare(`INSERT INTO hunter_route_memberships (user_id, school_id, role, school_year, created_at)
            VALUES (?, ?, 'teacher', NULL, ?)`).bind(user.id, id, now),
        ])
      } catch (error) {
        if (await readSchoolMembership(db, actor)) throw new RepositoryError(409, 'already_joined', 'すでに学校に参加しています。')
        throw error
      }
      return { schoolId: id, schoolName: name.trim(), role: 'teacher', schoolYear: null }
    },

    async createInvite(actor: Actor): Promise<{ code: string; expiresAt: string }> {
      const user = requireRouteUser(actor)
      const membership = await readSchoolMembership(db, actor)
      if (membership?.role !== 'teacher') throw new RepositoryError(403, 'teacher_required', '学校の先生のみ招待を作成できます。')
      const code = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const tokenHash = await hashInvitation(code)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await db.prepare(`INSERT INTO hunter_route_invitations (token_hash, school_id, created_by, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)`).bind(tokenHash, membership.schoolId, user.id, expiresAt, now.toISOString()).run()
      return { code, expiresAt }
    },

    async joinSchool(actor: Actor, code: string, schoolYear: number): Promise<SchoolMembership> {
      const user = requireRouteUser(actor)
      if (typeof code !== 'string' || !/^[a-f0-9]{48}$/.test(code.trim()) ||
        !Number.isInteger(schoolYear) || schoolYear < 1 || schoolYear > 9) {
        throw new RepositoryError(400, 'invalid_invitation', '招待コードと学年を確認してください。')
      }
      if (await readSchoolMembership(db, actor)) throw new RepositoryError(409, 'already_joined', 'すでに学校に参加しています。')
      const tokenHash = await hashInvitation(code.trim())
      const now = new Date().toISOString()
      // Role is always assigned by the server. Invite validity and membership insert are atomic.
      const result = await db.prepare(`INSERT OR IGNORE INTO hunter_route_memberships
        (user_id, school_id, role, school_year, created_at)
        SELECT ?, i.school_id, 'student', ?, ? FROM hunter_route_invitations i
        JOIN hunter_route_memberships teacher ON teacher.user_id = i.created_by
        AND teacher.school_id = i.school_id AND teacher.role = 'teacher'
        WHERE i.token_hash = ? AND i.expires_at > ?`)
        .bind(user.id, schoolYear, now, tokenHash, now).run()
      if (result.meta.changes !== 1) throw new RepositoryError(400, 'invalid_invitation', '招待コードが違うか、期限が切れています。')
      const membership = await readSchoolMembership(db, actor)
      if (!membership) throw new RepositoryError(500, 'membership_missing', '学校への参加を確認できませんでした。')
      return membership
    },
  }
}

export const getSchoolMembership = (actor: Actor) => createSchoolRepository(getRouteDatabase()).getMembership(actor)
export const createSchool = (actor: Actor, name: string) => createSchoolRepository(getRouteDatabase()).createSchool(actor, name)
export const createSchoolInvite = (actor: Actor) => createSchoolRepository(getRouteDatabase()).createInvite(actor)
export const joinSchool = (actor: Actor, code: string, schoolYear: number) => createSchoolRepository(getRouteDatabase()).joinSchool(actor, code, schoolYear)
