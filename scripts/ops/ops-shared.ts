/**
 * scripts/ops/*.ts の共通部品（本番 D1 / R2 を整備するスクリプト用）。
 *
 * - wrangler は node_modules/wrangler/bin/wrangler.js を node で直接起動する。中身は `npx wrangler` と同じ
 *   ローカルの wrangler だが、Windows の cmd.exe を通さないので SQL の % や引用符が書き換わらない
 *   （scripts/migrate/sync-storage-via-wrangler.ts と同じ方式）。
 * - 環境変数の値は表示しない（キー名だけを出す）。
 * - このファイルを import しただけでは何も実行しない。テストは runner を差し替えるのでネットワークに出ない。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { LEADERBOARD_EXCLUDED_EMAILS_ENV, type LeaderboardExclusions } from '../../lib/leaderboard-exclusions'

export const D1_DATABASE_NAME = 'pathguardian'
export const WRANGLER_CONFIG_FILE = 'wrangler.jsonc'
/** 危険箇所の報告の画像が入っている R2 バインディング（app/api/reports/[id]/route.ts と同じ） */
export const REPORT_MEDIA_BINDING = 'MEDIA_PRIVATE'
export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"
/** seed-demo-account.ts の見本の通学路の説明はこの文字列で始まる（find-test-data.ts は既定で候補から外す） */
export const DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX = '【デモ用サンプル】'

export type EnvSource = Readonly<Record<string, string | undefined>>

export interface WranglerResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

export type WranglerRunner = (args: readonly string[]) => Promise<WranglerResult>

export interface OpsDeps {
  readonly env: EnvSource
  readonly cwd: string
  readonly runner: WranglerRunner
  readonly log: (line: string) => void
  readonly error: (line: string) => void
  readonly readTextFile: (filePath: string) => string
  readonly writeTextFile: (filePath: string, text: string) => void
  readonly fileExists: (filePath: string) => boolean
  readonly now: () => Date
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export function sqlString(value: string): string {
  if (value.includes('\u0000')) throw new RangeError('SQL の文字列に NUL は使えません')
  return `'${value.replaceAll("'", "''")}'`
}

export function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('SQL の数値が不正です')
  return String(value)
}

export function sqlInList(values: readonly string[]): string {
  if (values.length === 0) throw new RangeError('IN 句の値が空です')
  return `(${values.map(sqlString).join(', ')})`
}

export function joinStatements(statements: readonly string[]): string {
  return statements.map((statement) => `${statement.trim().replace(/;$/, '')};`).join('\n')
}

export function d1ExecuteArgs(sql: string, database: string = D1_DATABASE_NAME): string[] {
  return ['d1', 'execute', database, '--remote', '--json', '--command', sql]
}

export function r2DeleteArgs(bucket: string, key: string): string[] {
  return ['r2', 'object', 'delete', `${bucket}/${key}`, '--remote']
}

/** 表示用のコマンド。SQL の本文（環境変数由来の値を含みうる）は出さない */
export function describeWranglerArgs(args: readonly string[]): string {
  const shown = args.map((arg, index) => (index > 0 && args[index - 1] === '--command' ? '"<SQL>"' : arg))
  return `npx wrangler ${shown.join(' ')}`
}

