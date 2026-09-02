// Generated modules are present after `pnpm build:cloudflare`.
import { handleCdnCgiImageRequest, handleImageRequest } from './.open-next/cloudflare/images.js'
import { runWithCloudflareRequestContext } from './.open-next/cloudflare/init.js'
import { maybeGetSkewProtectionResponse } from './.open-next/cloudflare/skew-protection.js'
import { handler as middlewareHandler } from './.open-next/middleware/handler.mjs'
import { routeBindingForPath } from './cloudflare/router-paths'
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

type D1BackupEnv = CloudflareEnv & {
  CLOUDFLARE_ACCOUNT_ID: string
  D1_DATABASE_ID: string
  D1_BACKUP_API_TOKEN: string
}

type RouterEnv = CloudflareEnv & {
  D1_BACKUP_WORKFLOW: Workflow
  CORE: Fetcher
  EDITORIAL: Fetcher
  MAP_3D: Fetcher
  MAP_UI: Fetcher
  ROUTE_QUIZ: Fetcher
  ROUTE_LIST: Fetcher
  MAP_DATA: Fetcher
  AI_VISION: Fetcher
  HUNTER: Fetcher
  SAFETY_QUEST: Fetcher
  AUTH_ADMIN: Fetcher
  COMMUNITY: Fetcher
  USER: Fetcher
  OPERATIONS: Fetcher
}

type D1ExportResult = {
  at_bookmark?: string
  error?: string
  messages?: string[]
  status?: 'complete' | 'error'
  signed_url?: string
  filename?: string
  result?: {
    signed_url?: string
    filename?: string
  }
}

type D1ExportResponse = {
  success?: boolean
  errors?: Array<{ message?: string }>
  messages?: Array<string | { message?: string }>
  result?: D1ExportResult
}

function d1ExportEndpoint(env: D1BackupEnv): string {
  const missing = [
    !env.CLOUDFLARE_ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID',
    !env.D1_DATABASE_ID && 'D1_DATABASE_ID',
    !env.D1_BACKUP_API_TOKEN && 'D1_BACKUP_API_TOKEN',
  ].filter(Boolean)
  if (missing.length > 0) throw new Error(`D1 backup environment is not configured: ${missing.join(', ')}`)
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/export`
}

async function requestD1Export(env: D1BackupEnv, payload: Record<string, string>): Promise<D1ExportResult> {
  const response = await fetch(d1ExportEndpoint(env), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.D1_BACKUP_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json<D1ExportResponse>()
  if (!response.ok || body.success === false) {
    const detail = body.errors?.map((error) => error.message).filter(Boolean).join('; ')
    throw new Error(`D1 export API failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  const result = body.result ?? {}
  if (!result.messages && body.messages) {
    result.messages = body.messages
      .map((message) => (typeof message === 'string' ? message : message.message))
      .filter((message): message is string => Boolean(message))
  }
  return result
}

/** Durable daily D1 export. Workflows retries polling, download, and R2 writes independently. */
export class D1BackupWorkflow extends WorkflowEntrypoint<D1BackupEnv> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep): Promise<{ key: string }> {
    let bookmark = await step.do(
      'start D1 export',
      { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } },
      async () => {
        const result = await requestD1Export(this.env, { output_format: 'polling' })
        if (!result.at_bookmark) throw new Error('D1 export did not return at_bookmark')
        return result.at_bookmark
      },
    )

    for (let attempt = 1; attempt <= 43; attempt += 1) {
      const outcome = await step.do(
        `poll D1 export ${attempt}`,
        { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
        async () => {
          const result = await requestD1Export(this.env, {
            output_format: 'polling',
            current_bookmark: bookmark,
          })
          if (result.status === 'error') throw new Error(`D1 export failed${result.error ? `: ${result.error}` : ''}`)
          const download = result.result ?? result
          if (!download.signed_url) {
            return {
              nextBookmark: result.at_bookmark ?? bookmark,
              status: result.status ?? 'unknown',
              messages: result.messages?.slice(-3) ?? [],
            }
          }
          const signedUrl = new URL(download.signed_url)
          if (signedUrl.protocol !== 'https:') throw new Error('D1 export returned a non-HTTPS URL')

          const dump = await fetch(signedUrl)
          if (!dump.ok || !dump.body) throw new Error(`Failed to download D1 export (${dump.status})`)
          const compressed = await new Response(dump.body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()

          const date = (event.schedule?.scheduledTime
            ? new Date(event.schedule.scheduledTime)
            : event.timestamp).toISOString().slice(0, 10)
          const key = `d1/${date}.sql.gz`
          await this.env.BACKUPS.put(key, compressed, {
            httpMetadata: { contentType: 'application/gzip' },
            customMetadata: {
              databaseId: this.env.D1_DATABASE_ID,
              bookmark,
              sourceFilename: download.filename ?? 'export.sql',
            },
          })
          return { key }
        },
      )

      if ('key' in outcome) return { key: outcome.key }
      bookmark = outcome.nextBookmark
      await step.sleep(`wait for D1 export ${attempt}`, '1 second')
    }

    throw new Error('D1 export did not complete before the Workers Free subrequest limit')
  }
}

