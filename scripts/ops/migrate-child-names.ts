/**
 * 通学路の「子どもの名前」を、呼び名として children 表へ移す(UIUX改装 項目56)。既定はドライラン(件数を数えるだけ)。
 *
 * - user_routes.child_name(と、以前の「child-名前」形式の child_id)から呼び名を作り、
 *   人ごとに children の行を作る(呼び名は20文字まで。確認はまだ = nickname_confirmed_at は NULL)。
 *   保護者には設定画面で「本名になっていないか」を一度だけ確かめてもらう
 * - 通学路には children の id だけを入れ、child_name は空にする
 * - route_learning_sessions は、その通学路の新しい child_id に揃え、child_name を空にする
 * - 1人10人までの上限を超える分は、子どもの指定を外す(通学路は残す)
 *
 * 使い方(リポジトリのルートで実行):
 *   npx tsx scripts/ops/migrate-child-names.ts
 *     → 移す件数だけを表示する(本番 D1 を読むだけで書き換えない)。
 *   本当に移すときだけ、確認用の環境変数を付けて --apply:
 *     PowerShell: $env:CONFIRM_CHILD_NAME_MIGRATION='yes'; npx tsx scripts/ops/migrate-child-names.ts --apply
 *     bash      : CONFIRM_CHILD_NAME_MIGRATION=yes npx tsx scripts/ops/migrate-child-names.ts --apply
 *   --apply の最後に数え直し、名前が残っていれば終了コード 1 で止まる。流し直すと残りだけを移す。
 *
 * 出力は件数だけ。名前・ユーザー id は表示しない。
 */
import { randomUUID } from 'node:crypto'

import { legacyChildNameToNickname, MAX_CHILDREN_PER_USER } from '../../lib/db/repos/children.repo'
import {
  hasConfirmation,
  isDirectRun,
  joinStatements,
  NOW_SQL,
  parseCliArgs,
  readNumber,
  readString,
  runCli,
  runD1,
  sqlString,
  UsageError,
  type CliArgs,
  type OpsDeps,
} from './ops-shared'

export const CHILD_MIGRATION_CONFIRM_ENV = 'CONFIRM_CHILD_NAME_MIGRATION'
/** 1回の wrangler 呼び出しに入れる文の数(コマンドラインの長さの上限に当たらないように) */
const STATEMENTS_PER_CALL = 40

const LEGACY_ROUTE_WHERE = "(child_name IS NOT NULL AND trim(child_name) <> '') OR child_id LIKE 'child-%'"
const LEGACY_SESSION_WHERE = "child_name IS NOT NULL OR child_id LIKE 'child-%'"

export const SELECT_LEGACY_ROUTES_SQL = `SELECT id, user_id, child_id, child_name FROM user_routes WHERE ${LEGACY_ROUTE_WHERE} ORDER BY user_id, created_at, id`
export const SELECT_EXISTING_CHILDREN_SQL = 'SELECT id, user_id, nickname FROM children ORDER BY user_id, created_at, id'
export const COUNT_REMAINING_SQL = [
  `SELECT COUNT(*) AS n FROM user_routes WHERE ${LEGACY_ROUTE_WHERE}`,
  `SELECT COUNT(*) AS n FROM route_learning_sessions WHERE ${LEGACY_SESSION_WHERE}`,
]
/** 通学路を移したあとに流す。学習の記録はその通学路の子どもに揃える */
export const RESYNC_SESSIONS_SQL = `UPDATE route_learning_sessions SET child_name = NULL, child_id = (SELECT r.child_id FROM user_routes r WHERE r.id = route_learning_sessions.route_id AND r.user_id = route_learning_sessions.user_id) WHERE ${LEGACY_SESSION_WHERE}`

export interface LegacyRoute {
  readonly id: string
  readonly userId: string
  readonly childId: string | null
  readonly childName: string | null
}

export interface ExistingChild {
  readonly id: string
  readonly userId: string
  readonly nickname: string
}

export interface MigrationPlan {
  readonly newChildren: ReadonlyArray<{ id: string; userId: string; nickname: string }>
  readonly routeUpdates: ReadonlyArray<{ routeId: string; userId: string; childId: string | null }>
  readonly droppedOverLimit: number
}

/** 以前の名前(child_name、無ければ「child-名前」の id)から呼び名を作る */
export function legacyNicknameOf(route: LegacyRoute): string {
  const fromName = route.childName ? legacyChildNameToNickname(route.childName) : ''
  if (fromName) return fromName
  return route.childId?.startsWith('child-') ? legacyChildNameToNickname(route.childId.slice('child-'.length)) : ''
}

/** 何を作り、どの通学路をどの子に結びつけるかを決める(書き込みはしない) */
export function planChildMigration(
  routes: readonly LegacyRoute[],
  existing: readonly ExistingChild[],
  newId: () => string = randomUUID,
): MigrationPlan {
  const byUser = new Map<string, Map<string, string>>()
  for (const child of existing) {
    const children = byUser.get(child.userId) ?? new Map<string, string>()
    children.set(child.nickname, child.id)
    byUser.set(child.userId, children)
  }
  const newChildren: Array<{ id: string; userId: string; nickname: string }> = []
  const routeUpdates: Array<{ routeId: string; userId: string; childId: string | null }> = []
  let droppedOverLimit = 0
  for (const route of routes) {
    const nickname = legacyNicknameOf(route)
    const children = byUser.get(route.userId) ?? new Map<string, string>()
    byUser.set(route.userId, children)
    let childId: string | null = nickname ? children.get(nickname) ?? null : null
    if (nickname && !childId) {
      if (children.size >= MAX_CHILDREN_PER_USER) {
        droppedOverLimit += 1
      } else {
        childId = newId()
        children.set(nickname, childId)
        newChildren.push({ id: childId, userId: route.userId, nickname })
      }
    }
    routeUpdates.push({ routeId: route.id, userId: route.userId, childId })
  }
  return { newChildren, routeUpdates, droppedOverLimit }
}

