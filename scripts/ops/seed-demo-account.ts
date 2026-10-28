/**
 * デモアカウントに見本のデータを入れる（何度流しても同じ状態になる SQL）。既定はドライラン（SQL を表示するだけ）。
 *
 * 入れるもの（東京駅・丸の内のあたり）:
 *   - 通学路 2 本（「サンプル：まるのうち小への通学路」など。説明は「【デモ用サンプル】」で始まる）
 *   - 危険箇所の報告 3 件（タイトルは「【サンプル】…」）。絶対に公開しないよう
 *       status = 'pending'（非公開）・ai_moderation_status = 'needs_review'・
 *       ai_moderation_reason = 「デモ用サンプル（公開しません）」で入れる。
 *     5分ごとの審査スイープ（lib/danger-report-moderation-d1.ts の listForSweep）は
 *     「status = 'pending' かつ ai_moderation_status が NULL か 'pending'」の報告しか拾わないので、自動公開されない。
 *     reward_points は NULL（承認されてもポイントが付かず、消してもポイントが減らない）。
 *     管理画面の審査キュー（/admin/reports）には出さない（lib/admin-report-moderation-queue.ts）。
 *   - user_points を 120pt にする（ランキングには出ない。デモ・テストアカウントは除外される）
 *
 * 使い方（リポジトリのルートで実行。user id は Supabase Auth のデモユーザーの id）:
 *   npx tsx scripts/ops/seed-demo-account.ts --user-id=<uuid>
 *     → 流す SQL を表示するだけ（ネットワークに出ない）。
 *   本当に入れるときだけ、確認用の環境変数を付けて --apply:
 *     PowerShell: $env:CONFIRM_DEMO_SEED='yes'; npx tsx scripts/ops/seed-demo-account.ts --user-id=<uuid> --apply
 *     bash      : CONFIRM_DEMO_SEED=yes npx tsx scripts/ops/seed-demo-account.ts --user-id=<uuid> --apply
 *   --apply は `npx wrangler d1 execute pathguardian --remote --json --command "<SQL>"` と同じ方法で本番 D1 に流す。
 *
 * 安全策: SQL のどの文も「その user id の profiles 行があり、メールがデモ・テストアカウント
 *   （@example.com / @test.com / LEADERBOARD_EXCLUDED_EMAILS）のときだけ」書き込む。
 *   --apply では先にそれを確かめ、違えば何もせず止まる。profiles 行が無いときは、
 *   デモアカウントでログインしてプロフィール（表示名）を一度保存してから流し直す。
 *   user id は打ち込んだ値だけを使い、コードには書かない。id はユーザーごとに決まる UUID（v5）なので、
 *   流し直すと同じ行を上書きして見本の状態に戻る（見本の報告を公開状態にされていても非公開へ戻す）。
 */
import { createHash } from 'node:crypto'

import { DEMO_SAMPLE_MODERATION_REASON } from '../../lib/admin-report-moderation-queue'
import {
  excludedEmailSql,
  getLeaderboardExclusions,
  type LeaderboardExclusions,
} from '../../lib/leaderboard-exclusions'
import {
  DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX,
  describeExclusions,
  hasConfirmation,
  isDirectRun,
  joinStatements,
  NOW_SQL,
  parseCliArgs,
  readNumber,
  runCli,
  runD1,
  sqlInList,
  sqlNumber,
  sqlString,
  UsageError,
  type CliArgs,
  type OpsDeps,
} from './ops-shared'

export const DEMO_SEED_CONFIRM_ENV = 'CONFIRM_DEMO_SEED'
export const DEMO_POINTS = 120
const POINTS_PER_LEVEL = 500
/** デモの見本 id を作る UUID v5 の名前空間（固定の乱数 UUID。変えると見本の id が変わる） */
export const DEMO_SEED_NAMESPACE = '9c1f6a52-3d8e-4b7a-a1f0-5e2c7d94b6a3'
/** 子どもの歩く速さの目安（m/分）。通学路の所要時間の見本に使う */
const CHILD_WALKING_METERS_PER_MINUTE = 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LngLat = readonly [number, number]

