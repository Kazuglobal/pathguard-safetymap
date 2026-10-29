import { and, asc, eq } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { children, routeLearningSessions, schoolDistricts, userRoutes } from '../schema'

/**
 * 子どもの登録(UIUX改装 項目56)。本名ではなく呼び名だけを持ち、通学路(user_routes)とは別の表に置く。
 * 本人(保護者)しか読み書きできない(管理者にも見せない)。
 */

export const MAX_CHILDREN_PER_USER = 10
export const CHILD_NICKNAME_MAX_LENGTH = 20

export interface ChildWriteInput {
  nickname?: string
  grade?: number | null
  schoolDistrictId?: string | null
  /** 保護者が「呼び名は本名ではない」と確かめた(移行した呼び名の案内を閉じる) */
  confirmNickname?: boolean
}

export type ChildRow = typeof children.$inferSelect

export interface ChildCreateOptions {
  /**
   * 保護者が呼び名を確かめたことにするか。アプリの入力欄からの登録は true、
   * 通学路に残っていた「子どもの名前」を移すときは false(あとで一度だけ確認の案内を出す)
   */
  confirmed?: boolean
}

export interface ChildWithDistrict extends ChildRow {
  schoolDistrictName: string | null
  schoolDistrictCity: string | null
  schoolDistrictPrefecture: string | null
}

/** 全角の空白や半角カナを揃え、前後の空白を落とす。重複の判定と保存は必ずこの形で行う */
export function normalizeChildNickname(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
}

/** 以前の「子どもの名前」(100文字まで)を、呼び名の長さ(20文字)に収める */
export function legacyChildNameToNickname(value: string): string {
  return [...normalizeChildNickname(value)].slice(0, CHILD_NICKNAME_MAX_LENGTH).join('').trim()
}

/** 一意の制約の違反か(D1 も better-sqlite3 も「UNIQUE constraint failed」。drizzle が包むときは cause を見る) */
function isUniqueViolation(error: unknown): boolean {
  const messages = [error, (error as { cause?: unknown } | null)?.cause]
    .map((value) => (value instanceof Error ? value.message : ''))
  return messages.some((message) => /UNIQUE constraint failed/i.test(message))
}

function validateNickname(nickname: string): void {
  // SQLite の length() と同じく、文字(コードポイント)の数で数える
  const length = [...nickname].length
  if (length < 1 || length > CHILD_NICKNAME_MAX_LENGTH) throw new RangeError('Invalid child nickname')
  if (/\p{Cc}/u.test(nickname)) throw new RangeError('Invalid child nickname')
}

function validateGrade(grade: number | null | undefined): void {
  if (grade == null) return
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new RangeError('Invalid child grade')
}

