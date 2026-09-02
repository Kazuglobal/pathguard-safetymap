import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

export type TestDatabase = ReturnType<typeof createTestDatabase>

function migrationFiles(): string[] {
  const directory = path.join(process.cwd(), 'lib', 'db', 'migrations')
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(directory, file))
}

export function createTestDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  for (const file of migrationFiles()) {
    sqlite.exec(fs.readFileSync(file, 'utf8').replaceAll('--> statement-breakpoint', ''))
  }

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  }
}
