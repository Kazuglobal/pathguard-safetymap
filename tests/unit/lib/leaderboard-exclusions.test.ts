// @vitest-environment node
import Database from 'better-sqlite3'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BUILT_IN_EXCLUDED_EMAIL_SUFFIXES,
  excludedEmailCondition,
  excludedEmailSql,
  getLeaderboardExclusions,
  isLeaderboardExcludedEmail,
  LEADERBOARD_EXCLUDED_EMAILS_ENV,
  MAX_CONFIGURED_EXCLUDED_EMAILS,
  parseExcludedEmails,
  type LeaderboardExclusions,
} from '@/lib/leaderboard-exclusions'

const emails = sqliteTable('emails', { email: text('email') })

const SAMPLE_EMAILS: ReadonlyArray<string | null> = [
  'demo@example.com',
  'DEMO@EXAMPLE.COM',
  '  user@test.com  ',
  'student@test.com',
  'member@gmail.com',
  'someone@notexample.com',
  'x@sub.example.com',
  'example.com@gmail.com',
  'test.com@gmail.com',
  'owner@corp.jp',
  'Owner@Corp.JP',
  'other@corp.jp',
  '',
  null,
]

const withConfigured: LeaderboardExclusions = getLeaderboardExclusions({
  [LEADERBOARD_EXCLUDED_EMAILS_ENV]: ' Owner@Corp.JP ',
})

describe('leaderboard exclusion rules (pure)', () => {
  it('excludes the demo login and *@test.com accounts by the exact domain only', () => {
    const exclusions = getLeaderboardExclusions({})
    expect(isLeaderboardExcludedEmail('demo@example.com', exclusions)).toBe(true)
    expect(isLeaderboardExcludedEmail(' Demo@Example.COM ', exclusions)).toBe(true)
    expect(isLeaderboardExcludedEmail('admin@test.com', exclusions)).toBe(true)
    expect(isLeaderboardExcludedEmail('someone@notexample.com', exclusions)).toBe(false)
    expect(isLeaderboardExcludedEmail('x@sub.example.com', exclusions)).toBe(false)
    expect(isLeaderboardExcludedEmail('example.com@gmail.com', exclusions)).toBe(false)
    expect(isLeaderboardExcludedEmail('member@gmail.com', exclusions)).toBe(false)
    expect(isLeaderboardExcludedEmail(null, exclusions)).toBe(false)
    expect(isLeaderboardExcludedEmail('', exclusions)).toBe(false)
  })

  it('adds the configured emails case-insensitively and reads only the named key', () => {
    const exclusions = getLeaderboardExclusions({
      [LEADERBOARD_EXCLUDED_EMAILS_ENV]: ' Owner@Corp.JP , not-an-email, a b@c.jp, "q"@x.jp, owner@corp.jp,',
      ADMIN_EMAILS: 'member@gmail.com',
    })
    expect(exclusions.emails).toEqual(['owner@corp.jp'])
    expect(isLeaderboardExcludedEmail('OWNER@corp.jp', exclusions)).toBe(true)
    expect(isLeaderboardExcludedEmail('member@gmail.com', exclusions)).toBe(false)
    expect(getLeaderboardExclusions({}).emails).toEqual([])
  })

  it('caps the configured list so the leaderboard query stays under the D1 bind limit', () => {
    const many = Array.from({ length: MAX_CONFIGURED_EXCLUDED_EMAILS + 10 }, (_, index) => `user${index}@corp.jp`)
    expect(parseExcludedEmails(many.join(','))).toHaveLength(MAX_CONFIGURED_EXCLUDED_EMAILS)
    expect(parseExcludedEmails(undefined)).toEqual([])
  })

  it('keeps the built-in suffixes free of LIKE wildcards (SQL uses LIKE %suffix)', () => {
    expect(BUILT_IN_EXCLUDED_EMAIL_SUFFIXES).toEqual(['@example.com', '@test.com'])
    for (const suffix of BUILT_IN_EXCLUDED_EMAIL_SUFFIXES) expect(suffix).not.toMatch(/[%_\\]/)
  })
})

describe('leaderboard exclusion SQL matches the pure function', () => {
  let sqlite: Database.Database
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec('create table emails (email text)')
    const insert = sqlite.prepare('insert into emails (email) values (?)')
    for (const email of SAMPLE_EMAILS) insert.run(email)
  })
  afterEach(() => sqlite.close())

  it.each([
    ['built-in only', getLeaderboardExclusions({})],
    ['with LEADERBOARD_EXCLUDED_EMAILS', withConfigured],
  ])('raw SQL predicate agrees row by row (%s)', (_label, exclusions) => {
    const rows = sqlite.prepare(`select email, ${excludedEmailSql('email', exclusions)} as excluded from emails`).all() as Array<{ email: string | null; excluded: number }>
    expect(rows.map((row) => [row.email, row.excluded === 1]))
      .toEqual(SAMPLE_EMAILS.map((email) => [email, isLeaderboardExcludedEmail(email, exclusions)]))
  })

  it.each([
    ['built-in only', getLeaderboardExclusions({})],
    ['with LEADERBOARD_EXCLUDED_EMAILS', withConfigured],
  ])('drizzle predicate agrees row by row and is never NULL (%s)', (_label, exclusions) => {
    const db = drizzle(sqlite)
    const rows = db.select({
      email: emails.email,
      excluded: sql<number>`${excludedEmailCondition(emails.email, exclusions)}`,
    }).from(emails).all()
    expect(rows.every((row) => row.excluded === 0 || row.excluded === 1)).toBe(true)
    expect(rows.map((row) => [row.email, row.excluded === 1]))
      .toEqual(SAMPLE_EMAILS.map((email) => [email, isLeaderboardExcludedEmail(email, exclusions)]))
  })

  it('hides configured emails when the SQL is shown on screen', () => {
    const shown = excludedEmailSql('p.email', withConfigured, { redactConfiguredEmails: true })
    expect(shown).not.toContain('owner@corp.jp')
    expect(shown).toContain(`<${LEADERBOARD_EXCLUDED_EMAILS_ENV} 1>`)
    expect(excludedEmailSql('p.email', withConfigured)).toContain("'owner@corp.jp'")
  })

  it('refuses unsafe column references', () => {
    expect(() => excludedEmailSql('p.email); drop table profiles; --')).toThrow(RangeError)
  })
})