export function buildMigrationStatements(plan: MigrationPlan): string[] {
  return [
    ...plan.newChildren.map((child) => (
      `INSERT INTO children (id, user_id, nickname, nickname_confirmed_at, created_at, updated_at) VALUES (${sqlString(child.id)}, ${sqlString(child.userId)}, ${sqlString(child.nickname)}, NULL, ${NOW_SQL}, ${NOW_SQL}) ON CONFLICT(user_id, nickname) DO NOTHING`
    )),
    ...plan.routeUpdates.map((update) => {
      // 同じ人・同じ呼び名の行が先にあった(ON CONFLICT で作らなかった)ときも、その行を指すよう呼び名で引き直す
      const child = plan.newChildren.find((item) => item.id === update.childId)
      const childIdSql = update.childId === null
        ? 'NULL'
        : child
          ? `(SELECT id FROM children WHERE user_id = ${sqlString(child.userId)} AND nickname = ${sqlString(child.nickname)})`
          : sqlString(update.childId)
      return `UPDATE user_routes SET child_id = ${childIdSql}, child_name = NULL WHERE id = ${sqlString(update.routeId)} AND user_id = ${sqlString(update.userId)}`
    }),
  ]
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

async function readLegacy(deps: OpsDeps): Promise<{ routes: LegacyRoute[]; existing: ExistingChild[] }> {
  const [routesResult, childrenResult] = await runD1(deps.runner, joinStatements([SELECT_LEGACY_ROUTES_SQL, SELECT_EXISTING_CHILDREN_SQL]))
  const routes = (routesResult?.results ?? []).map((row) => ({
    id: readString(row, 'id') ?? '',
    userId: readString(row, 'user_id') ?? '',
    childId: readString(row, 'child_id'),
    childName: readString(row, 'child_name'),
  })).filter((route) => route.id && route.userId)
  const existing = (childrenResult?.results ?? []).map((row) => ({
    id: readString(row, 'id') ?? '',
    userId: readString(row, 'user_id') ?? '',
    nickname: readString(row, 'nickname') ?? '',
  })).filter((child) => child.id && child.userId && child.nickname)
  return { routes, existing }
}

async function countRemaining(deps: OpsDeps): Promise<{ routes: number; sessions: number }> {
  const [routes, sessions] = await runD1(deps.runner, joinStatements(COUNT_REMAINING_SQL))
  return {
    routes: readNumber(routes?.results[0] ?? {}, 'n') ?? 0,
    sessions: readNumber(sessions?.results[0] ?? {}, 'n') ?? 0,
  }
}

const USAGE = [
  '使い方: npx tsx scripts/ops/migrate-child-names.ts [--apply]',
  `  既定は件数の表示だけ。移すときは ${CHILD_MIGRATION_CONFIRM_ENV}=yes と --apply の両方が必要です。`,
]

export async function main(argv: readonly string[], deps: OpsDeps): Promise<number> {
  let args: CliArgs
  try {
    args = parseCliArgs(argv, { flags: ['apply', 'help'], values: [] })
    if (args.flags.has('help')) {
      USAGE.forEach((line) => deps.log(line))
      return 0
    }
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    deps.error(error.message)
    USAGE.forEach((line) => deps.error(line))
    return 1
  }

  deps.log('[migrate-child-names] 移す対象を数えます(名前・id は表示しません)')
  const { routes, existing } = await readLegacy(deps)
  const plan = planChildMigration(routes, existing)
  const before = await countRemaining(deps)
  const users = new Set(routes.map((route) => route.userId)).size
  deps.log(`名前が残っている通学路: ${routes.length} 件(${users} 人) / 学習の記録: ${before.sessions} 件`)
  deps.log(`作る呼び名: ${plan.newChildren.length} 件 / 上限(1人${MAX_CHILDREN_PER_USER}人)を超えて指定を外す通学路: ${plan.droppedOverLimit} 件`)

  if (!args.flags.has('apply')) {
    deps.log(`[migrate-child-names] ドライラン: 何も書き換えていません。移すときは ${CHILD_MIGRATION_CONFIRM_ENV}=yes を付けて --apply で実行してください。`)
    return 0
  }
  if (!hasConfirmation(deps.env, CHILD_MIGRATION_CONFIRM_ENV)) {
    deps.error(`--apply には ${CHILD_MIGRATION_CONFIRM_ENV}=yes が必要です。何も書き換えていません。`)
    return 1
  }

  const statements = buildMigrationStatements(plan)
  for (const statementsChunk of chunk(statements, STATEMENTS_PER_CALL)) {
    await runD1(deps.runner, joinStatements(statementsChunk))
  }
  await runD1(deps.runner, RESYNC_SESSIONS_SQL)

  const after = await countRemaining(deps)
  deps.log(`数え直し: 名前が残っている通学路 ${after.routes} 件 / 学習の記録 ${after.sessions} 件`)
  if (after.routes > 0 || after.sessions > 0) {
    deps.error('移し残りがあります。もう一度 --apply で実行してください(残っている分だけを移します)。')
    return 1
  }
  deps.log('[migrate-child-names] すべて移しました。保護者には設定画面で呼び名の確認を一度だけ案内します。')
  return 0
}

if (isDirectRun('migrate-child-names')) runCli('migrate-child-names', main)
