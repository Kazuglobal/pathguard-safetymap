/**
 * 保存済みの通学路を、新しい保存の決まり(UIUX改装 項目59・lib/route-privacy.ts)と同じ粗さにする。既定はドライラン(件数だけ)。
 *
 * - 道すじの両端をそれぞれ200m削る(すでに削ってある線 = trimmedEndsMeters が付いた線は触らない)。
 *   両端を削ると50mも残らない短い線や、壊れた線は保存をやめる(NULL)
 * - 起点・終点の座標を小数2桁(約1km)に丸める
 * - 住所を「都道府県+市区町村」だけにする(読み取れなければ「出発地」「到着地」)
 * 何度流しても同じ結果になる。
 *
 * 使い方(リポジトリのルートで実行):
 *   npx tsx scripts/ops/coarsen-existing-routes.ts
 *     → 変える件数だけを表示する(本番 D1 を読むだけで書き換えない)。
 *   本当に変えるときだけ、確認用の環境変数を付けて --apply:
 *     PowerShell: $env:CONFIRM_ROUTE_COARSEN='yes'; npx tsx scripts/ops/coarsen-existing-routes.ts --apply
 *     bash      : CONFIRM_ROUTE_COARSEN=yes npx tsx scripts/ops/coarsen-existing-routes.ts --apply
 *   --apply の最後に数え直し、変え残りがあれば終了コード 1 で止まる。
 *
 * 出力は件数だけ。住所・座標・ユーザー id は表示しない。
 */
import {
  coarsenRouteLocation,
  roundCoordinate,
  ROUTE_END_TRIM_METERS,
} from '../../lib/route-privacy'
import {
  hasConfirmation,
  isDirectRun,
  parseCliArgs,
  readNumber,
  readString,
  runCli,
  runD1,
  sqlNumber,
  sqlString,
  UsageError,
  type CliArgs,
  type OpsDeps,
} from './ops-shared'

export const ROUTE_COARSEN_CONFIRM_ENV = 'CONFIRM_ROUTE_COARSEN'
export const SELECT_ROUTES_SQL = 'SELECT id, user_id, start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry FROM user_routes ORDER BY id'
/** wrangler の --command に渡せる長さ(Windows のコマンドラインの上限 32767 文字より小さく) */
export const MAX_STATEMENT_LENGTH = 24_000
/** 長すぎる線は、内側の点を小数5桁(約1m)にして縮める */
const INNER_POINT_DECIMALS = 5

export interface StoredRoute {
  readonly id: string
  readonly userId: string
  readonly startLat: number
  readonly startLng: number
  readonly endLat: number
  readonly endLng: number
  readonly startAddress: string
  readonly endAddress: string
  readonly routeGeometry: Record<string, unknown> | null
}

export interface RouteChange {
  readonly route: StoredRoute
  readonly next: Omit<StoredRoute, 'id' | 'userId'>
  readonly geometryTrimmed: boolean
  readonly geometryDropped: boolean
}

function isTrimmed(geometry: Record<string, unknown> | null): boolean {
  return geometry !== null && geometry.trimmedEndsMeters === ROUTE_END_TRIM_METERS
}

/** 新しい決まりで保存し直したときの値。変わらなければ null */
export function planRouteChange(route: StoredRoute): RouteChange | null {
  const located = coarsenRouteLocation({
    startLat: route.startLat,
    startLng: route.startLng,
    endLat: route.endLat,
    endLng: route.endLng,
    startAddress: route.startAddress,
    endAddress: route.endAddress,
    ...(isTrimmed(route.routeGeometry) ? {} : { routeGeometry: route.routeGeometry }),
  })
  const next = {
    startLat: located.startLat!,
    startLng: located.startLng!,
    endLat: located.endLat!,
    endLng: located.endLng!,
    startAddress: located.startAddress!,
    endAddress: located.endAddress!,
    routeGeometry: isTrimmed(route.routeGeometry) ? route.routeGeometry : located.routeGeometry ?? null,
  }
  const geometryChanged = JSON.stringify(next.routeGeometry) !== JSON.stringify(route.routeGeometry)
  const changed = geometryChanged
    || next.startLat !== route.startLat || next.startLng !== route.startLng
    || next.endLat !== route.endLat || next.endLng !== route.endLng
    || next.startAddress !== route.startAddress || next.endAddress !== route.endAddress
  if (!changed) return null
  return {
    route,
    next,
    geometryTrimmed: geometryChanged && next.routeGeometry !== null,
    geometryDropped: route.routeGeometry !== null && next.routeGeometry === null,
  }
}

function shrinkGeometry(geometry: Record<string, unknown>): Record<string, unknown> {
  const coordinates = (geometry.coordinates as [number, number][]).map(([lng, lat]) => [
    roundCoordinate(lng, INNER_POINT_DECIMALS), roundCoordinate(lat, INNER_POINT_DECIMALS),
  ])
  return { ...geometry, coordinates }
}

