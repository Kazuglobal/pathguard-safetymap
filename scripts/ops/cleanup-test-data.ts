/**
 * 本番のテストデータ（危険箇所の報告・通学路）を消す。既定はドライラン（何も消さない）。
 *
 * 使い方（リポジトリのルートで実行）:
 *   1. npx tsx scripts/ops/find-test-data.ts --remote --out=test-data-candidates.json
 *      で候補を保存し、JSON を開いて「消さない行」を削る。
 *      手で作るときは {"reportIds": ["…"], "routeIds": ["…"]} の形でもよい。
 *   2. npx tsx scripts/ops/cleanup-test-data.ts --input=test-data-candidates.json
 *      → ドライラン: 消す予定の行・R2 の画像・ポイントへの影響・実行する SQL を表示するだけ（ネットワークに出ない）。
 *   3. 本当に消すときだけ、確認用の環境変数を付けて --apply:
 *        PowerShell: $env:CONFIRM_TEST_DATA_CLEANUP='yes'; npx tsx scripts/ops/cleanup-test-data.ts --input=test-data-candidates.json --apply
 *        bash      : CONFIRM_TEST_DATA_CLEANUP=yes npx tsx scripts/ops/cleanup-test-data.ts --input=test-data-candidates.json --apply
 *
 * --apply の順番:
 *   (1) 本番 D1 を SELECT して、今ある行と画像キーを取り直す（入力ファイルの画像キーは使わない）
 *   (2) R2 の画像を消す: `npx wrangler r2 object delete <bucket>/<key> --remote`
 *       バケットは wrangler.jsonc の MEDIA_PRIVATE バインディングから読む。
 *       キーは danger-reports/<その報告の user_id>/<その報告の id>/<ファイル> の形のものだけを消す。
 *       1件でも失敗したら D1 には触らずに止まる（もう一度実行すれば続きから消せる）。
 *   (3) D1 の行を消す: DELETE FROM danger_reports / user_routes（関連する画像行・審査ログ・いいね等は外部キーで一緒に消える）
 *
 * 安全策: 入力が空なら止まる / id が合計 200 件を超えたら止まる / --apply と CONFIRM_TEST_DATA_CLEANUP=yes の両方が要る。
 * 注意: reward_points = 20（承認でポイントが付いた）報告を消すと、トリガー report_reward_delete により
 *       投稿者のポイントが 1 件につき 20pt 減る。ドライランと --apply の前に影響を表示する。
 */
import {
  describeWranglerArgs,
  hasConfirmation,
  isDirectRun,
  joinStatements,
  parseCliArgs,
  r2DeleteArgs,
  readJsonStringArray,
  readNumber,
  readString,
  REPORT_MEDIA_BINDING,
  resolveInCwd,
  resolveR2BucketName,
  runCli,
  runD1,
  shortText,
  sqlInList,
  UsageError,
  WRANGLER_CONFIG_FILE,
  type CliArgs,
  type D1StatementResult,
  type OpsDeps,
} from './ops-shared'

export const MAX_CLEANUP_IDS = 200
export const CLEANUP_CONFIRM_ENV = 'CONFIRM_TEST_DATA_CLEANUP'
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
const KEY_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

export interface CleanupNote {
  readonly title?: string
  readonly createdAt?: string
  readonly userId?: string
  readonly rewardPoints?: number | null
  readonly imageKeys?: readonly string[]
}

export interface CleanupInput {
  readonly reportIds: readonly string[]
  readonly routeIds: readonly string[]
  /** 入力ファイル（find-test-data.ts の出力）にあった表示用の情報。削除の判断には使わない */
  readonly notes: ReadonlyMap<string, CleanupNote>
  /**
   * テスト用アカウントの持ち物ではなく、題名・名前の言葉(テスト・サンプル等)だけで候補になった id。
   * 「テスト」は学校の試験の意味でも使われ、本物の報告が混ざりうるため、
   * --allow-title-matches を付けない限り --apply では消さない(2026-10-29 レビュー指摘)
   */
  readonly contentOnlyIds: readonly string[]
}

export interface CleanupPlan {
  readonly reportIds: readonly string[]
  readonly routeIds: readonly string[]
  readonly bucket: string
  /** --apply の最初に流す SELECT（今ある行と画像キーを取り直す）。lookupOrder と同じ順番 */
  readonly lookupStatements: readonly string[]
  readonly lookupSql: string
  readonly lookupOrder: ReadonlyArray<'reports' | 'routes'>
}

