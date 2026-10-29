/**
 * 本番 D1 からテストデータの候補を探す（読み取り専用・SELECT だけ）。
 *
 * 使い方（リポジトリのルートで実行）:
 *   npx tsx scripts/ops/find-test-data.ts
 *     → 実行する SELECT 文を表示するだけ。ネットワークには出ない（既定）。
 *   npx tsx scripts/ops/find-test-data.ts --remote
 *     → `npx wrangler d1 execute pathguardian --remote --json --command "<SQL>"` と同じ方法で
 *       本番 D1 に SELECT だけを流し、候補を表示する。
 *   npx tsx scripts/ops/find-test-data.ts --remote --out=test-data-candidates.json
 *     → 候補を JSON に保存する（同名のファイルがあれば上書きせず止まる）。
 *       中身を確認し、消さない行を削ってから scripts/ops/cleanup-test-data.ts の --input に渡す。
 *   --include-demo-samples
 *     → scripts/ops/seed-demo-account.ts が入れたデモ用サンプルも候補に含める（既定は外す）。
 *
 * 探すもの:
 *   - タイトルに「テスト」「UIテスト」「削除可」「[UXテスト]」「サンプル」を含む危険箇所の報告（danger_reports）
 *   - 名前に「テスト通学路」「kanoha」を含む通学路（user_routes）
 *   - デモ・テストアカウント（@example.com / @test.com / 環境変数 LEADERBOARD_EXCLUDED_EMAILS）が持つ報告・通学路
 *   - 参考: デモ・テストアカウントの user_id 一覧（seed-demo-account.ts の --user-id を探すのに使う）と、
 *     profiles 行が無いためランキングから外せるか判定できないユーザーの人数
 *
 * 出すもの: id・短いタイトル（40文字まで）・created_at・user_id など。メールアドレスは出さない。
 * LEADERBOARD_EXCLUDED_EMAILS の値は、表示する SQL の中でも伏せ字にする。
 */
import { DEMO_SAMPLE_MODERATION_REASON } from '../../lib/admin-report-moderation-queue'
import {
  excludedEmailSql,
  getLeaderboardExclusions,
  LEADERBOARD_EXCLUDED_EMAILS_ENV,
  type LeaderboardExclusions,
} from '../../lib/leaderboard-exclusions'
import {
  DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX,
  describeExclusions,
  describeWranglerArgs,
  d1ExecuteArgs,
  isDirectRun,
  joinStatements,
  parseCliArgs,
  readJsonStringArray,
  readNumber,
  readString,
  resolveInCwd,
  runCli,
  runD1,
  shortText,
  sqlString,
  UsageError,
  type CliArgs,
  type D1StatementResult,
  type OpsDeps,
} from './ops-shared'

export const TEST_REPORT_TITLE_PATTERNS: readonly string[] = ['テスト', 'UIテスト', '削除可', '[UXテスト]', 'サンプル']
export const TEST_ROUTE_NAME_PATTERNS: readonly string[] = ['テスト通学路', 'kanoha']
export const FIND_ROW_LIMIT = 500
export const TITLE_DISPLAY_LENGTH = 40
/** SQL では 1 文字多く取り、表示で切ったときに「…」が付くようにする */
const TITLE_FETCH_LENGTH = TITLE_DISPLAY_LENGTH + 1

export type TestDataQueryName =
  | 'excluded_accounts'
  | 'reports_by_title'
  | 'reports_by_owner'
  | 'routes_by_name'
  | 'routes_by_owner'
  | 'leaderboard_users_without_profile'

export interface TestDataQuery {
  readonly name: TestDataQueryName
  readonly label: string
  /** 本番に流す SQL（LEADERBOARD_EXCLUDED_EMAILS の値を含みうるので表示しない） */
  readonly sql: string
  /** 表示用の SQL（LEADERBOARD_EXCLUDED_EMAILS の値を伏せ字にしたもの） */
  readonly displaySql: string
}

export interface FindTestDataOptions {
  readonly includeDemoSamples?: boolean
}

type SqlVariant = (column: string) => string

/** 大文字小文字を区別せず（ASCII のみ）部分一致する条件 */
function containsAny(column: string, patterns: readonly string[]): string {
  return `(${patterns.map((pattern) => `instr(lower(${column}), ${sqlString(pattern.toLowerCase())}) > 0`).join(' OR ')})`
}

function excludedOwnerSql(userIdColumn: string, excluded: SqlVariant): string {
  return `${userIdColumn} IN (SELECT p.id FROM profiles p WHERE ${excluded('p.email')})`
}