/** 値（環境変数由来のメールなど）を *** に置き換える。大文字小文字は区別しない */
export function redactValues(text: string, values: readonly string[]): string {
  return values
    .filter((value) => value.length > 0)
    .reduce((current, value) => current.split(new RegExp(escapeRegExp(value), 'gi')).join('***'), text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasConfirmation(env: EnvSource, key: string): boolean {
  return env[key] === 'yes'
}

/** 除外アカウントの規則を表示用に説明する（LEADERBOARD_EXCLUDED_EMAILS は件数だけ） */
export function describeExclusions(exclusions: LeaderboardExclusions): string {
  const suffixes = exclusions.suffixes.join(' / ')
  return exclusions.emails.length > 0
    ? `${suffixes} と ${LEADERBOARD_EXCLUDED_EMAILS_ENV} の ${exclusions.emails.length} 件（値は表示しません）`
    : `${suffixes}（${LEADERBOARD_EXCLUDED_EMAILS_ENV} は未設定）`
}

export interface CliSpec {
  readonly flags: readonly string[]
  readonly values: readonly string[]
}

export interface CliArgs {
  readonly flags: ReadonlySet<string>
  readonly values: ReadonlyMap<string, string>
}

/** --flag と --name=value / --name value を受け付ける。知らないオプションは打ち間違いとして止める */
export function parseCliArgs(argv: readonly string[], spec: CliSpec): CliArgs {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  let index = 0
  while (index < argv.length) {
    const arg = argv[index]
    if (!arg.startsWith('--')) throw new UsageError(`不明な引数です: ${arg}`)
    const separator = arg.indexOf('=')
    const name = separator >= 0 ? arg.slice(2, separator) : arg.slice(2)
    const inlineValue = separator >= 0 ? arg.slice(separator + 1) : undefined
    if (spec.flags.includes(name)) {
      if (inlineValue !== undefined) throw new UsageError(`--${name} に値は付けられません`)
      flags.add(name)
      index += 1
      continue
    }
    if (!spec.values.includes(name)) throw new UsageError(`不明なオプションです: --${name}`)
    const value = inlineValue ?? argv[index + 1]
    if (value === undefined || value === '' || (inlineValue === undefined && value.startsWith('--'))) {
      throw new UsageError(`--${name} の値がありません`)
    }
    values.set(name, value)
    index += inlineValue === undefined ? 2 : 1
  }
  return { flags, values }
}

/** テストや import で main を走らせないため、直接起動されたときだけ真にする（tsx でも CJS でも動く判定） */
export function isDirectRun(scriptName: string, entry: string | undefined = process.argv[1]): boolean {
  if (!entry) return false
  return path.basename(entry).replace(/\.[cm]?[jt]s$/i, '') === scriptName
}

export interface D1StatementResult {
  readonly results: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly meta?: Readonly<Record<string, unknown>>
}

/** `wrangler d1 execute --json` の出力（文ごとの結果の配列）を読む */
export function parseD1Json(stdout: string): D1StatementResult[] {
  const parsed = parseJsonArray(stdout.trim())
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || !Array.isArray((entry as { results?: unknown }).results)) {
      throw new Error(`wrangler の JSON 出力の ${index + 1} 件目に results がありません`)
    }
    const value = entry as { results: Record<string, unknown>[]; success?: unknown; meta?: Record<string, unknown> }
    if (value.success === false) throw new Error(`SQL の ${index + 1} 文目が失敗しました`)
    return { results: value.results, meta: value.meta }
  })
}

function parseJsonArray(text: string): unknown[] {
  const candidates = [text]
  const start = text.search(/^\[\s*[{\]]/m)
  const end = text.lastIndexOf(']')
  if (start > 0 && end > start) candidates.push(text.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate)
      if (Array.isArray(value)) return value
    } catch {
      // 次の候補（前置きのログを除いた部分）を試す
    }
  }
  throw new Error('wrangler の出力から JSON を読み取れませんでした')
}

function tail(text: string, length = 2000): string {
  return text.length > length ? `…${text.slice(-length)}` : text
}

/** 本番 D1 に SQL を流す。失敗時のメッセージは secrets を伏せてから返す */
export async function runD1(
  runner: WranglerRunner,
  sql: string,
  secrets: readonly string[] = [],
): Promise<D1StatementResult[]> {
  const result = await runner(d1ExecuteArgs(sql))
  if (result.code !== 0) {
    const detail = redactValues(tail(`${result.stderr}\n${result.stdout}`.trim()), secrets)
    throw new Error(`wrangler d1 execute が失敗しました（終了コード ${result.code ?? '不明'}）\n${detail}`)
  }
  return parseD1Json(result.stdout)
}

