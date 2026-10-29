/**
 * Supabase Auth の user_metadata から、名前と顔写真を消すための部品(UIUX改装 項目55・62)。
 *
 * - 以前の登録フォームは氏名を full_name に入れていた
 * - LINE ログインは表示名・アイコンを name / full_name / avatar_url に入れていた
 * - Google ログインは Supabase の仕様で、ログインのたびに name / full_name / avatar_url / picture を入れ直す
 *
 * アプリはどれも読まないので、ログインのたびに消す(app/auth/callback・LINE のコールバック)。
 * 既にあるものは scripts/ops/scrub-personal-names.ts で一括で消す。
 * Supabase の identities(認証プロバイダの記録)側に残る分は、この API では消せない。
 */

/** 名前・顔写真にあたるキー。OIDC の標準クレームのうち名前に関わるものも含める */
export const PERSONAL_METADATA_KEYS = [
  'full_name',
  'name',
  'given_name',
  'family_name',
  'middle_name',
  'nickname',
  'preferred_username',
  'user_name',
  'avatar_url',
  'picture',
] as const

export type PersonalMetadataKey = (typeof PERSONAL_METADATA_KEYS)[number]

export type PersonalMetadataScrub = Partial<Record<PersonalMetadataKey, null>>

/**
 * 消す必要のあるキーだけを null にしたパッチを返す。消すものが無ければ null。
 * Supabase の updateUserById は user_metadata を既存の値に重ねて保存し、値が null のキーは消す。
 */
export function buildPersonalMetadataScrub(
  metadata: Readonly<Record<string, unknown>> | null | undefined,
): PersonalMetadataScrub | null {
  if (!metadata) return null
  const keys = PERSONAL_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(metadata, key))
  if (keys.length === 0) return null
  return Object.fromEntries(keys.map((key) => [key, null])) as PersonalMetadataScrub
}