/** 1件を書き換える UPDATE。長すぎる線は内側の点を縮め、それでも長ければ null(手で対応する) */
export function buildRouteUpdate(change: RouteChange): string | null {
  const build = (geometry: Record<string, unknown> | null) => [
    'UPDATE user_routes SET',
    `start_lat = ${sqlNumber(change.next.startLat)}, start_lng = ${sqlNumber(change.next.startLng)},`,
    `end_lat = ${sqlNumber(change.next.endLat)}, end_lng = ${sqlNumber(change.next.endLng)},`,
    `start_address = ${sqlString(change.next.startAddress)}, end_address = ${sqlString(change.next.endAddress)},`,
    `route_geometry = ${geometry === null ? 'NULL' : sqlString(JSON.stringify(geometry))}`,
    `WHERE id = ${sqlString(change.route.id)} AND user_id = ${sqlString(change.route.userId)}`,
  ].join(' ')
  const statement = build(change.next.routeGeometry)
  if (statement.length <= MAX_STATEMENT_LENGTH) return statement
  const shrunk = change.next.routeGeometry ? build(shrinkGeometry(change.next.routeGeometry)) : statement
  return shrunk.length <= MAX_STATEMENT_LENGTH ? shrunk : null
}

function parseGeometry(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return value as Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function readRoutes(deps: OpsDeps): Promise<StoredRoute[]> {
  const [result] = await runD1(deps.runner, SELECT_ROUTES_SQL)
  return (result?.results ?? []).flatMap((row) => {
    const route = {
      id: readString(row, 'id') ?? '',
      userId: readString(row, 'user_id') ?? '',
      startLat: readNumber(row, 'start_lat'),
      startLng: readNumber(row, 'start_lng'),
      endLat: readNumber(row, 'end_lat'),
      endLng: readNumber(row, 'end_lng'),
      startAddress: readString(row, 'start_address') ?? '',
      endAddress: readString(row, 'end_address') ?? '',
      routeGeometry: parseGeometry(row.route_geometry),
    }
    if (!route.id || !route.userId || route.startLat === null || route.startLng === null || route.endLat === null || route.endLng === null) return []
    return [route as StoredRoute]
  })
}

const USAGE = [
  '使い方: npx tsx scripts/ops/coarsen-existing-routes.ts [--apply]',
  `  既定は件数の表示だけ。変えるときは ${ROUTE_COARSEN_CONFIRM_ENV}=yes と --apply の両方が必要です。`,
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

  deps.log('[coarsen-existing-routes] 変える対象を数えます(住所・座標・id は表示しません)')
  const routes = await readRoutes(deps)
  const changes = routes.map(planRouteChange).filter((change): change is RouteChange => change !== null)
  const statements = changes.map((change) => ({ change, statement: buildRouteUpdate(change) }))
  const tooLong = statements.filter((item) => item.statement === null).length
  deps.log(`通学路 ${routes.length} 本のうち、変えるもの ${changes.length} 本`)
  deps.log(`  道すじの両端を削る ${changes.filter((change) => change.geometryTrimmed).length} 本 / 短い・壊れた道すじの保存をやめる ${changes.filter((change) => change.geometryDropped).length} 本`)
  if (tooLong > 0) deps.log(`  線が長すぎて1回で書き換えられないもの ${tooLong} 本(--apply では飛ばし、終了コード 1 で知らせます)`)

  if (!args.flags.has('apply')) {
    deps.log(`[coarsen-existing-routes] ドライラン: 何も書き換えていません。変えるときは ${ROUTE_COARSEN_CONFIRM_ENV}=yes を付けて --apply で実行してください。`)
    return 0
  }
  if (!hasConfirmation(deps.env, ROUTE_COARSEN_CONFIRM_ENV)) {
    deps.error(`--apply には ${ROUTE_COARSEN_CONFIRM_ENV}=yes が必要です。何も書き換えていません。`)
    return 1
  }

  let failed = 0
  for (const { statement } of statements) {
    if (!statement) continue
    try {
      await runD1(deps.runner, statement)
    } catch {
      failed += 1
    }
  }
  const remaining = (await readRoutes(deps)).map(planRouteChange).filter((change) => change !== null).length
  deps.log(`書き換え: ${statements.length - tooLong - failed} 本 / 失敗: ${failed} 本 / 数え直しで残っているもの: ${remaining} 本`)
  if (remaining > 0) {
    deps.error('変え残りがあります。もう一度 --apply で実行するか、長すぎる線は個別に確かめてください。')
    return 1
  }
  deps.log('[coarsen-existing-routes] すべての通学路を新しい粗さにしました。')
  return 0
}

if (isDirectRun('coarsen-existing-routes')) runCli('coarsen-existing-routes', main)