function reportSelect(): string {
  return [
    `SELECT r.id, substr(r.title, 1, ${TITLE_FETCH_LENGTH}) AS title, r.created_at, r.user_id, r.status, r.reward_points,`,
    '  r.image_key, r.processed_image_key, r.processed_image_keys,',
    '  (SELECT json_group_array(ri.image_key) FROM report_images ri WHERE ri.report_id = r.id) AS extra_image_keys',
    'FROM danger_reports r',
  ].join('\n')
}

function routeSelect(): string {
  return [
    `SELECT u.id, substr(u.name, 1, ${TITLE_FETCH_LENGTH}) AS name, u.created_at, u.user_id`,
    'FROM user_routes u',
  ].join('\n')
}

function buildQueries(excluded: SqlVariant, suffixes: readonly string[], options: FindTestDataOptions) {
  const notDemoReport = options.includeDemoSamples
    ? []
    : [`NOT (coalesce(r.ai_moderation_reason, '') = ${sqlString(DEMO_SAMPLE_MODERATION_REASON)} AND ${excludedOwnerSql('r.user_id', excluded)})`]
  const notDemoRoute = options.includeDemoSamples
    ? []
    : [`NOT (instr(coalesce(u.description, ''), ${sqlString(DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX)}) = 1 AND ${excludedOwnerSql('u.user_id', excluded)})`]
  const where = (conditions: readonly string[]) => `WHERE ${conditions.join('\n  AND ')}`
  const ruleCase = [
    'CASE',
    ...suffixes.map((suffix) => `    WHEN lower(trim(coalesce(p.email, ''))) LIKE ${sqlString(`%${suffix}`)} THEN ${sqlString(suffix)}`),
    `    ELSE ${sqlString(LEADERBOARD_EXCLUDED_EMAILS_ENV)}`,
    '  END AS matched_rule',
  ].join('\n')
  const queries: Array<{ name: TestDataQueryName; label: string; sql: string }> = [
    {
      name: 'excluded_accounts',
      label: 'デモ・テストアカウント（ランキング除外）',
      sql: [
        `SELECT p.id AS user_id, p.created_at, ${ruleCase},`,
        '  coalesce(up.points, 0) AS points,',
        '  (SELECT count(*) FROM danger_reports r WHERE r.user_id = p.id) AS reports,',
        '  (SELECT count(*) FROM user_routes u WHERE u.user_id = p.id) AS routes',
        'FROM profiles p LEFT JOIN user_points up ON up.user_id = p.id',
        where([excluded('p.email')]),
        `ORDER BY p.created_at LIMIT ${FIND_ROW_LIMIT}`,
      ].join('\n'),
    },
    {
      name: 'reports_by_title',
      label: '報告（タイトル一致）',
      sql: [reportSelect(), where([containsAny('r.title', TEST_REPORT_TITLE_PATTERNS), ...notDemoReport]), `ORDER BY r.created_at DESC LIMIT ${FIND_ROW_LIMIT}`].join('\n'),
    },
    {
      name: 'reports_by_owner',
      label: '報告（デモ・テストアカウントの投稿）',
      sql: [reportSelect(), where([excludedOwnerSql('r.user_id', excluded), ...notDemoReport]), `ORDER BY r.created_at DESC LIMIT ${FIND_ROW_LIMIT}`].join('\n'),
    },
    {
      name: 'routes_by_name',
      label: '通学路（名前一致）',
      sql: [routeSelect(), where([containsAny('u.name', TEST_ROUTE_NAME_PATTERNS), ...notDemoRoute]), `ORDER BY u.created_at DESC LIMIT ${FIND_ROW_LIMIT}`].join('\n'),
    },
    {
      name: 'routes_by_owner',
      label: '通学路（デモ・テストアカウントの登録）',
      sql: [routeSelect(), where([excludedOwnerSql('u.user_id', excluded), ...notDemoRoute]), `ORDER BY u.created_at DESC LIMIT ${FIND_ROW_LIMIT}`].join('\n'),
    },
    {
      name: 'leaderboard_users_without_profile',
      label: 'profiles 行が無くランキング除外を判定できないユーザー',
      sql: 'SELECT count(*) AS users FROM user_points up LEFT JOIN profiles p ON p.id = up.user_id WHERE p.id IS NULL',
    },
  ]
  return queries
}

/** 読み取り専用の SELECT 文を組み立てる（ネットワークには出ない） */
export function buildFindTestDataQueries(
  exclusions: LeaderboardExclusions,
  options: FindTestDataOptions = {},
): TestDataQuery[] {
  const real = buildQueries((column) => excludedEmailSql(column, exclusions), exclusions.suffixes, options)
  const display = buildQueries(
    (column) => excludedEmailSql(column, exclusions, { redactConfiguredEmails: true }),
    exclusions.suffixes,
    options,
  )
  return real.map((query, index) => ({ ...query, displaySql: display[index].sql }))
}

