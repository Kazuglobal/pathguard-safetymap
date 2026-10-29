/**
 * 預からない設計になった名前・顔写真(UIUX改装 項目55・62)を、本番から一括で消す。既定はドライラン(件数を数えるだけ)。
 *
 * 消すもの:
 *   1. Supabase Auth の user_metadata の名前・顔写真(full_name / name / avatar_url / picture など。
 *      キーの一覧は lib/privacy/personal-metadata.ts)。以前の登録フォームの氏名、LINE の表示名・アイコン、
 *      Google の名前・写真の URL が入っている
 *   2. D1 の profiles.full_name(以前のプロフィール編集の「氏名」)
 * 消さないもの: 表示名(display_name。本人がつけたニックネーム)、本人が上げたアイコン(avatar_key)、
 *   ログインに使う line_user_id とメールアドレス
 * この方法では消せないもの: Supabase の auth.identities(認証プロバイダの記録)に残る Google/LINE の名前・写真の URL
 *
 * 使い方(リポジトリのルートで実行。本番の NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に入れておく):
 *   npx tsx scripts/ops/scrub-personal-names.ts
 *     → 消す対象の件数だけを表示する(何も書き換えない)。
 *   本当に消すときだけ、確認用の環境変数を付けて --apply:
 *     PowerShell: $env:CONFIRM_PERSONAL_NAME_SCRUB='yes'; npx tsx scripts/ops/scrub-personal-names.ts --apply
 *     bash      : CONFIRM_PERSONAL_NAME_SCRUB=yes npx tsx scripts/ops/scrub-personal-names.ts --apply
 *   --apply の最後に両方を数え直し、0 件にならなければ終了コード 1 で止まる。
 *
 * 出力は件数だけ。名前・メールアドレス・ユーザー id・環境変数の値は表示しない。
 */
import { createClient } from '@supabase/supabase-js'

import {
  buildPersonalMetadataScrub,
  PERSONAL_METADATA_KEYS,
  type PersonalMetadataKey,
  type PersonalMetadataScrub,
} from '../../lib/privacy/personal-metadata'
import {
  hasConfirmation,
  isDirectRun,
  parseCliArgs,
  readNumber,
  runCli,
  runD1,
  UsageError,
  type CliArgs,
  type EnvSource,
  type OpsDeps,
} from './ops-shared'

export const NAME_SCRUB_CONFIRM_ENV = 'CONFIRM_PERSONAL_NAME_SCRUB'
const SUPABASE_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL'
const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY'
const USERS_PER_PAGE = 1000
/** 打ち切りの上限(1000人×200ページ)。これを超える規模なら、分けて流すようにスクリプトを直す */
const MAX_PAGES = 200

export const COUNT_FULL_NAMES_SQL = 'SELECT COUNT(*) AS n FROM profiles WHERE full_name IS NOT NULL'
export const CLEAR_FULL_NAMES_SQL = 'UPDATE profiles SET full_name = NULL WHERE full_name IS NOT NULL'

export interface AuthUserRecord {
  readonly id: string
  readonly user_metadata?: Readonly<Record<string, unknown>> | null
}

/** Supabase Auth 管理 API のうち、このスクリプトが使う部分(テストでは差し替える) */
export interface AuthAdminPort {
  listUsers(page: number, perPage: number): Promise<readonly AuthUserRecord[]>
  updateUserMetadata(userId: string, metadata: PersonalMetadataScrub): Promise<void>
}

export interface ScrubTarget {
  readonly userId: string
  readonly patch: PersonalMetadataScrub
}

export interface AuthScan {
  readonly totalUsers: number
  readonly targets: readonly ScrubTarget[]
  readonly keyCounts: Readonly<Record<PersonalMetadataKey, number>>
}

export function createSupabaseAuthAdminPort(env: EnvSource): AuthAdminPort {
  const url = env[SUPABASE_URL_ENV]
  const key = env[SERVICE_ROLE_ENV]
  if (!url || !key) {
    throw new UsageError(`環境変数 ${SUPABASE_URL_ENV} と ${SERVICE_ROLE_ENV}(本番)が要ります(値は表示しません)`)
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async listUsers(page, perPage) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage })
      if (error) throw new Error(`Supabase のユーザー一覧を取れませんでした(${error.status ?? '不明'})`)
      return data.users.map((user) => ({ id: user.id, user_metadata: user.user_metadata ?? null }))
    },
    async updateUserMetadata(userId, metadata) {
      const { error } = await client.auth.admin.updateUserById(userId, { user_metadata: metadata })
      if (error) throw new Error(`Supabase のユーザーを更新できませんでした(${error.status ?? '不明'})`)
    },
  }
}

