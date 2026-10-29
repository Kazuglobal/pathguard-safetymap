import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

/**
 * 子どもの登録(UIUX改装 項目56)。
 *
 * - 本名は持たない。nickname は「呼び名」(例: さくちゃん)だけ
 * - 学校は学区コード(school_districts.id)で持ち、住所や座標は持たない
 * - 自宅に近い通学路(user_routes)とは別の表にして、自宅・学校・子どもの名前が
 *   1つの行にそろわないようにする。通学路からは user_routes.child_id で参照する(FK は付けない)
 */
export const children = sqliteTable('children', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  nickname: text('nickname').notNull(),
  /** 学年(1〜6)。未入力なら null */
  grade: integer('grade'),
  /** 学区コード(lib/school-districts.ts の id)。未入力なら null */
  schoolDistrictId: text('school_district_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_children_user').on(table.userId),
  check('children_nickname_length', sql`length(${table.nickname}) between 1 and 20`),
  check('children_grade', sql`${table.grade} is null or ${table.grade} between 1 and 6`),
])