export interface ReportCandidate {
  readonly id: string
  readonly title: string
  readonly created_at: string | null
  readonly user_id: string | null
  readonly status: string | null
  readonly reward_points: number | null
  readonly matched_by: ReadonlyArray<'title' | 'owner'>
  readonly image_keys: readonly string[]
}

export interface RouteCandidate {
  readonly id: string
  readonly name: string
  readonly created_at: string | null
  readonly user_id: string | null
  readonly matched_by: ReadonlyArray<'name' | 'owner'>
}

export interface ExcludedAccount {
  readonly user_id: string
  readonly created_at: string | null
  readonly matched_rule: string | null
  readonly points: number
  readonly reports: number
  readonly routes: number
}

export interface TestDataCandidates {
  readonly kind: 'pathguardian-test-data-candidates'
  readonly version: 1
  readonly generatedAt: string
  readonly reports: readonly ReportCandidate[]
  readonly routes: readonly RouteCandidate[]
  readonly excludedAccounts: readonly ExcludedAccount[]
  readonly leaderboardUsersWithoutProfile: number
  /** FIND_ROW_LIMIT 件に達して打ち切った問い合わせ */
  readonly truncated: readonly TestDataQueryName[]
}

type Row = Readonly<Record<string, unknown>>

function reportImageKeys(row: Row): string[] {
  const keys = [
    readString(row, 'image_key'),
    readString(row, 'processed_image_key'),
    ...readJsonStringArray(row.processed_image_keys),
    ...readJsonStringArray(row.extra_image_keys),
  ].filter((key): key is string => Boolean(key))
  return keys.filter((key, index) => keys.indexOf(key) === index)
}

function toReport(row: Row, matchedBy: 'title' | 'owner'): ReportCandidate | null {
  const id = readString(row, 'id')
  if (!id) return null
  return {
    id,
    title: shortText(row.title, TITLE_DISPLAY_LENGTH),
    created_at: readString(row, 'created_at'),
    user_id: readString(row, 'user_id'),
    status: readString(row, 'status'),
    reward_points: readNumber(row, 'reward_points'),
    matched_by: [matchedBy],
    image_keys: reportImageKeys(row),
  }
}

function toRoute(row: Row, matchedBy: 'name' | 'owner'): RouteCandidate | null {
  const id = readString(row, 'id')
  if (!id) return null
  return {
    id,
    name: shortText(row.name, TITLE_DISPLAY_LENGTH),
    created_at: readString(row, 'created_at'),
    user_id: readString(row, 'user_id'),
    matched_by: [matchedBy],
  }
}

function mergeById<T extends { readonly id: string; readonly matched_by: ReadonlyArray<string> }>(items: readonly T[]): T[] {
  return items.reduce<T[]>((merged, item) => {
    const existing = merged.find((candidate) => candidate.id === item.id)
    if (!existing) return [...merged, item]
    const matchedBy = [...new Set([...existing.matched_by, ...item.matched_by])]
    return merged.map((candidate) => (candidate.id === item.id ? { ...candidate, matched_by: matchedBy } : candidate))
  }, [])
}

/** wrangler の結果（文ごと）を候補一覧にまとめる。メールの列は読まない */
export function collectTestDataCandidates(
  queries: readonly TestDataQuery[],
  results: readonly D1StatementResult[],
  now: Date,
): TestDataCandidates {
  if (results.length !== queries.length) {
    throw new Error(`結果の数（${results.length}）が問い合わせの数（${queries.length}）と合いません`)
  }
  const rowsOf = (name: TestDataQueryName): readonly Row[] => results[queries.findIndex((query) => query.name === name)]?.results ?? []
  const reports = mergeById([
    ...rowsOf('reports_by_title').map((row) => toReport(row, 'title')),
    ...rowsOf('reports_by_owner').map((row) => toReport(row, 'owner')),
  ].filter((item): item is ReportCandidate => item !== null))
  const routes = mergeById([
    ...rowsOf('routes_by_name').map((row) => toRoute(row, 'name')),
    ...rowsOf('routes_by_owner').map((row) => toRoute(row, 'owner')),
  ].filter((item): item is RouteCandidate => item !== null))
  const excludedAccounts = rowsOf('excluded_accounts').flatMap((row) => {
    const userId = readString(row, 'user_id')
    if (!userId) return []
    return [{
      user_id: userId,
      created_at: readString(row, 'created_at'),
      matched_rule: readString(row, 'matched_rule'),
      points: readNumber(row, 'points') ?? 0,
      reports: readNumber(row, 'reports') ?? 0,
      routes: readNumber(row, 'routes') ?? 0,
    }]
  })
  const truncated = queries
    .filter((query, index) => query.name !== 'leaderboard_users_without_profile' && results[index].results.length >= FIND_ROW_LIMIT)
    .map((query) => query.name)
  return {
    kind: 'pathguardian-test-data-candidates',
    version: 1,
    generatedAt: now.toISOString(),
    reports,
    routes,
    excludedAccounts,
    leaderboardUsersWithoutProfile: readNumber(rowsOf('leaderboard_users_without_profile')[0] ?? {}, 'users') ?? 0,
    truncated,
  }
}

