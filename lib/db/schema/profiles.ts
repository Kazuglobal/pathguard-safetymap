import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  fullName: text('full_name'),
  avatarKey: text('avatar_key'),
  role: text('role').notNull().default('user'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_profiles_email').on(table.email),
  check('profiles_role', sql`${table.role} in ('user','admin')`),
])