export function createChildrenRepo(db: AppDb) {
  async function assertDistrictExists(schoolDistrictId: string | null | undefined) {
    if (schoolDistrictId == null) return
    if (schoolDistrictId.length > 128) throw new RangeError('Unknown school district')
    const [district] = await db.select({ id: schoolDistricts.id }).from(schoolDistricts)
      .where(eq(schoolDistricts.id, schoolDistrictId)).limit(1)
    if (!district) throw new RangeError('Unknown school district')
  }

  function requireUser(actor: Actor): Extract<Actor, { kind: 'user' }> {
    if (actor.kind !== 'user') throw new Error('A user actor is required')
    return actor
  }

  return {
    async list(actor: Actor): Promise<ChildWithDistrict[]> {
      const user = requireUser(actor)
      assertCan(actor, 'select', 'children', { ownerId: user.id })
      const rows = await db.select({
        child: children,
        schoolDistrictName: schoolDistricts.name,
        schoolDistrictCity: schoolDistricts.city,
        schoolDistrictPrefecture: schoolDistricts.prefecture,
      }).from(children)
        .leftJoin(schoolDistricts, eq(schoolDistricts.id, children.schoolDistrictId))
        .where(eq(children.userId, user.id))
        .orderBy(asc(children.createdAt), asc(children.id))
      return rows.map((row) => ({
        ...row.child,
        schoolDistrictName: row.schoolDistrictName ?? null,
        schoolDistrictCity: row.schoolDistrictCity ?? null,
        schoolDistrictPrefecture: row.schoolDistrictPrefecture ?? null,
      }))
    },

    async getOwn(actor: Actor, childId: string): Promise<ChildRow | null> {
      const user = requireUser(actor)
      if (!childId || childId.length > 128) return null
      const [row] = await db.select().from(children)
        .where(and(eq(children.id, childId), eq(children.userId, user.id))).limit(1)
      if (!row) return null
      assertCan(actor, 'select', 'children', { ownerId: row.userId })
      return row
    },

    async create(actor: Actor, input: ChildWriteInput, options: ChildCreateOptions = {}): Promise<ChildRow> {
      const user = requireUser(actor)
      assertCan(actor, 'insert', 'children', { ownerId: user.id })
      const nickname = normalizeChildNickname(input.nickname ?? '')
      validateNickname(nickname)
      validateGrade(input.grade)
      await assertDistrictExists(input.schoolDistrictId)
      const existing = await db.select({ id: children.id, nickname: children.nickname }).from(children)
        .where(eq(children.userId, user.id))
      if (existing.some((row) => row.nickname === nickname)) throw new RangeError('Child nickname already exists')
      if (existing.length >= MAX_CHILDREN_PER_USER) throw new RangeError('Too many children')
      const now = new Date().toISOString()
      const inserted = await db.insert(children).values({
        id: crypto.randomUUID(),
        userId: user.id,
        nickname,
        grade: input.grade ?? null,
        schoolDistrictId: input.schoolDistrictId ?? null,
        // アプリで入力した呼び名は、入力欄の「本名ではなく呼び名で」を見たうえでの登録
        nicknameConfirmedAt: options.confirmed === false ? null : now,
        createdAt: now,
        updatedAt: now,
      }).returning().catch((error: unknown) => {
        // 同じ呼び名の同時の登録(別のタブなど)は、上の確認をすり抜けて一意の制約で止まる
        if (isUniqueViolation(error)) throw new RangeError('Child nickname already exists')
        throw error
      })
      const [row] = inserted
      if (!row) throw new Error('Failed to create child')
      return row
    },

    /** 通学路の入力欄の呼び名から、同じ呼び名の子を探す。無ければ作る(上限を超えるときは作らない) */
    async findOrCreateByNickname(actor: Actor, rawNickname: string, options: ChildCreateOptions = {}): Promise<ChildRow> {
      const user = requireUser(actor)
      const nickname = normalizeChildNickname(rawNickname)
      validateNickname(nickname)
      assertCan(actor, 'select', 'children', { ownerId: user.id })
      const findSame = async () => (await db.select().from(children)
        .where(and(eq(children.userId, user.id), eq(children.nickname, nickname))).limit(1))[0]
      const found = await findSame()
      if (found) return found
      try {
        return await this.create(actor, { nickname }, options)
      } catch (error) {
        // 同時に同じ呼び名で登録された(別のタブなど)ときは、先にできた方を使う
        const raced = error instanceof RangeError && error.message === 'Child nickname already exists' ? await findSame() : undefined
        if (raced) return raced
        throw error
      }
    },

    async update(actor: Actor, childId: string, input: ChildWriteInput): Promise<ChildRow | null> {
      const existing = await this.getOwn(actor, childId)
      if (!existing) return null
      assertCan(actor, 'update', 'children', { ownerId: existing.userId })
      const nickname = input.nickname === undefined ? undefined : normalizeChildNickname(input.nickname)
      if (nickname !== undefined) validateNickname(nickname)
      validateGrade(input.grade)
      if (input.schoolDistrictId !== undefined) await assertDistrictExists(input.schoolDistrictId)
      if (nickname !== undefined && nickname !== existing.nickname) {
        const [duplicate] = await db.select({ id: children.id }).from(children)
          .where(and(eq(children.userId, existing.userId), eq(children.nickname, nickname))).limit(1)
        if (duplicate) throw new RangeError('Child nickname already exists')
      }
      const now = new Date().toISOString()
      // 呼び名を書き直したときも「確かめた」ことにする(入力欄で「本名ではなく呼び名で」を見ている)
      const confirms = input.confirmNickname === true || nickname !== undefined
      const [row] = await db.update(children).set({
        ...(nickname !== undefined ? { nickname } : {}),
        ...(input.grade !== undefined ? { grade: input.grade } : {}),
        ...(input.schoolDistrictId !== undefined ? { schoolDistrictId: input.schoolDistrictId } : {}),
        ...(confirms ? { nicknameConfirmedAt: existing.nicknameConfirmedAt ?? now } : {}),
        updatedAt: now,
      }).where(and(eq(children.id, existing.id), eq(children.userId, existing.userId))).returning()
      return row ?? null
    },

    /**
     * 子どもを消す。その子を指していた通学路・学習の記録からは参照だけを外す(通学路そのものは残す)。
     * 途中で失敗しても、参照の外れた通学路が「みんなの通学路」に見えるだけで済む順に流す
     */
    async delete(actor: Actor, childId: string): Promise<boolean> {
      const existing = await this.getOwn(actor, childId)
      if (!existing) return false
      assertCan(actor, 'delete', 'children', { ownerId: existing.userId })
      await db.update(userRoutes).set({ childId: null, childName: null })
        .where(and(eq(userRoutes.userId, existing.userId), eq(userRoutes.childId, existing.id)))
      await db.update(routeLearningSessions).set({ childId: null, childName: null })
        .where(and(eq(routeLearningSessions.userId, existing.userId), eq(routeLearningSessions.childId, existing.id)))
      await db.delete(children).where(and(eq(children.id, existing.id), eq(children.userId, existing.userId)))
      return true
    },
  }
}

export function listChildren(actor: Actor) { return createChildrenRepo(getDb()).list(actor) }
export function createChild(actor: Actor, input: ChildWriteInput) { return createChildrenRepo(getDb()).create(actor, input) }
export function updateChild(actor: Actor, childId: string, input: ChildWriteInput) { return createChildrenRepo(getDb()).update(actor, childId, input) }
export function deleteChild(actor: Actor, childId: string) { return createChildrenRepo(getDb()).delete(actor, childId) }
