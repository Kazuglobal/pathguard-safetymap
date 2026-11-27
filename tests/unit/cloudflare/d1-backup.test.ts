import { describe, expect, it, vi } from 'vitest'

import {
  D1_EXPORT_MAX_DURATION_MS,
  D1_EXPORT_POLL_INTERVAL_MS,
  runD1Export,
  uploadStreamToR2,
  type D1ExportPollResult,
} from '../../../cloudflare/d1-backup'

function fakeClock() {
  let time = 0
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms
    },
  }
}

describe('runD1Export', () => {
  it('polls continually with the first bookmark until the signed URL appears', async () => {
    const clock = fakeClock()
    const responses: D1ExportPollResult[] = [
      { at_bookmark: 'bm-1' },
      { at_bookmark: 'bm-1', messages: ['Generating SQL'] },
      { at_bookmark: 'bm-1', status: 'complete', result: { signed_url: 'https://example.com/dump.sql', filename: 'db.sql' } },
    ]
    const request = vi.fn(async () => responses.shift() ?? {})

    const outcome = await runD1Export(request, { intervalMs: 1_000, maxDurationMs: 60_000, ...clock })

    expect(outcome).toEqual({ signedUrl: 'https://example.com/dump.sql', filename: 'db.sql', bookmark: 'bm-1', polls: 2 })
    expect(request).toHaveBeenNthCalledWith(1, { output_format: 'polling' })
    expect(request).toHaveBeenNthCalledWith(2, { output_format: 'polling', current_bookmark: 'bm-1' })
    expect(request).toHaveBeenNthCalledWith(3, { output_format: 'polling', current_bookmark: 'bm-1' })
    expect(clock.now()).toBe(2_000)
  })

  it('throws the API error when the export fails', async () => {
    const clock = fakeClock()
    const responses: D1ExportPollResult[] = [{ at_bookmark: 'bm-1' }, { status: 'error', error: 'virtual tables' }]
    const request = vi.fn(async () => responses.shift() ?? {})

    await expect(runD1Export(request, { intervalMs: 1_000, maxDurationMs: 60_000, ...clock })).rejects.toThrow(
      'D1 export failed: virtual tables',
    )
  })

  it('gives up after the time limit and reports the last status and messages', async () => {
    const clock = fakeClock()
    const request = vi.fn(async (payload: Record<string, string>) =>
      payload.current_bookmark ? { at_bookmark: 'bm-1', messages: ['still exporting'] } : { at_bookmark: 'bm-1' },
    )

    await expect(runD1Export(request, { intervalMs: 1_000, maxDurationMs: 10_000, ...clock })).rejects.toThrow(
      /did not finish within 0 min after 10 polls \(last status: none; messages: still exporting\)/,
    )
  })

  it('keeps the default schedule inside the Workers Paid subrequest budget per instance', () => {
    const pollsPerAttempt = D1_EXPORT_MAX_DURATION_MS / D1_EXPORT_POLL_INTERVAL_MS + 1
    const attempts = 3 // first try + 2 retries
    expect(pollsPerAttempt * attempts).toBeLessThan(10_000)
    expect(D1_EXPORT_POLL_INTERVAL_MS).toBeLessThanOrEqual(2_000)
  })
})

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

function fakeBucket() {
  const uploaded: Array<{ partNumber: number; size: number }> = []
  const upload = {
    uploadPart: vi.fn(async (partNumber: number, value: Uint8Array) => {
      uploaded.push({ partNumber, size: value.byteLength })
      return { partNumber, etag: `etag-${partNumber}` }
    }),
    complete: vi.fn(async () => ({})),
    abort: vi.fn(async () => undefined),
  }
  return { bucket: { createMultipartUpload: vi.fn(async () => upload) }, upload, uploaded }
}

describe('uploadStreamToR2', () => {
  it('splits the stream into equal parts with a smaller last part', async () => {
    const { bucket, upload, uploaded } = fakeBucket()
    const chunks = [new Uint8Array(7), new Uint8Array(7), new Uint8Array(3)]

    const result = await uploadStreamToR2(bucket, 'd1/2026-11-28.sql.gz', streamOf(chunks), { partSize: 5 })

    expect(result).toEqual({ parts: 4, bytes: 17 })
    expect(uploaded).toEqual([
      { partNumber: 1, size: 5 },
      { partNumber: 2, size: 5 },
      { partNumber: 3, size: 5 },
      { partNumber: 4, size: 2 },
    ])
    expect(upload.complete).toHaveBeenCalledWith([1, 2, 3, 4].map((n) => ({ partNumber: n, etag: `etag-${n}` })))
  })

  it('aborts the multipart upload when a part fails', async () => {
    const { bucket, upload } = fakeBucket()
    upload.uploadPart.mockRejectedValueOnce(new Error('R2 unavailable'))

    await expect(
      uploadStreamToR2(bucket, 'd1/x.sql.gz', streamOf([new Uint8Array(10)]), { partSize: 5 }),
    ).rejects.toThrow('R2 unavailable')
    expect(upload.abort).toHaveBeenCalled()
    expect(upload.complete).not.toHaveBeenCalled()
  })
})