/** 全ユーザーを読み、消す必要のある人とキーごとの件数を数える(書き換えはしない) */
export async function scanAuthUsers(auth: AuthAdminPort): Promise<AuthScan> {
  const targets: ScrubTarget[] = []
  const keyCounts = Object.fromEntries(PERSONAL_METADATA_KEYS.map((key) => [key, 0])) as Record<PersonalMetadataKey, number>
  let totalUsers = 0
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const users = await auth.listUsers(page, USERS_PER_PAGE)
    totalUsers += users.length
    for (const user of users) {
      const patch = buildPersonalMetadataScrub(user.user_metadata)
      if (!patch) continue
      targets.push({ userId: user.id, patch })
      for (const key of Object.keys(patch) as PersonalMetadataKey[]) keyCounts[key] += 1
    }
    if (users.length < USERS_PER_PAGE) return { totalUsers, targets, keyCounts }
  }
  throw new Error(`ユーザーが ${USERS_PER_PAGE * MAX_PAGES} 人を超えています。分けて流せるようにスクリプトを直してください。何も書き換えていません。`)
}

export async function countStoredFullNames(deps: OpsDeps): Promise<number> {
  const [result] = await runD1(deps.runner, COUNT_FULL_NAMES_SQL)
  return readNumber(result?.results[0] ?? {}, 'n') ?? 0
}

function describeKeyCounts(keyCounts: Readonly<Record<PersonalMetadataKey, number>>): string {
  const parts = PERSONAL_METADATA_KEYS.filter((key) => keyCounts[key] > 0).map((key) => `${key} ${keyCounts[key]}`)
  return parts.length > 0 ? parts.join(' / ') : 'なし'
}

const USAGE = [
  '使い方: npx tsx scripts/ops/scrub-personal-names.ts [--apply]',
  `  既定は件数の表示だけ。消すときは ${NAME_SCRUB_CONFIRM_ENV}=yes と --apply の両方が必要です。`,
]

export async function main(argv: readonly string[], deps: OpsDeps, authPort?: AuthAdminPort): Promise<number> {
  let args: CliArgs
  let auth: AuthAdminPort
  try {
    args = parseCliArgs(argv, { flags: ['apply', 'help'], values: [] })
    if (args.flags.has('help')) {
      USAGE.forEach((line) => deps.log(line))
      return 0
    }
    auth = authPort ?? createSupabaseAuthAdminPort(deps.env)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    deps.error(error.message)
    USAGE.forEach((line) => deps.error(line))
    return 1
  }

  deps.log('[scrub-personal-names] 消す対象を数えます(名前・メール・id は表示しません)')
  const scan = await scanAuthUsers(auth)
  const fullNames = await countStoredFullNames(deps)
  deps.log(`Supabase Auth: ユーザー ${scan.totalUsers} 人のうち、名前・顔写真が残っている人 ${scan.targets.length} 人(キーごと: ${describeKeyCounts(scan.keyCounts)})`)
  deps.log(`D1 profiles.full_name: 入っている行 ${fullNames} 件`)

  if (!args.flags.has('apply')) {
    deps.log(`[scrub-personal-names] ドライラン: 何も書き換えていません。消すときは ${NAME_SCRUB_CONFIRM_ENV}=yes を付けて --apply で実行してください。`)
    return 0
  }
  if (!hasConfirmation(deps.env, NAME_SCRUB_CONFIRM_ENV)) {
    deps.error(`--apply には ${NAME_SCRUB_CONFIRM_ENV}=yes が必要です。何も書き換えていません。`)
    return 1
  }

  deps.log('[scrub-personal-names] --apply: D1 の氏名を消します')
  await runD1(deps.runner, CLEAR_FULL_NAMES_SQL)

  deps.log(`[scrub-personal-names] --apply: Supabase Auth の ${scan.targets.length} 人から名前・顔写真を消します`)
  let failed = 0
  for (const target of scan.targets) {
    try {
      await auth.updateUserMetadata(target.userId, target.patch)
    } catch {
      failed += 1
    }
  }
  deps.log(`更新: ${scan.targets.length - failed} 人 / 失敗: ${failed} 人`)

  const remainingAuth = (await scanAuthUsers(auth)).targets.length
  const remainingFullNames = await countStoredFullNames(deps)
  deps.log(`数え直し: Supabase Auth に残っている人 ${remainingAuth} 人 / D1 の氏名 ${remainingFullNames} 件`)
  if (failed > 0 || remainingAuth > 0 || remainingFullNames > 0) {
    deps.error('消し残りがあります。もう一度 --apply で実行してください(残っている分だけを消します)。')
    return 1
  }
  deps.log('[scrub-personal-names] すべて消しました。')
  return 0
}

if (isDirectRun('scrub-personal-names')) runCli('scrub-personal-names', main)
