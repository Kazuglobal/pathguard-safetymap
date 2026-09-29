import { describe, expect, it, vi } from 'vitest'
import { WorldLabsClient } from '@/lib/hunter/routes/world-labs'

const input = { displayName: '学校東側', mediaAssetIds: ['asset-a', 'asset-b'], model: 'marble-1.1' as const }
describe('WorldLabsClient', () => {
  it('sends private multi-image generation with asset IDs and no guessed camera angles', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ operation_id: 'job-1', done: false }))
    await new WorldLabsClient('test-key', fetcher).generate(input)
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.worldlabs.ai/marble/v1/worlds:generate')
    expect(options.redirect).toBe('error')
    const body = JSON.parse(options.body)
    expect(body.permission).toEqual({ public: false })
    expect(body.world_prompt.multi_image_prompt).toEqual(input.mediaAssetIds.map(id => ({ content: { source: 'media_asset', media_asset_id: id } })))
    expect(body.model).toBe('marble-1.1')
  })
  it('rejects invalid input before sending paid requests', async () => {
    const fetcher = vi.fn()
    const client = new WorldLabsClient('test-key', fetcher)
    await expect(client.generate({ ...input, mediaAssetIds: [] })).rejects.toThrow()
    await expect(client.generate({ ...input, mediaAssetIds: ['same', 'same'] })).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    expect(() => new WorldLabsClient('')).toThrow()
  })
  it('does not automatically retry paid requests or expose provider error bodies', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('sensitive provider detail', { status: 402 }))
    await expect(new WorldLabsClient('test-key', fetcher).generate(input)).rejects.toMatchObject({ code: 'insufficient_credits' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('treats an uncertain submission as unknown, not safe to retry', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('secret'))
    await expect(new WorldLabsClient('test-key', fetcher).generate(input)).rejects.toMatchObject({ code: 'submission_unknown' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('polls and rejects operation path injection', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ operation_id: 'job-1', done: false }))
    const client = new WorldLabsClient('test-key', fetcher)
    await expect(client.getOperation('../credits')).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    expect(await client.getOperation('job-1')).toEqual({ operationId: 'job-1', state: 'running' })
  })
  it('does not call completed errors or incomplete assets ready', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ operation_id: 'job-1', done: true, error: { code: 13, message: 'secret' } }))
      .mockResolvedValueOnce(Response.json({ operation_id: 'job-1', done: true, response: { id: 'world-1' } }))
    const client = new WorldLabsClient('test-key', fetcher)
    expect(await client.getOperation('job-1')).toEqual({ operationId: 'job-1', state: 'failed' })
    await expect(client.getOperation('job-1')).rejects.toMatchObject({ code: 'invalid_response' })
  })
  it('returns only validated world assets and strips unknown metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ operation_id: 'job-1', done: true, response: {
      id: 'world-1', world_prompt: 'private', assets: { splats: { spz_urls: { '100k': 'https://assets.example/scene.spz' } } },
    } }))
    const result = await new WorldLabsClient('test-key', fetcher).getOperation('job-1')
    expect(result.state).toBe('ready')
    expect(JSON.stringify(result)).not.toContain('private')
  })
})
