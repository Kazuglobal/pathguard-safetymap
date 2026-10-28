// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  d1ExecuteArgs,
  describeWranglerArgs,
  hasConfirmation,
  isDirectRun,
  joinStatements,
  parseCliArgs,
  parseD1Json,
  r2DeleteArgs,
  redactValues,
  resolveR2BucketName,
  runD1,
  sqlInList,
  sqlString,
  stripJsonc,
  UsageError,
} from '@/scripts/ops/ops-shared'

describe('ops-shared SQL helpers', () => {
  it('escapes single quotes and rejects NUL', () => {
    expect(sqlString("O'Brien")).toBe("'O''Brien'")
    expect(sqlString('テスト')).toBe("'テスト'")
    expect(() => sqlString('a\u0000b')).toThrow(RangeError)
  })

  it('builds IN lists and refuses an empty one', () => {
    expect(sqlInList(['a', "b'c"])).toBe("('a', 'b''c')")
    expect(() => sqlInList([])).toThrow(RangeError)
  })

  it('joins statements with exactly one semicolon each', () => {
    expect(joinStatements(['SELECT 1;', ' SELECT 2 '])).toBe('SELECT 1;\nSELECT 2;')
  })
})

describe('ops-shared wrangler arguments', () => {
  it('always targets the remote pathguardian D1 with JSON output', () => {
    expect(d1ExecuteArgs('SELECT 1')).toEqual(['d1', 'execute', 'pathguardian', '--remote', '--json', '--command', 'SELECT 1'])
    expect(r2DeleteArgs('pg-media-private', 'danger-reports/u/r/a.webp'))
      .toEqual(['r2', 'object', 'delete', 'pg-media-private/danger-reports/u/r/a.webp', '--remote'])
  })

  it('never shows the SQL body when describing a command', () => {
    const shown = describeWranglerArgs(d1ExecuteArgs("SELECT * FROM profiles WHERE email = 'secret@corp.jp'"))
    expect(shown).toBe('npx wrangler d1 execute pathguardian --remote --json --command "<SQL>"')
  })
})

describe('ops-shared CLI parsing and guards', () => {
  it('accepts flags and --name=value / --name value', () => {
    const args = parseCliArgs(['--apply', '--user-id', 'abc', '--input=x.json'], { flags: ['apply'], values: ['user-id', 'input'] })
    expect([...args.flags]).toEqual(['apply'])
    expect(Object.fromEntries(args.values)).toEqual({ 'user-id': 'abc', input: 'x.json' })
  })

  it.each([
    [['--aply'], '不明なオプション'],
    [['apply'], '不明な引数'],
    [['--input'], '値がありません'],
    [['--input', '--apply'], '値がありません'],
    [['--apply=yes'], '値は付けられません'],
  ])('rejects %j as a usage error', (argv, message) => {
    expect(() => parseCliArgs(argv, { flags: ['apply'], values: ['input'] })).toThrow(UsageError)
    expect(() => parseCliArgs(argv, { flags: ['apply'], values: ['input'] })).toThrow(message)
  })

  it('requires the confirmation variable to be exactly "yes"', () => {
    expect(hasConfirmation({ CONFIRM_X: 'yes' }, 'CONFIRM_X')).toBe(true)
    expect(hasConfirmation({ CONFIRM_X: 'YES' }, 'CONFIRM_X')).toBe(false)
    expect(hasConfirmation({ CONFIRM_X: '1' }, 'CONFIRM_X')).toBe(false)
    expect(hasConfirmation({}, 'CONFIRM_X')).toBe(false)
  })

  it('runs main only when the script itself is the entry point', () => {
    expect(isDirectRun('find-test-data', 'C:\\repo\\scripts\\ops\\find-test-data.ts')).toBe(true)
    expect(isDirectRun('find-test-data', '/repo/node_modules/vitest/vitest.mjs')).toBe(false)
    expect(isDirectRun('find-test-data', '/repo/scripts/ops/cleanup-test-data.ts')).toBe(false)
    expect(isDirectRun('find-test-data', undefined)).toBe(false)
  })

  it('redacts values case-insensitively', () => {
    expect(redactValues('near "Staff@Corp.jp": syntax error', ['staff@corp.jp'])).toBe('near "***": syntax error')
  })
})

describe('ops-shared D1 output parsing', () => {
  it('reads the per-statement result array, also after a log preamble', () => {
    const json = JSON.stringify([{ results: [{ id: 'a' }], success: true, meta: { changes: 0 } }], null, 2)
    expect(parseD1Json(json)[0].results).toEqual([{ id: 'a' }])
    expect(parseD1Json(`[warn] update available\n${json}\n`)[0].results).toEqual([{ id: 'a' }])
  })

  it('fails loudly on a failed statement or unreadable output', () => {
    expect(() => parseD1Json(JSON.stringify([{ results: [], success: false }]))).toThrow('失敗')
    expect(() => parseD1Json('Error: not authenticated')).toThrow('JSON')
  })

  it('reports wrangler failures without leaking configured values', async () => {
    const runner = async () => ({ code: 1, stdout: '', stderr: 'no such column near staff@corp.jp' })
    const error = await runD1(runner, 'SELECT 1', ['staff@corp.jp']).catch((reason: unknown) => reason as Error)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('***')
    expect(error.message).not.toContain('staff@corp.jp')
  })
})

describe('ops-shared wrangler.jsonc parsing', () => {
  it('strips comments and trailing commas without touching strings', () => {
    const text = `{
      // comment with "quotes"
      "url": "https://example.com/a//b", /* block */
      "cron": "*/5 * * * *",
      "list": [1, 2,],
    }`
    expect(JSON.parse(stripJsonc(text))).toEqual({ url: 'https://example.com/a//b', cron: '*/5 * * * *', list: [1, 2] })
  })

  it('finds the report media bucket in the real wrangler.jsonc', () => {
    const text = readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8')
    expect(resolveR2BucketName(text, 'MEDIA_PRIVATE')).toBe('pg-media-private')
    expect(() => resolveR2BucketName(text, 'NOPE')).toThrow('NOPE')
  })
})