export interface R2Deletion {
  readonly reportId: string
  readonly key: string
  readonly args: readonly string[]
}

export interface SkippedKey {
  readonly reportId: string
  readonly key: string
  readonly reason: string
}

export interface PointImpact {
  readonly userId: string
  readonly reports: number
  readonly points: number
}

export interface ResolvedCleanup {
  readonly reportIds: readonly string[]
  readonly routeIds: readonly string[]
  readonly missingReportIds: readonly string[]
  readonly missingRouteIds: readonly string[]
  readonly r2Deletions: readonly R2Deletion[]
  readonly skippedKeys: readonly SkippedKey[]
  readonly pointImpact: readonly PointImpact[]
  /** 見つかった行だけを消す DELETE 文（消すものが無ければ空） */
  readonly deleteStatements: readonly string[]
  readonly deleteSql: string | null
}

type Row = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readIdList(value: unknown, label: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new UsageError(`${label} は文字列の配列にしてください`)
  }
  return value as string[]
}

function readEntries(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => !isRecord(item) || typeof item.id !== 'string')) {
    throw new UsageError(`${label} は id を持つオブジェクトの配列にしてください`)
  }
  return value as Record<string, unknown>[]
}

function noteOf(entry: Record<string, unknown>, titleKey: 'title' | 'name'): CleanupNote {
  return {
    title: typeof entry[titleKey] === 'string' ? entry[titleKey] as string : undefined,
    createdAt: readString(entry, 'created_at') ?? undefined,
    userId: readString(entry, 'user_id') ?? undefined,
    rewardPoints: readNumber(entry, 'reward_points'),
    imageKeys: readJsonStringArray(entry.image_keys),
  }
}

/** find-test-data.ts の出力（reports / routes）か {reportIds, routeIds} を読む */
export function parseCleanupInput(value: unknown): CleanupInput {
  if (!isRecord(value)) throw new UsageError('入力は JSON オブジェクトにしてください')
  const reports = readEntries(value.reports, 'reports')
  const routes = readEntries(value.routes, 'routes')
  const notes = new Map<string, CleanupNote>([
    ...reports.map((entry) => [entry.id as string, noteOf(entry, 'title')] as const),
    ...routes.map((entry) => [entry.id as string, noteOf(entry, 'name')] as const),
  ])
  const isContentOnly = (entry: Record<string, unknown>) =>
    Array.isArray(entry.matched_by) && !entry.matched_by.includes('owner')
  return {
    reportIds: [...reports.map((entry) => entry.id as string), ...readIdList(value.reportIds, 'reportIds')],
    routeIds: [...routes.map((entry) => entry.id as string), ...readIdList(value.routeIds, 'routeIds')],
    notes,
    contentOnlyIds: [...reports, ...routes].filter(isContentOnly).map((entry) => entry.id as string),
  }
}

function uniqueValidIds(ids: readonly string[], label: string): string[] {
  const trimmed = ids.map((id) => id.trim())
  const invalid = trimmed.find((id) => !ID_PATTERN.test(id))
  if (invalid !== undefined) throw new UsageError(`${label} に不正な id があります: ${shortText(invalid, 60)}`)
  return trimmed.filter((id, index) => trimmed.indexOf(id) === index)
}

/** 入力を検査して計画を作る（ネットワークには出ない） */
export function buildCleanupPlan(
  input: Pick<CleanupInput, 'reportIds' | 'routeIds'>,
  options: { readonly bucket: string },
): CleanupPlan {
  const reportIds = uniqueValidIds(input.reportIds, '報告')
  const routeIds = uniqueValidIds(input.routeIds, '通学路')
  const total = reportIds.length + routeIds.length
  if (total === 0) throw new UsageError('消す対象がありません（入力が空です）')
  if (total > MAX_CLEANUP_IDS) {
    throw new UsageError(`id が ${total} 件あります。1回に消せるのは ${MAX_CLEANUP_IDS} 件までです。ファイルを分けてください`)
  }
  const lookups = [
    ...(reportIds.length > 0 ? [{
      kind: 'reports' as const,
      sql: [
        'SELECT r.id, r.user_id, r.title, r.reward_points, r.image_key, r.processed_image_key, r.processed_image_keys,',
        '  (SELECT json_group_array(ri.image_key) FROM report_images ri WHERE ri.report_id = r.id) AS extra_image_keys',
        `FROM danger_reports r WHERE r.id IN ${sqlInList(reportIds)}`,
      ].join('\n'),
    }] : []),
    ...(routeIds.length > 0 ? [{
      kind: 'routes' as const,
      sql: `SELECT u.id, u.user_id, u.name FROM user_routes u WHERE u.id IN ${sqlInList(routeIds)}`,
    }] : []),
  ]
  const lookupStatements = lookups.map((lookup) => lookup.sql)
  return {
    reportIds,
    routeIds,
    bucket: options.bucket,
    lookupStatements,
    lookupSql: joinStatements(lookupStatements),
    lookupOrder: lookups.map((lookup) => lookup.kind),
  }
}