export function formatCandidateSummary(candidates: TestDataCandidates): string[] {
  const lines = [
    `デモ・テストアカウント: ${candidates.excludedAccounts.length} 件`,
    ...candidates.excludedAccounts.map((account) => `  - ${account.user_id}  ${account.matched_rule ?? '-'}  ${account.points}pt  報告${account.reports}件  通学路${account.routes}件  作成 ${account.created_at ?? '-'}`),
    `報告の候補: ${candidates.reports.length} 件`,
    ...candidates.reports.map((report) => `  - ${report.id}  ${report.created_at ?? '-'}  user=${report.user_id ?? '-'}  [${report.matched_by.join(',')}]  ${report.status ?? '-'}  画像${report.image_keys.length}枚  ${report.title}`),
    `通学路の候補: ${candidates.routes.length} 件`,
    ...candidates.routes.map((route) => `  - ${route.id}  ${route.created_at ?? '-'}  user=${route.user_id ?? '-'}  [${route.matched_by.join(',')}]  ${route.name}`),
    `profiles 行が無くランキング除外を判定できないユーザー: ${candidates.leaderboardUsersWithoutProfile} 人`,
  ]
  return candidates.truncated.length > 0
    ? [...lines, `注意: ${candidates.truncated.join(', ')} は ${FIND_ROW_LIMIT} 件で打ち切りました。片付けてからもう一度実行してください。`]
    : lines
}

const USAGE = [
  '使い方: npx tsx scripts/ops/find-test-data.ts [--remote] [--out=<file.json>] [--include-demo-samples]',
  '  既定は SELECT 文の表示だけ（ネットワークに出ない）。--remote で本番 D1 に SELECT だけを流す。',
]

export async function main(argv: readonly string[], deps: OpsDeps): Promise<number> {
  let args: CliArgs
  try {
    args = parseCliArgs(argv, { flags: ['remote', 'include-demo-samples', 'help'], values: ['out'] })
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    deps.error(error.message)
    USAGE.forEach((line) => deps.error(line))
    return 1
  }
  if (args.flags.has('help')) {
    USAGE.forEach((line) => deps.log(line))
    return 0
  }
  const out = args.values.get('out')
  if (out && !args.flags.has('remote')) {
    deps.error('--out は --remote と一緒に使ってください')
    return 1
  }
  const outPath = out ? resolveInCwd(deps.cwd, out) : null
  if (outPath && deps.fileExists(outPath)) {
    deps.error(`${out} は既にあります。上書きしないので、別のファイル名を指定してください`)
    return 1
  }

  const exclusions = getLeaderboardExclusions(deps.env)
  const queries = buildFindTestDataQueries(exclusions, { includeDemoSamples: args.flags.has('include-demo-samples') })
  deps.log(`[find-test-data] 除外アカウント: ${describeExclusions(exclusions)}`)

  if (!args.flags.has('remote')) {
    deps.log('[find-test-data] ドライラン: 次の SELECT 文を表示するだけです（本番には接続しません）')
    queries.forEach((query) => {
      deps.log('')
      deps.log(`-- ${query.label}`)
      deps.log(`${query.displaySql};`)
    })
    deps.log('')
    deps.log(`本番で調べるには --remote を付けて実行します（${describeWranglerArgs(d1ExecuteArgs('<SQL>'))}）`)
    return 0
  }

  deps.log('[find-test-data] 本番 D1 に SELECT だけを流します（書き込み・削除はしません）')
  const results = await runD1(deps.runner, joinStatements(queries.map((query) => query.sql)), exclusions.emails)
  const candidates = collectTestDataCandidates(queries, results, deps.now())
  formatCandidateSummary(candidates).forEach((line) => deps.log(line))
  if (outPath) {
    deps.writeTextFile(outPath, `${JSON.stringify(candidates, null, 2)}\n`)
    deps.log(`候補を ${out} に保存しました。消さない行を削ってから cleanup-test-data.ts の --input に渡してください。`)
  }
  return 0
}

if (isDirectRun('find-test-data')) runCli('find-test-data', main)
