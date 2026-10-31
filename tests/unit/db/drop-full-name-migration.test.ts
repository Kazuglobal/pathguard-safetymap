// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { profiles } from '@/lib/db/schema'

const MIGRATION = 'lib/db/migrations/20261029235818_uiux_drop_profiles_full_name.sql'

/** コメントを除いた SQL の文 */
function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;|--> statement-breakpoint/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

// 氏名の列を消すマイグレーション(UIUX改装 項目55)。本番の表を作り直さないことを固定する
describe('profiles.full_name を消すマイグレーション', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), MIGRATION), 'utf8')

  it('DROP COLUMN の1文だけで、表の作り直し(__new_ の表・CREATE TABLE)を含まない', () => {
    expect(statements(sql)).toEqual(['ALTER TABLE `profiles` DROP COLUMN `full_name`'])
    expect(sql).not.toContain('__new_')
    expect(sql).not.toMatch(/CREATE TABLE/i)
  })

  it('アプリのスキーマにも full_name は無い(列を消したあとに読み書きしない)', () => {
    expect(Object.keys(profiles)).not.toContain('fullName')
    expect(Object.values(profiles).some((column) => (column as { name?: string })?.name === 'full_name')).toBe(false)
  })

  it('適用してよい時期(グループ3が本番に出たあと)と、先に export を取ることを書いておく', () => {
    expect(sql).toContain('PR #271')
    expect(sql).toContain('export')
  })
})
