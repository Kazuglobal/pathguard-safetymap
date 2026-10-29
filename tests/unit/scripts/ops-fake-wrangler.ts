import path from 'node:path'
import { readFileSync } from 'node:fs'

import type Database from 'better-sqlite3'

import type { EnvSource, OpsDeps, WranglerRunner } from '@/scripts/ops/ops-shared'

/** 単一引用符の中の ; では区切らない、テスト用の簡易 SQL 分割 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    if (inString) {
      current += char
      if (char === "'" && sql[index + 1] === "'") {
        current += "'"
        index += 1
      } else if (char === "'") {
        inString = false
      }
      continue
    }
    if (char === "'") inString = true
    if (char === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

/** better-sqlite3 に流して D1 の --json 出力を真似る */
export function runOnSqlite(sqlite: Database.Database, sql: string) {
  return splitSqlStatements(sql).map((statement) => {
    const prepared = sqlite.prepare(statement)
    if (prepared.reader) return { results: prepared.all() as Record<string, unknown>[], success: true, meta: { changes: 0 } }
    const info = prepared.run()
    return { results: [] as Record<string, unknown>[], success: true, meta: { changes: info.changes } }
  })
}

export interface FakeWrangler {
  readonly runner: WranglerRunner
  readonly calls: string[][]
  readonly r2Deleted: string[]
}

/** ネットワークに出ない wrangler の代わり。d1 は SQLite に流し、r2 は呼ばれた順に記録する */
export function createFakeWrangler(
  sqlite: Database.Database,
  options: { readonly failR2At?: number } = {},
): FakeWrangler {
  const calls: string[][] = []
  const r2Deleted: string[] = []
  const runner: WranglerRunner = async (args) => {
    calls.push([...args])
    if (args[0] === 'd1') {
      const sql = args[args.indexOf('--command') + 1]
      try {
        return { code: 0, stdout: JSON.stringify(runOnSqlite(sqlite, sql), null, 2), stderr: '' }
      } catch (error) {
        return { code: 1, stdout: '', stderr: JSON.stringify({ error: { text: error instanceof Error ? error.message : 'error' } }) }
      }
    }
    if (args[0] === 'r2') {
      if (options.failR2At !== undefined && r2Deleted.length === options.failR2At) {
        return { code: 1, stdout: '', stderr: 'R2 failure' }
      }
      r2Deleted.push(args[3])
      return { code: 0, stdout: '', stderr: '' }
    }
    return { code: 1, stdout: '', stderr: `unexpected wrangler call: ${args.join(' ')}` }
  }
  return { runner, calls, r2Deleted }
}

export interface TestDeps extends OpsDeps {
  readonly lines: string[]
  readonly errors: string[]
  readonly written: Map<string, string>
}

/** files は cwd からの相対パス → 中身。無いファイルは実ファイル（wrangler.jsonc など）を読む */
export function createTestDeps(input: {
  readonly runner: WranglerRunner
  readonly env?: EnvSource
  readonly files?: Readonly<Record<string, string>>
  readonly cwd?: string
}): TestDeps {
  const cwd = input.cwd ?? process.cwd()
  const lines: string[] = []
  const errors: string[] = []
  const written = new Map<string, string>()
  const files = new Map(Object.entries(input.files ?? {}).map(([name, text]) => [path.resolve(cwd, name), text]))
  return {
    env: input.env ?? {},
    cwd,
    runner: input.runner,
    log: (line) => { lines.push(line) },
    error: (line) => { errors.push(line) },
    readTextFile: (filePath) => files.get(filePath) ?? readFileSync(filePath, 'utf8'),
    writeTextFile: (filePath, text) => { written.set(filePath, text) },
    fileExists: (filePath) => files.has(filePath) || written.has(filePath),
    now: () => new Date('2026-10-28T00:00:00.000Z'),
    lines,
    errors,
    written,
  }
}
