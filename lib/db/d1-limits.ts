/**
 * D1 のバインド変数は、1回の問い合わせで 100 個まで(超えると "too many SQL variables" で失敗する)。
 * id の一覧を IN (...) に入れるときは、chunkForD1 で分けてから問い合わせる
 * (ほかの条件の変数のぶんを空けるため、1回に入れる id は 50 個まで)。
 * テストの SQLite(better-sqlite3)は上限が約3万2千なので、上限を超えても落ちない。
 * テストでは createTestDatabase({ logger }) で問い合わせごとの変数の数を数えて確かめる。
 */
export const D1_MAX_BOUND_PARAMETERS = 100
export const D1_IN_LIST_CHUNK_SIZE = 50

export function chunkForD1<T>(values: readonly T[], size: number = D1_IN_LIST_CHUNK_SIZE): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}
