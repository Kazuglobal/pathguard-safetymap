import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'

/**
 * ランキング(/leaderboard)から外すデモ・テストアカウントの判定。
 *
 * - 組み込み: ログイン画面のデモ(demo@example.com)と scripts/create-test-users.ts のテストユーザー(*@test.com)。
 *   「@ドメイン」で終わるときだけ外す(notexample.com や sub.example.com は外さない)。
 * - 追加: 環境変数 LEADERBOARD_EXCLUDED_EMAILS(カンマ区切りのメール)。値はログ・画面・SQL の表示に出さないこと。
 * - profiles.role は CHECK 制約で 'user' | 'admin' しか持てないため、ロールではなくメールで判定する。
 * - profiles 行が無い(メールが分からない)ユーザーは外さない。判定できないものは表示する側に倒す。
 *
 * 純関数 isLeaderboardExcludedEmail と SQL 述語 excludedEmailCondition / excludedEmailSql は同じ規則で、
 * tests/unit/lib/leaderboard-exclusions.test.ts で結果が一致することを確認している。片方だけ変えないこと。
 */

export const LEADERBOARD_EXCLUDED_EMAILS_ENV = 'LEADERBOARD_EXCLUDED_EMAILS'

/** LIKE のワイルドカード(% と _)を含めないこと。SQL 側は LIKE '%<suffix>' で末尾一致を取る */
export const BUILT_IN_EXCLUDED_EMAIL_SUFFIXES: readonly string[] = ['@example.com', '@test.com']

/** D1 のバインド変数は 1 クエリ 100 個まで。ランキングのクエリに収まるよう上限を置く(超えた分は無視) */
export const MAX_CONFIGURED_EXCLUDED_EMAILS = 50

export interface LeaderboardExclusions {
  /** LEADERBOARD_EXCLUDED_EMAILS のメール(前後の空白を除き小文字化・重複なし) */
  readonly emails: readonly string[]
  /** 末尾一致で外す「@ドメイン」(小文字) */
  readonly suffixes: readonly string[]
}

export type EnvSource = Readonly<Record<string, string | undefined>>

/** 引用符・区切り文字・空白を含まない local@domain.tld だけを受け付ける(SQL リテラルにしても安全な形) */
const EMAIL_PATTERN = /^[^\s@'"`\\,;()]+@[^\s@'"`\\,;()]+\.[^\s@'"`\\,;()]+$/
const MAX_EMAIL_LENGTH = 254
const SQL_COLUMN_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/

export function normalizeEmail(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** カンマ区切りのメール一覧を正規化する。メールの形でないものは捨てる */
export function parseExcludedEmails(raw: string | null | undefined): string[] {
  if (!raw) return []
  const unique = raw
    .split(',')
    .map(normalizeEmail)
    .filter((email) => email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email))
    .filter((email, index, all) => all.indexOf(email) === index)
  return unique.slice(0, MAX_CONFIGURED_EXCLUDED_EMAILS)
}

/** 環境変数はキー名だけを読む。値はどこにも出力しない */
export function getLeaderboardExclusions(env: EnvSource = process.env): LeaderboardExclusions {
  return {
    emails: parseExcludedEmails(env[LEADERBOARD_EXCLUDED_EMAILS_ENV]),
    suffixes: BUILT_IN_EXCLUDED_EMAIL_SUFFIXES,
  }
}

export function isLeaderboardExcludedEmail(
  email: string | null | undefined,
  exclusions: LeaderboardExclusions = getLeaderboardExclusions(),
): boolean {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return exclusions.suffixes.some((suffix) => normalized.endsWith(suffix))
    || exclusions.emails.includes(normalized)
}

/**
 * drizzle 用: メールが除外対象なら真になる条件。NULL のメールは '' として扱い、必ず真偽どちらかになる
 * (not() で包んでも NULL にならない)。値はバインド変数で渡す。
 */
export function excludedEmailCondition(
  email: SQLWrapper,
  exclusions: LeaderboardExclusions = getLeaderboardExclusions(),
): SQL {
  const normalized = sql`lower(trim(coalesce(${email}, '')))`
  const suffixConditions = exclusions.suffixes.map((suffix) => sql`${normalized} like ${`%${suffix}`}`)
  const emailConditions = exclusions.emails.length > 0
    ? [sql`${normalized} in (${sql.join(exclusions.emails.map((value) => sql`${value}`), sql`, `)})`]
    : []
  const conditions = [...suffixConditions, ...emailConditions]
  return conditions.length > 0 ? sql`(${sql.join(conditions, sql` or `)})` : sql`(0)`
}

export interface ExcludedEmailSqlOptions {
  /** true のとき LEADERBOARD_EXCLUDED_EMAILS 由来のメールを伏せ字にする(画面に出す SQL 用) */
  readonly redactConfiguredEmails?: boolean
}

/** 運用スクリプト用: excludedEmailCondition と同じ条件を SQL 文字列で返す */
export function excludedEmailSql(
  column: string,
  exclusions: LeaderboardExclusions = getLeaderboardExclusions(),
  options: ExcludedEmailSqlOptions = {},
): string {
  if (!SQL_COLUMN_PATTERN.test(column)) throw new RangeError('Invalid SQL column reference')
  const normalized = `lower(trim(coalesce(${column}, '')))`
  const suffixConditions = exclusions.suffixes.map((suffix) => `${normalized} LIKE ${sqlLiteral(`%${suffix}`)}`)
  const values = exclusions.emails.map((email, index) => (options.redactConfiguredEmails
    ? sqlLiteral(`<${LEADERBOARD_EXCLUDED_EMAILS_ENV} ${index + 1}>`)
    : sqlLiteral(email)))
  const emailConditions = values.length > 0 ? [`${normalized} IN (${values.join(', ')})`] : []
  const conditions = [...suffixConditions, ...emailConditions]
  return conditions.length > 0 ? `(${conditions.join(' OR ')})` : '(0)'
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}
