/**
 * D1 日次バックアップの中身(エクスポートの待ち方と R2 への書き込み)。
 *
 * D1 の export API は「実行中のエクスポートは続けてポーリングしないと自動でキャンセルされる」。
 * Workflow の step ごとに数十秒あけて確認すると、その間にキャンセルされて完了しない。
 * そのため 1 つの step の中で、短い間隔で続けて確認する。
 */

export type D1ExportPollResult = {
  at_bookmark?: string
  error?: string
  messages?: string[]
  status?: string
  signed_url?: string
  filename?: string
  result?: {
    signed_url?: string
    filename?: string
  }
}

export type D1ExportRequest = (payload: Record<string, string>) => Promise<D1ExportPollResult>

export type D1ExportOutcome = {
  signedUrl: string
  filename: string
  bookmark: string
  polls: number
}

export type PollOptions = {
  /** この時間を過ぎても完了しなければ諦める(ミリ秒)。 */
  maxDurationMs: number
  /** 確認と確認のあいだの待ち時間(ミリ秒)。キャンセルされないよう短くする。 */
  intervalMs: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/** 既定値: 1 秒おきに最長 50 分。Workers Paid の 1 インスタンス 10,000 サブリクエストに十分収まる。 */
export const D1_EXPORT_POLL_INTERVAL_MS = 1_000
export const D1_EXPORT_MAX_DURATION_MS = 50 * 60 * 1000

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * エクスポートを開始し、完了するまで続けて確認する。
 * 途中で失敗したら例外を投げる。step のリトライでは最初から新しいエクスポートをやり直す。
 */
export async function runD1Export(request: D1ExportRequest, options: PollOptions): Promise<D1ExportOutcome> {
  const sleep = options.sleep ?? defaultSleep
  const now = options.now ?? Date.now
  const startedAt = now()

  const started = await request({ output_format: 'polling' })
  if (started.status === 'error') throw new Error(`D1 export failed to start${started.error ? `: ${started.error}` : ''}`)
  if (!started.at_bookmark) throw new Error('D1 export did not return at_bookmark')
  const bookmark = started.at_bookmark

  let latest: D1ExportPollResult = started
  let lastMessages: string[] = started.messages ?? []
  let polls = 0

  for (;;) {
    const download = latest.result ?? latest
    if (download.signed_url) {
      return {
        signedUrl: download.signed_url,
        filename: download.filename ?? 'export.sql',
        bookmark,
        polls,
      }
    }

    if (now() - startedAt >= options.maxDurationMs) {
      const minutes = Math.round((now() - startedAt) / 60_000)
      const tail = lastMessages.slice(-3).join(' / ')
      throw new Error(
        `D1 export did not finish within ${minutes} min after ${polls} polls (last status: ${latest.status ?? 'none'}${tail ? `; messages: ${tail}` : ''})`,
      )
    }

    await sleep(options.intervalMs)
    latest = await request({ output_format: 'polling', current_bookmark: bookmark })
    polls += 1
    if (latest.messages && latest.messages.length > 0) lastMessages = latest.messages
    if (latest.status === 'error') throw new Error(`D1 export failed${latest.error ? `: ${latest.error}` : ''}`)
  }
}

/** R2 の multipart upload は最後以外のパートを同じ大きさ(5 MiB 以上)にする必要がある。 */
export const R2_PART_SIZE = 10 * 1024 * 1024

type MultipartUpload = {
  uploadPart(partNumber: number, value: Uint8Array): Promise<{ partNumber: number; etag: string }>
  complete(parts: Array<{ partNumber: number; etag: string }>): Promise<unknown>
  abort(): Promise<void>
}

export type MultipartBucket = {
  createMultipartUpload(
    key: string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<MultipartUpload>
}

/**
 * ストリームを丸ごとメモリに載せず、一定サイズのパートに分けて R2 に書く。
 * Worker のメモリ上限(128 MB)より大きいダンプでも保存できる。
 */
export async function uploadStreamToR2(
  bucket: MultipartBucket,
  key: string,
  stream: ReadableStream<Uint8Array>,
  options: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string>; partSize?: number },
): Promise<{ parts: number; bytes: number }> {
  const partSize = options.partSize ?? R2_PART_SIZE
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: options.httpMetadata,
    customMetadata: options.customMetadata,
  })
  const parts: Array<{ partNumber: number; etag: string }> = []
  let buffer = new Uint8Array(partSize)
  let filled = 0
  let bytes = 0

  const flush = async (data: Uint8Array) => {
    parts.push(await upload.uploadPart(parts.length + 1, data))
  }

  try {
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      let offset = 0
      while (offset < value.byteLength) {
        const take = Math.min(partSize - filled, value.byteLength - offset)
        buffer.set(value.subarray(offset, offset + take), filled)
        filled += take
        offset += take
        bytes += take
        if (filled === partSize) {
          await flush(buffer)
          buffer = new Uint8Array(partSize)
          filled = 0
        }
      }
    }
    if (filled > 0 || parts.length === 0) await flush(buffer.slice(0, filled))
    await upload.complete(parts)
    return { parts: parts.length, bytes }
  } catch (error) {
    await upload.abort().catch(() => undefined)
    throw error
  }
}