export function buildDeleteStatements(reportIds: readonly string[], routeIds: readonly string[]): string[] {
  return [
    ...(reportIds.length > 0 ? [`DELETE FROM danger_reports WHERE id IN ${sqlInList(reportIds)}`] : []),
    ...(routeIds.length > 0 ? [`DELETE FROM user_routes WHERE id IN ${sqlInList(routeIds)}`] : []),
  ]
}

function statementsToSql(statements: readonly string[]): string | null {
  return statements.length > 0 ? joinStatements(statements) : null
}

function imageKeysOf(row: Row): string[] {
  const keys = [
    readString(row, 'image_key'),
    readString(row, 'processed_image_key'),
    ...readJsonStringArray(row.processed_image_keys),
    ...readJsonStringArray(row.extra_image_keys),
  ].filter((key): key is string => Boolean(key))
  return keys.filter((key, index) => keys.indexOf(key) === index)
}

/** 画像キーがその報告のもの（danger-reports/<user_id>/<report_id>/<file>）か */
export function isOwnedReportImageKey(key: string, reportId: string, userId: string | null): boolean {
  if (!userId) return false
  const segments = key.split('/')
  return segments.length === 4
    && segments[0] === 'danger-reports'
    && segments[1] === userId
    && segments[2] === reportId
    && KEY_FILE_PATTERN.test(segments[3])
    && !segments[3].includes('..')
}

/** 報告の行から R2 で消すキーを決める。形が合わないキーは消さずに一覧に残す */
export function planR2Deletions(
  reportRows: readonly Row[],
  bucket: string,
): { readonly deletions: R2Deletion[]; readonly skipped: SkippedKey[] } {
  const entries = reportRows.flatMap((row) => {
    const reportId = readString(row, 'id')
    if (!reportId) return []
    const userId = readString(row, 'user_id')
    return imageKeysOf(row).map((key) => ({ reportId, key, owned: isOwnedReportImageKey(key, reportId, userId) }))
  })
  const unique = entries.filter((entry, index) => entries.findIndex((other) => other.key === entry.key) === index)
  return {
    deletions: unique.filter((entry) => entry.owned).map((entry) => ({
      reportId: entry.reportId,
      key: entry.key,
      args: r2DeleteArgs(bucket, entry.key),
    })),
    skipped: unique.filter((entry) => !entry.owned).map((entry) => ({
      reportId: entry.reportId,
      key: entry.key,
      reason: 'danger-reports/<user_id>/<report_id>/<file> の形ではないため消しません',
    })),
  }
}

/** reward_points = 20 の報告を消すと report_reward_delete トリガーで投稿者から 20pt 引かれる */
export function summarizePointImpact(reportRows: readonly Row[]): PointImpact[] {
  const rewarded = reportRows.filter((row) => readNumber(row, 'reward_points') === 20 && readString(row, 'user_id'))
  const userIds = [...new Set(rewarded.map((row) => readString(row, 'user_id') as string))]
  return userIds.map((userId) => {
    const reports = rewarded.filter((row) => readString(row, 'user_id') === userId).length
    return { userId, reports, points: -20 * reports }
  })
}