export interface DemoRouteSample {
  readonly name: string
  readonly description: string
  readonly startAddress: string
  readonly endAddress: string
  readonly path: readonly LngLat[]
  readonly isFavorite: boolean
}

export interface DemoReportSample {
  readonly title: string
  readonly description: string
  readonly dangerType: 'traffic' | 'other'
  readonly dangerLevel: number
  readonly at: LngLat
  readonly town: string
}

// [経度, 緯度]（GeoJSON の並び）。東京駅 丸の内中央口 → 行幸通り → 丸の内仲通り → 大手町のあたり
const STATION: LngLat = [139.7649, 35.68124]
const GYOKO_NAKA: LngLat = [139.76345, 35.6816]
const NAKA_MIDDLE: LngLat = [139.76332, 35.68]
const SCHOOL: LngLat = [139.7633, 35.6784]
const OTEMACHI_SIDE: LngLat = [139.76375, 35.6842]
const OTEMACHI: LngLat = [139.7637, 35.6856]
const SCHOOL_ADDRESS = 'まるのうち小（サンプルの学校・東京都千代田区丸の内2丁目）'

export const DEMO_ROUTE_SAMPLES: readonly DemoRouteSample[] = [
  {
    name: 'サンプル：まるのうち小への通学路',
    description: `${DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX}東京駅の丸の内側から、仲通りを歩いて学校へ向かう道です（実際の通学路ではありません）。`,
    startAddress: '東京駅 丸の内中央口ふきん（東京都千代田区丸の内1丁目）',
    endAddress: SCHOOL_ADDRESS,
    path: [STATION, GYOKO_NAKA, NAKA_MIDDLE, SCHOOL],
    isFavorite: true,
  },
  {
    name: 'サンプル：ならいごとへの道',
    description: `${DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX}学校から大手町の方へ、ならいごとに向かう道です（実際の通学路ではありません）。`,
    startAddress: SCHOOL_ADDRESS,
    endAddress: '大手町ふきん（東京都千代田区大手町1丁目）',
    path: [SCHOOL, NAKA_MIDDLE, GYOKO_NAKA, OTEMACHI_SIDE, OTEMACHI],
    isFavorite: false,
  },
]

export const DEMO_REPORT_SAMPLES: readonly DemoReportSample[] = [
  {
    title: '【サンプル】見通しの悪い交差点',
    description: 'デモ用のサンプルです（実際の報告ではありません）。建物のかげで、右から来る車が見えにくい交差点です。',
    dangerType: 'traffic',
    dangerLevel: 3,
    at: GYOKO_NAKA,
    town: '丸の内1丁目',
  },
  {
    title: '【サンプル】歩道がせまく自転車が多い道',
    description: 'デモ用のサンプルです（実際の報告ではありません）。朝は自転車が多く、歩道がせまく感じます。',
    dangerType: 'traffic',
    dangerLevel: 2,
    at: NAKA_MIDDLE,
    town: '丸の内2丁目',
  },
  {
    title: '【サンプル】夕方に暗くなる通り',
    description: 'デモ用のサンプルです（実際の報告ではありません）。夕方は人通りが少なく、少し暗く感じます。',
    dangerType: 'other',
    dangerLevel: 2,
    at: OTEMACHI_SIDE,
    town: '大手町1丁目',
  },
]