function serverForPath(pathname: string, env: RouterEnv): Fetcher {
  return env[routeBindingForPath(pathname)]
}

function scheduledRoutes(controller: ScheduledController): string[] {
  const scheduledAt = new Date(controller.scheduledTime)
  const minute = scheduledAt.getUTCMinutes()
  const hour = scheduledAt.getUTCHours()

  return [
    '/api/cron/moderation-sweep',
    ...(minute % 15 === 0 ? ['/api/cron/push-danger-reports'] : []),
    ...(minute === 0 && hour % 2 === 0 ? ['/api/cron/local-safety-alerts'] : []),
    ...(minute === 0 && hour % 3 === 0 ? ['/api/cron/local-alert-fetcher'] : []),
    ...(minute === 30 && hour === 22 ? ['/api/cron/daily-news-digest'] : []),
    ...(minute === 0 && hour === 19
      ? [
          '/api/cron/hunter-retention-cleanup',
          ...(scheduledAt.getUTCDay() === 0 ? ['/api/cron/r2-orphan-cleanup'] : []),
        ]
      : []),
  ]
}

function shouldStartD1Backup(controller: ScheduledController): boolean {
  const scheduledAt = new Date(controller.scheduledTime)
  return scheduledAt.getUTCMinutes() === 0 && scheduledAt.getUTCHours() === 18
}

async function startD1Backup(controller: ScheduledController, env: RouterEnv): Promise<void> {
  if (!shouldStartD1Backup(controller)) return
  const date = new Date(controller.scheduledTime).toISOString().slice(0, 10)
  await env.D1_BACKUP_WORKFLOW.create({
    id: `d1-backup-${date}`,
    params: {},
  })
}

async function runScheduledRoutes(
  controller: ScheduledController,
  env: RouterEnv,
  ctx: ExecutionContext,
): Promise<void> {
  const responses = await Promise.all(
    scheduledRoutes(controller).map((route) => {
      const request = new Request(`https://pathguardian.internal${route}`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      })
      return serverForPath(route, env).fetch(request)
    }),
  )
  const failed = responses.filter((response) => !response.ok)
  if (failed.length > 0) {
    throw new Error(`Scheduled routes failed: ${failed.map((response) => response.status).join(', ')}`)
  }
  void ctx
}

const worker = {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const skewResponse = maybeGetSkewProtectionResponse(request)
      if (skewResponse) return skewResponse

      const url = new URL(request.url)
      if (url.pathname.startsWith('/cdn-cgi/image/')) {
        return handleCdnCgiImageRequest(url, env)
      }

      // This authenticated operational probe is implemented by the private
      // map-data Worker and is intentionally not part of the Next.js route tree.
      if (url.pathname === '/api/traffic-accidents/__health') {
        return env.MAP_DATA.fetch(request)
      }

      const nextGlobals = globalThis as typeof globalThis & {
        __NEXT_BASE_PATH__?: string
        __TRAILING_SLASH__?: boolean
      }
      const imagePath = `${nextGlobals.__NEXT_BASE_PATH__ ?? ''}/_next/image${nextGlobals.__TRAILING_SLASH__ ? '/' : ''}`
      if (url.pathname === imagePath) {
        return handleImageRequest(url, request.headers, env)
      }

      const requestOrResponse = await middlewareHandler(request, env, ctx)
      if (requestOrResponse instanceof Response) return requestOrResponse

      const pathname = new URL(requestOrResponse.url).pathname
      return serverForPath(pathname, env).fetch(requestOrResponse, {
        redirect: 'manual',
        cf: { cacheEverything: false },
      })
    })
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.all([runScheduledRoutes(controller, env, ctx), startD1Backup(controller, env)]).then(() => undefined))
  },
} satisfies ExportedHandler<RouterEnv>

export default worker