/** --apply の lookup 結果から、実際に消すもの（見つかった行・R2 キー・DELETE 文）を決める */
export function resolveCleanup(plan: CleanupPlan, results: readonly D1StatementResult[]): ResolvedCleanup {
  if (results.length !== plan.lookupOrder.length) {
    throw new Error(`lookup の結果の数（${results.length}）が想定（${plan.lookupOrder.length}）と合いません`)
  }
  const rowsOf = (kind: 'reports' | 'routes'): readonly Row[] => {
    const index = plan.lookupOrder.indexOf(kind)
    return index < 0 ? [] : results[index].results
  }
  const reportRows = rowsOf('reports').filter((row) => plan.reportIds.includes(readString(row, 'id') ?? ''))
  const routeRows = rowsOf('routes').filter((row) => plan.routeIds.includes(readString(row, 'id') ?? ''))
  const foundReportIds = plan.reportIds.filter((id) => reportRows.some((row) => readString(row, 'id') === id))
  const foundRouteIds = plan.routeIds.filter((id) => routeRows.some((row) => readString(row, 'id') === id))
  const r2 = planR2Deletions(reportRows, plan.bucket)
  const deleteStatements = buildDeleteStatements(foundReportIds, foundRouteIds)
  return {
    reportIds: foundReportIds,
    routeIds: foundRouteIds,
    missingReportIds: plan.reportIds.filter((id) => !foundReportIds.includes(id)),
    missingRouteIds: plan.routeIds.filter((id) => !foundRouteIds.includes(id)),
    r2Deletions: r2.deletions,
    skippedKeys: r2.skipped,
    pointImpact: summarizePointImpact(reportRows),
    deleteStatements,
    deleteSql: statementsToSql(deleteStatements),
  }
}

function describeNote(id: string, notes: ReadonlyMap<string, CleanupNote>): string {
  const note = notes.get(id)
  if (!note) return `  - ${id}`
  return `  - ${id}  ${note.createdAt ?? '-'}  user=${note.userId ?? '-'}  ${shortText(note.title ?? '')}`
}

function formatPointImpact(impact: readonly PointImpact[]): string[] {
  if (impact.length === 0) return ['ポイントへの影響: なし（reward_points = 20 の報告はありません）']
  return [
    'ポイントへの影響（reward_points = 20 の報告を消すと、投稿者から 1 件につき 20pt 引かれます）:',
    ...impact.map((item) => `  - user=${item.userId}  ${item.points}pt（${item.reports} 件）`),
  ]
}

/** ドライラン用: 入力ファイルにある情報（find-test-data.ts の出力）を lookup の行と同じ形にする */
function rowsFromNotes(reportIds: readonly string[], notes: ReadonlyMap<string, CleanupNote>): Row[] {
  return reportIds.flatMap((id) => {
    const note = notes.get(id)
    if (!note) return []
    return [{
      id,
      user_id: note.userId ?? null,
      reward_points: note.rewardPoints ?? null,
      extra_image_keys: [...(note.imageKeys ?? [])],
    }]
  })
}

function formatDryRun(input: CleanupInput, plan: CleanupPlan): string[] {
  const reportRows = rowsFromNotes(plan.reportIds, input.notes)
  const r2 = planR2Deletions(reportRows, plan.bucket)
  const deleteSql = statementsToSql(buildDeleteStatements(plan.reportIds, plan.routeIds))
  return [
    '[cleanup-test-data] ドライラン: 何も消しません（本番には接続しません）',
    `対象: 報告 ${plan.reportIds.length} 件 / 通学路 ${plan.routeIds.length} 件（1回 ${MAX_CLEANUP_IDS} 件まで）`,
    ...(plan.reportIds.length > 0 ? ['報告:', ...plan.reportIds.map((id) => describeNote(id, input.notes))] : []),
    ...(plan.routeIds.length > 0 ? ['通学路:', ...plan.routeIds.map((id) => describeNote(id, input.notes))] : []),
    `R2（バケット ${plan.bucket}・${WRANGLER_CONFIG_FILE} の ${REPORT_MEDIA_BINDING}）: 入力ファイルにある画像 ${r2.deletions.length} 件`
      + '（--apply では D1 から画像キーを取り直してから消します）',
    ...r2.deletions.map((deletion) => `  ${describeWranglerArgs(deletion.args)}`),
    ...r2.skipped.map((skipped) => `  消さない: ${skipped.key}（${skipped.reason}）`),
    ...formatPointImpact(summarizePointImpact(reportRows)),
    '--apply で最初に流す SELECT（今ある行と画像キーの取り直し）:',
    plan.lookupSql,
    'その後に流す DELETE（見つかった行だけに絞ります）:',
    deleteSql ?? '(なし)',
    `本当に消すときは ${CLEANUP_CONFIRM_ENV}=yes を付けて --apply で実行してください。`,
  ]
}