export function createWranglerRunner(cwd: string): WranglerRunner {
  const entry = path.join(cwd, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  return (args) => new Promise<WranglerResult>((resolve, reject) => {
    if (!existsSync(entry)) {
      reject(new Error('node_modules/wrangler が見つかりません。リポジトリのルートで実行してください'))
      return
    }
    const child = spawn(process.execPath, [entry, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.once('error', reject)
    child.once('close', (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }))
  })
}

export function defaultOpsDeps(): OpsDeps {
  const cwd = process.cwd()
  return {
    env: process.env,
    cwd,
    runner: createWranglerRunner(cwd),
    log: (line) => { process.stdout.write(`${line}\n`) },
    error: (line) => { process.stderr.write(`${line}\n`) },
    readTextFile: (filePath) => readFileSync(filePath, 'utf8'),
    writeTextFile: (filePath, text) => { writeFileSync(filePath, text, { encoding: 'utf8', flag: 'wx' }) },
    fileExists: (filePath) => existsSync(filePath),
    now: () => new Date(),
  }
}

/** スクリプトの入口。終了コードを process.exitCode に入れる */
export function runCli(
  name: string,
  main: (argv: readonly string[], deps: OpsDeps) => Promise<number>,
): void {
  const deps = defaultOpsDeps()
  main(process.argv.slice(2), deps).then(
    (code) => { process.exitCode = code },
    (error: unknown) => {
      deps.error(`[${name}] ${error instanceof Error ? error.message : '不明なエラー'}`)
      process.exitCode = 1
    },
  )
}

/** JSONC（// と /* *\/ のコメント・末尾カンマ）を JSON にする。文字列の中は触らない */
export function stripJsonc(text: string): string {
  return removeTrailingCommas(removeComments(text))
}

function removeComments(text: string): string {
  let output = ''
  let index = 0
  let inString = false
  while (index < text.length) {
    const char = text[index]
    const next = text[index + 1]
    if (inString) {
      output += char
      if (char === '\\' && next !== undefined) {
        output += next
        index += 2
        continue
      }
      if (char === '"') inString = false
      index += 1
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      index += 1
      continue
    }
    if (char === '/' && next === '/') {
      const lineEnd = text.indexOf('\n', index)
      index = lineEnd < 0 ? text.length : lineEnd
      continue
    }
    if (char === '/' && next === '*') {
      const commentEnd = text.indexOf('*/', index + 2)
      index = commentEnd < 0 ? text.length : commentEnd + 2
      continue
    }
    output += char
    index += 1
  }
  return output
}

function removeTrailingCommas(text: string): string {
  let output = ''
  let inString = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      output += char
      if (char === '\\') {
        output += text[index + 1] ?? ''
        index += 1
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') inString = true
    if (char === ',' && /^\s*[}\]]/.test(text.slice(index + 1))) continue
    output += char
  }
  return output
}

/** wrangler.jsonc からバインディング名に対応する R2 バケット名を読む */
export function resolveR2BucketName(configText: string, binding: string): string {
  const config = JSON.parse(stripJsonc(configText)) as {
    r2_buckets?: Array<{ binding?: unknown; bucket_name?: unknown }>
  }
  const bucket = (config.r2_buckets ?? []).find((entry) => entry.binding === binding)?.bucket_name
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error(`${WRANGLER_CONFIG_FILE} に R2 バインディング ${binding} のバケット名が見つかりません`)
  }
  return bucket
}

/** 出力用に文字列を短くする（改行は空白に） */
export function shortText(value: unknown, length = 40): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > length ? `${text.slice(0, length)}…` : text
}

export function readString(row: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

export function readNumber(row: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

/** JSON 文字列の配列（processed_image_keys など）を読む。壊れていれば空 */
export function readJsonStringArray(value: unknown): string[] {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function resolveInCwd(cwd: string, filePath: string): string {
  return path.resolve(cwd, filePath)
}