/** RFC 4122 の UUID v5（SHA-1・名前ベース）。同じ名前からは必ず同じ id になる */
export function uuidV5(name: string, namespace: string = DEMO_SEED_NAMESPACE): string {
  if (!UUID_PATTERN.test(namespace)) throw new RangeError('namespace must be a UUID')
  const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex')
  const hash = createHash('sha1').update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')])).digest()
  const bytes = Uint8Array.from(hash.subarray(0, 16), (byte, index) => {
    if (index === 6) return (byte & 0x0f) | 0x50
    if (index === 8) return (byte & 0x3f) | 0x80
    return byte
  })
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function assertDemoUserId(userId: string): string {
  const trimmed = userId.trim()
  if (!UUID_PATTERN.test(trimmed)) throw new UsageError('--user-id は Supabase Auth のユーザー id（UUID）を指定してください')
  return trimmed.toLowerCase()
}

export function demoSeedIds(userId: string): { readonly routes: string[]; readonly reports: string[] } {
  const id = assertDemoUserId(userId)
  return {
    routes: DEMO_ROUTE_SAMPLES.map((_, index) => uuidV5(`pathguardian-demo:${id}:route:${index + 1}`)),
    reports: DEMO_REPORT_SAMPLES.map((_, index) => uuidV5(`pathguardian-demo:${id}:report:${index + 1}`)),
  }
}

/** 経路の長さ（m・10m 単位に丸める） */
export function pathLengthMeters(points: readonly LngLat[]): number {
  const radius = 6_371_008.8
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const meters = points.slice(1).reduce((total, [lng, lat], index) => {
    const [previousLng, previousLat] = points[index]
    const dLat = toRadians(lat - previousLat)
    const dLng = toRadians(lng - previousLng)
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRadians(previousLat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2
    return total + 2 * radius * Math.asin(Math.sqrt(a))
  }, 0)
  return Math.round(meters / 10) * 10
}

interface UpsertInput {
  readonly table: string
  readonly values: ReadonlyArray<readonly [column: string, value: string]>
  readonly guard: string
  readonly conflictTarget: string
  readonly updates: readonly string[]
  readonly updateWhere?: string
}

/** INSERT ... SELECT ... WHERE <guard> ON CONFLICT DO UPDATE（guard が偽なら挿入も更新もしない） */
function upsert(input: UpsertInput): string {
  return [
    `INSERT INTO ${input.table} (${input.values.map(([column]) => column).join(', ')})`,
    `SELECT ${input.values.map(([, value]) => value).join(', ')}`,
    `WHERE ${input.guard}`,
    `ON CONFLICT(${input.conflictTarget}) DO UPDATE SET ${input.updates.join(', ')}`
      + (input.updateWhere ? `\n  WHERE ${input.updateWhere}` : ''),
  ].join('\n')
}

const fromExcluded = (columns: readonly string[]) => columns.map((column) => `${column} = excluded.${column}`)

function routeStatement(sample: DemoRouteSample, id: string, userId: string, guard: string): string {
  const [start, end] = [sample.path[0], sample.path[sample.path.length - 1]]
  const distance = pathLengthMeters(sample.path)
  const geometry = JSON.stringify({ type: 'LineString', coordinates: sample.path })
  return upsert({
    table: 'user_routes',
    values: [
      ['id', sqlString(id)],
      ['user_id', sqlString(userId)],
      ['name', sqlString(sample.name)],
      ['description', sqlString(sample.description)],
      ['child_id', 'NULL'],
      ['child_name', 'NULL'],
      ['start_address', sqlString(sample.startAddress)],
      ['start_lat', sqlNumber(start[1])],
      ['start_lng', sqlNumber(start[0])],
      ['end_address', sqlString(sample.endAddress)],
      ['end_lat', sqlNumber(end[1])],
      ['end_lng', sqlNumber(end[0])],
      ['distance_meters', sqlNumber(distance)],
      ['estimated_time_minutes', sqlNumber(Math.ceil(distance / CHILD_WALKING_METERS_PER_MINUTE))],
      ['route_geometry', sqlString(geometry)],
      ['is_favorite', sample.isFavorite ? '1' : '0'],
    ],
    guard,
    conflictTarget: 'id',
    updates: [
      ...fromExcluded(['name', 'description', 'child_id', 'child_name', 'start_address', 'start_lat', 'start_lng',
        'end_address', 'end_lat', 'end_lng', 'distance_meters', 'estimated_time_minutes', 'route_geometry', 'is_favorite']),
      `updated_at = ${NOW_SQL}`,
    ],
    updateWhere: 'user_routes.user_id = excluded.user_id',
  })
}

function reportStatement(sample: DemoReportSample, id: string, userId: string, guard: string): string {
  return upsert({
    table: 'danger_reports',
    values: [
      ['id', sqlString(id)],
      ['user_id', sqlString(userId)],
      ['title', sqlString(sample.title)],
      ['description', sqlString(sample.description)],
      ['danger_type', sqlString(sample.dangerType)],
      ['danger_level', sqlNumber(sample.dangerLevel)],
      ['latitude', sqlNumber(sample.at[1])],
      ['longitude', sqlNumber(sample.at[0])],
      ['status', "'pending'"],
      ['reward_points', 'NULL'],
      ['prefecture', sqlString('東京都')],
      ['prefecture_code', '13'],
      ['city', sqlString('千代田区')],
      ['municipality_code', sqlString('13101')],
      ['town', sqlString(sample.town)],
      ['geocode_source', "'manual'"],
      ['ai_moderation_status', "'needs_review'"],
      ['ai_moderation_reason', sqlString(DEMO_SAMPLE_MODERATION_REASON)],
      ['ai_moderation_score', 'NULL'],
      ['ai_moderation_checked_at', NOW_SQL],
    ],
    guard,
    conflictTarget: 'id',
    // 公開状態・審査状態も見本の値に戻す（誰かが承認していても非公開へ戻す）。画像の列は触らない。
    updates: [
      ...fromExcluded(['title', 'description', 'danger_type', 'danger_level', 'latitude', 'longitude', 'status',
        'prefecture', 'prefecture_code', 'city', 'municipality_code', 'town', 'geocode_source',
        'ai_moderation_status', 'ai_moderation_reason', 'ai_moderation_score', 'ai_moderation_checked_at']),
      'push_notified_at = NULL',
      `updated_at = ${NOW_SQL}`,
    ],
    updateWhere: 'danger_reports.user_id = excluded.user_id',
  })
}

function pointsStatement(userId: string, guard: string): string {
  return upsert({
    table: 'user_points',
    values: [
      ['user_id', sqlString(userId)],
      ['points', sqlNumber(DEMO_POINTS)],
      ['level', sqlNumber(Math.floor(DEMO_POINTS / POINTS_PER_LEVEL) + 1)],
      ['updated_at', NOW_SQL],
    ],
    guard,
    conflictTarget: 'user_id',
    updates: fromExcluded(['points', 'level', 'updated_at']),
  })
}

export interface DemoSeed {
  readonly userId: string
  readonly ids: { readonly routes: readonly string[]; readonly reports: readonly string[] }
  /** --apply の前に流す確認（profiles 行があるか・デモ/テストアカウントか） */
  readonly precheckSql: string
  /** 本番に流す文（LEADERBOARD_EXCLUDED_EMAILS の値を含みうるので表示しない）。最後の文は確認用 SELECT */
  readonly statements: readonly string[]
  readonly sql: string
  /** 表示用（LEADERBOARD_EXCLUDED_EMAILS の値を伏せ字にしたもの） */
  readonly displaySql: string
}

function seedStatements(userId: string, ids: DemoSeed['ids'], excluded: (column: string) => string) {
  const guard = `EXISTS (SELECT 1 FROM profiles p WHERE p.id = ${sqlString(userId)} AND ${excluded('p.email')})`
  const verify = [
    'SELECT',
    `  (SELECT count(*) FROM user_routes WHERE user_id = ${sqlString(userId)} AND id IN ${sqlInList(ids.routes)}) AS routes,`,
    `  (SELECT count(*) FROM danger_reports WHERE user_id = ${sqlString(userId)} AND id IN ${sqlInList(ids.reports)}`,
    "    AND status = 'pending' AND ai_moderation_status = 'needs_review') AS hidden_reports,",
    `  (SELECT points FROM user_points WHERE user_id = ${sqlString(userId)}) AS points`,
  ].join('\n')
  const precheck = [
    'SELECT',
    `  EXISTS (SELECT 1 FROM profiles p WHERE p.id = ${sqlString(userId)}) AS has_profile,`,
    `  ${guard} AS is_excluded_account`,
  ].join('\n')
  return {
    precheck,
    statements: [
      ...DEMO_ROUTE_SAMPLES.map((sample, index) => routeStatement(sample, ids.routes[index], userId, guard)),
      ...DEMO_REPORT_SAMPLES.map((sample, index) => reportStatement(sample, ids.reports[index], userId, guard)),
      pointsStatement(userId, guard),
      verify,
    ],
  }
}

/** デモの見本を入れる SQL を作る（ネットワークには出ない） */
export function buildDemoSeed(userIdInput: string, exclusions: LeaderboardExclusions): DemoSeed {
  const userId = assertDemoUserId(userIdInput)
  const ids = demoSeedIds(userId)
  const real = seedStatements(userId, ids, (column) => excludedEmailSql(column, exclusions))
  const display = seedStatements(userId, ids, (column) => excludedEmailSql(column, exclusions, { redactConfiguredEmails: true }))
  return {
    userId,
    ids,
    precheckSql: joinStatements([real.precheck]),
    statements: real.statements,
    sql: joinStatements(real.statements),
    displaySql: joinStatements(display.statements),
  }
}

const USAGE = [
  '使い方: npx tsx scripts/ops/seed-demo-account.ts --user-id=<uuid> [--apply]',
  `  既定は SQL の表示だけ。本番に流すときは ${DEMO_SEED_CONFIRM_ENV}=yes と --apply の両方が必要です。`,
]

export async function main(argv: readonly string[], deps: OpsDeps): Promise<number> {
  let args: CliArgs
  let seed: DemoSeed
  const exclusions = getLeaderboardExclusions(deps.env)
  try {
    args = parseCliArgs(argv, { flags: ['apply', 'help'], values: ['user-id'] })
    if (args.flags.has('help')) {
      USAGE.forEach((line) => deps.log(line))
      return 0
    }
    const userId = args.values.get('user-id')
    if (!userId) throw new UsageError('--user-id=<uuid> を指定してください（コードには書きません）')
    seed = buildDemoSeed(userId, exclusions)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    deps.error(error.message)
    USAGE.forEach((line) => deps.error(line))
    return 1
  }

  deps.log(`[seed-demo-account] 対象 user_id=${seed.userId}`)
  deps.log(`書き込むのは、このアカウントが除外アカウント ${describeExclusions(exclusions)} に当たるときだけです。`)
  deps.log(`通学路 ${seed.ids.routes.length} 本: ${seed.ids.routes.join(', ')}`)
  deps.log(`報告 ${seed.ids.reports.length} 件（非公開・審査スイープ対象外）: ${seed.ids.reports.join(', ')}`)
  deps.log(`ポイント: ${DEMO_POINTS}pt`)
  if (!args.flags.has('apply')) {
    deps.log('[seed-demo-account] ドライラン: 次の SQL を表示するだけです（本番には接続しません）')
    deps.log(seed.displaySql)
    deps.log(`本番に入れるときは ${DEMO_SEED_CONFIRM_ENV}=yes を付けて --apply で実行してください。`)
    return 0
  }
  if (!hasConfirmation(deps.env, DEMO_SEED_CONFIRM_ENV)) {
    deps.error(`--apply には ${DEMO_SEED_CONFIRM_ENV}=yes が必要です。何も書き込んでいません。`)
    return 1
  }

  deps.log('[seed-demo-account] --apply: まず対象のアカウントを確かめます')
  const [precheck] = await runD1(deps.runner, seed.precheckSql, exclusions.emails)
  const row = precheck?.results[0] ?? {}
  if (readNumber(row, 'has_profile') !== 1) {
    deps.error('この user id の profiles 行がありません。デモアカウントでログインしてプロフィール（表示名）を一度保存してから、もう一度実行してください。何も書き込んでいません。')
    return 1
  }
  if (readNumber(row, 'is_excluded_account') !== 1) {
    deps.error('この user id はデモ・テストアカウント（ランキング除外）ではありません。実ユーザーには見本を入れません。何も書き込んでいません。')
    return 1
  }

  const results = await runD1(deps.runner, seed.sql, exclusions.emails)
  const verify = results[results.length - 1]?.results[0] ?? {}
  const routes = readNumber(verify, 'routes') ?? 0
  const hiddenReports = readNumber(verify, 'hidden_reports') ?? 0
  const points = readNumber(verify, 'points')
  deps.log(`入れた結果: 通学路 ${routes} 本 / 非公開の見本報告 ${hiddenReports} 件 / ポイント ${points ?? '-'}pt`)
  if (routes !== seed.ids.routes.length || hiddenReports !== seed.ids.reports.length || points !== DEMO_POINTS) {
    deps.error('見本の件数が想定と違います。もう一度実行するか、D1 の中身を確認してください。')
    return 1
  }
  return 0
}

if (isDirectRun('seed-demo-account')) runCli('seed-demo-account', main)