function formatResolved(resolved: ResolvedCleanup): string[] {
  return [
    `本番で見つかった行: 報告 ${resolved.reportIds.length} 件 / 通学路 ${resolved.routeIds.length} 件`,
    ...(resolved.missingReportIds.length > 0 ? [`  見つからない報告（スキップ）: ${resolved.missingReportIds.join(', ')}`] : []),
    ...(resolved.missingRouteIds.length > 0 ? [`  見つからない通学路（スキップ）: ${resolved.missingRouteIds.join(', ')}`] : []),
    `R2 で消す画像: ${resolved.r2Deletions.length} 件`,
    ...resolved.skippedKeys.map((skipped) => `  消さない: ${skipped.key}（${skipped.reason}）`),
    ...formatPointImpact(resolved.pointImpact),
  ]
}

const USAGE = [
  '使い方: npx tsx scripts/ops/cleanup-test-data.ts --input=<file.json> [--apply] [--allow-title-matches]',
  `  既定はドライラン。消すときは ${CLEANUP_CONFIRM_ENV}=yes と --apply の両方が必要です。`,
  '  題名・名前の言葉だけで候補になった行(テスト用アカウントの持ち物ではない行)は、一覧を確かめたうえで',
  '  --allow-title-matches を付けたときだけ消します。',
]

export async function main(argv: readonly string[], deps: OpsDeps): Promise<number> {
  let args: CliArgs
  let input: CleanupInput
  let plan: CleanupPlan
  try {
    args = parseCliArgs(argv, { flags: ['apply', 'help', 'allow-title-matches'], values: ['input'] })
    if (args.flags.has('help')) {
      USAGE.forEach((line) => deps.log(line))
      return 0
    }
    const inputPath = args.values.get('input')
    if (!inputPath) throw new UsageError('--input=<file.json> を指定してください')
    let parsed: unknown
    try {
      parsed = JSON.parse(deps.readTextFile(resolveInCwd(deps.cwd, inputPath)))
    } catch (error) {
      throw new UsageError(`入力ファイルを JSON として読めません: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
    input = parseCleanupInput(parsed)
    const bucket = resolveR2BucketName(deps.readTextFile(resolveInCwd(deps.cwd, WRANGLER_CONFIG_FILE)), REPORT_MEDIA_BINDING)
    plan = buildCleanupPlan(input, { bucket })
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    deps.error(error.message)
    USAGE.forEach((line) => deps.error(line))
    return 1
  }

  formatDryRun(input, plan).forEach((line) => deps.log(line))
  const blockedContentOnly = args.flags.has('allow-title-matches') ? [] : input.contentOnlyIds
  if (blockedContentOnly.length > 0) {
    deps.log('')
    deps.log(`注意: 次の ${blockedContentOnly.length} 件は、テスト用アカウントの持ち物ではなく題名・名前の言葉だけで候補になっています。`)
    deps.log('本物の報告・通学路の可能性があるため、一覧を確かめてから --allow-title-matches を付けてください:')
    blockedContentOnly.forEach((id) => deps.log(`  - ${id}`))
  }
  if (!args.flags.has('apply')) return 0
  if (blockedContentOnly.length > 0) {
    deps.error('題名・名前だけで候補になった行が含まれるため、--allow-title-matches なしでは消しません。何も消していません。')
    return 1
  }
  if (!hasConfirmation(deps.env, CLEANUP_CONFIRM_ENV)) {
    deps.error(`--apply には ${CLEANUP_CONFIRM_ENV}=yes が必要です。何も消していません。`)
    return 1
  }

  deps.log('')
  deps.log('[cleanup-test-data] --apply: 本番 D1 から今ある行と画像キーを取り直します')
  const resolved = resolveCleanup(plan, await runD1(deps.runner, plan.lookupSql))
  formatResolved(resolved).forEach((line) => deps.log(line))
  if (!resolved.deleteSql) {
    deps.log('消す行がありません。終了します。')
    return 0
  }

  for (const [index, deletion] of resolved.r2Deletions.entries()) {
    const result = await deps.runner(deletion.args)
    if (result.code !== 0) {
      deps.error(`R2 の削除に失敗しました（${index + 1}/${resolved.r2Deletions.length}: ${deletion.key}）。D1 の行は消していません。もう一度実行してください。`)
      return 1
    }
    deps.log(`R2 削除 ${index + 1}/${resolved.r2Deletions.length}: ${deletion.key}`)
  }

  const deleted = await runD1(deps.runner, resolved.deleteSql)
  const changes = deleted.map((statement) => readNumber(statement.meta ?? {}, 'changes') ?? 0)
  deps.log(`D1 の行を消しました（DELETE ごとの件数: ${changes.join(' / ')}）`)
  return 0
}

if (isDirectRun('cleanup-test-data')) runCli('cleanup-test-data', main)
