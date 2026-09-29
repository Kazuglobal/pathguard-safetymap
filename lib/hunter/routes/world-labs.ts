import 'server-only'
import { z } from 'zod'

// Official contract: https://docs.worldlabs.ai/api/reference/worlds/generate
const API = 'https://api.worldlabs.ai/marble/v1'
const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)
const secureUrl = z.string().url().refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
})
const inputSchema = z.object({
  displayName: z.string().trim().min(1).max(64),
  // Application batch limit; not a claim about the provider limit.
  mediaAssetIds: z.array(idSchema).min(1).max(8).refine(ids => new Set(ids).size === ids.length),
  model: z.enum(['marble-1.0-draft', 'marble-1.1']),
})
const worldSchema = z.object({
  id: idSchema,
  assets: z.object({
    splats: z.object({
      spz_urls: z.object({ '100k': secureUrl }),
      semantics_metadata: z.object({
        metric_scale_factor: z.number().finite().positive(),
        ground_plane_offset: z.number().finite(),
      }).nullish(),
    }),
    mesh: z.object({ collider_mesh_url: secureUrl }).optional(),
  }),
})
const operationSchema = z.object({
  operation_id: idSchema,
  done: z.boolean(),
  error: z.object({ code: z.number() }).nullish(),
  response: z.unknown(),
})

export type WorldLabsInput = z.infer<typeof inputSchema>
export type WorldLabsOperation =
  | { operationId: string; state: 'running' | 'failed' }
  | { operationId: string; state: 'ready'; world: z.infer<typeof worldSchema> }
export type WorldLabsErrorCode = 'not_configured' | 'insufficient_credits' | 'unauthorized' | 'rate_limited' | 'provider_error' | 'submission_unknown' | 'connection_failed' | 'invalid_response'

export class WorldLabsError extends Error {
  constructor(readonly code: WorldLabsErrorCode, readonly status?: number) {
    super(`World Labs: ${code}`)
    this.name = 'WorldLabsError'
  }
}

/** Server adapter, not a public API. Caller must authorize school/owner,
 * verify masking, resolve owned media assets and persist the operation ID.
 * No automatic retries: an interrupted POST might already have been billed.
 */
export class WorldLabsClient {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new WorldLabsError('not_configured')
  }

  async uploadImage(bytes: Uint8Array): Promise<string> {
    if (!bytes.length || bytes.length > 1_500_000) throw new WorldLabsError('invalid_response')
    let data: unknown
    try {
      const response = await this.fetcher(`${API}/media-assets:prepare_upload`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', 'WLT-Api-Key': this.apiKey },
        body: JSON.stringify({ file_name: 'route-photo.webp', kind: 'image', extension: 'webp' }),
      })
      if (!response.ok) throw new Error('upload')
      data = await response.json()
    } catch { throw new WorldLabsError('connection_failed') }
    const prepared = z.object({
      media_asset: z.object({ id: idSchema.optional(), media_asset_id: idSchema.optional() }),
      upload_info: z.object({ upload_url: secureUrl, upload_method: z.literal('PUT'), required_headers: z.record(z.string()).optional() }),
    }).safeParse(data)
    if (!prepared.success) throw new WorldLabsError('invalid_response')
    const { media_asset, upload_info } = prepared.data
    const id = media_asset.media_asset_id ?? media_asset.id
    const host = new URL(upload_info.upload_url).hostname
    if (!id || !(host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com'))) throw new WorldLabsError('invalid_response')
    try {
      const response = await this.fetcher(upload_info.upload_url, {
        method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { ...upload_info.required_headers, 'Content-Type': 'image/webp' }, body: bytes as BodyInit,
      })
      if (!response.ok) throw new Error('upload')
      return id
    } catch { throw new WorldLabsError('connection_failed') }
  }

  async generate(input: WorldLabsInput): Promise<WorldLabsOperation> {
    const parsed = inputSchema.parse(input)
    const images = parsed.mediaAssetIds.map(media_asset_id => ({ source: 'media_asset', media_asset_id }))
    const worldPrompt = images.length === 1
      ? { type: 'image', image_prompt: images[0], is_pano: false }
      : { type: 'multi-image', multi_image_prompt: images.map(content => ({ content })) }
    return this.request('/worlds:generate', {
      display_name: parsed.displayName,
      model: parsed.model,
      permission: { public: false },
      world_prompt: worldPrompt,
    })
  }

  async getOperation(operationId: string): Promise<WorldLabsOperation> {
    idSchema.parse(operationId)
    const operation = await this.request(`/operations/${operationId}`)
    if (operation.operationId !== operationId) throw new WorldLabsError('invalid_response')
    return operation
  }

  private async request(path: string, body?: unknown): Promise<WorldLabsOperation> {
    let response: Response
    try {
      response = await this.fetcher(`${API}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'WLT-Api-Key': this.apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new WorldLabsError(body === undefined ? 'connection_failed' : 'submission_unknown')
    }
    if (!response.ok) {
      const code = response.status === 402 ? 'insufficient_credits'
        : response.status === 401 || response.status === 403 ? 'unauthorized'
        : response.status === 429 ? 'rate_limited'
        : body !== undefined && response.status >= 500 ? 'submission_unknown' : 'provider_error'
      // Never include provider bodies: they may echo private inputs or URLs.
      throw new WorldLabsError(code, response.status)
    }
    try {
      const operation = operationSchema.parse(await response.json())
      if (operation.error) return { operationId: operation.operation_id, state: 'failed' }
      if (!operation.done) return { operationId: operation.operation_id, state: 'running' }
      const world = worldSchema.parse(operation.response)
      return { operationId: operation.operation_id, state: 'ready', world }
    } catch {
      // Missing ID after a successful POST also leaves billing uncertain.
      throw new WorldLabsError(body === undefined ? 'invalid_response' : 'submission_unknown')
    }
  }
}
