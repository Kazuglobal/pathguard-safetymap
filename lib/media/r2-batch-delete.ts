/** R2 は1回に1000件まで消せる。退会・保持期間の削除で、キーを1000件ずつに分けて消す */
export const R2_DELETE_BATCH = 1_000

export interface DeletableBucket {
  delete(keys: string | string[]): Promise<void>
}

export async function deleteR2Keys(bucket: DeletableBucket, keys: readonly string[]): Promise<void> {
  for (let index = 0; index < keys.length; index += R2_DELETE_BATCH) {
    await bucket.delete(keys.slice(index, index + R2_DELETE_BATCH))
  }
}
