import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  // full_name(以前の「氏名」)は預からない(UIUX改装 項目55)。アプリからは読み書きしない。
  // 列そのものは、いまの本番のコードが読まなくなってから(このグループのデプロイのあと)次のマイグレーションで消す
  avatarKey: text('avatar_key'),
  role: text('role').notNull().default('user'),
  /**
   * 位置の保存の細かさ(項目59)。standard=通学路の両端を削り起点・終点を丸めて保存、
   * coarse=学区・市区町村だけを保存して通知も地域単位にする
   */
  locationPrecision: text('location_precision').notNull().default('standard'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_profiles_email').on(table.email),
  check('profiles_role', sql`${table.role} in ('user','admin')`),
])
