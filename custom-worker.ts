// Generated modules are present after `pnpm build:cloudflare`.
import openNextWorker from './.open-next/worker.js'
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import {
  D1_EXPORT_MAX_DURATION_MS,
  D1_EXPORT_POLL_INTERVAL_MS,
  runD1Export,
  uploadStreamToR2,
} from './cloudflare/d1-backup'

/**
 * 本番 D1 の traffic_accidents 件数として正しい値。取り込み途中・二重取り込みを検知するため完全一致で見る。
 * 2019〜2024年 = 1,869,032 件、2025年（287,020 件）を追加後 = 2,156,052 件。
 */
const EXPECTED_TRAFFIC_ACCIDENT_COUNTS: readonly number[] = [1_869_032, 2_156_052]

type RouterSendEmail = {
  send(message: {
    from: { email: string; name: string }
    to: string
    subject: string
    text: string
    html: string
  }): Promise<{ messageId?: string } | void>
}

const ROUTER_OPERATOR_EMAIL_TO = 'globalbunny77@gmail.com'
const ROUTER_OPERATOR_EMAIL_FROM = { email: 'noreply@path-guardian.com', name: 'PathGuardian' }

function escapeRouterHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function notifyRouterOperator(
  binding: RouterSendEmail | undefined,
  subject: string,
  lines: string[],
): Promise<void> {
  if (!binding || typeof binding.send !== 'function') return
  const text = lines.join('\n')
  const html = `<pre style="font-family:monospace;white-space:pre-wrap;line-height:1.6;">${escapeRouterHtml(text)}</pre>`
  try {
    await binding.send({
      from: ROUTER_OPERATOR_EMAIL_FROM,
      to: ROUTER_OPERATOR_EMAIL_TO,
      subject,
      text,
      html,
    })
  } catch (error) {
    console.error('[custom-worker] operator email failed:', error instanceof Error ? error.message : String(error))
  }
}

type D1BackupEnv = CloudflareEnv & {
  CLOUDFLARE_ACCOUNT_ID: string
  D1_DATABASE_ID: string
  D1_BACKUP_API_TOKEN: string
  OPERATOR_EMAIL?: RouterSendEmail
}

type RouterEnv = CloudflareEnv & {
  D1_BACKUP_WORKFLOW: Workflow
  OPERATOR_EMAIL?: RouterSendEmail
  TRAFFIC_DB: D1Database
  CRON_SECRET?: string
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

/**
 * Durable daily D1 export.
 *
 * The export API cancels an export that is not polled continually, so polling
 * happens inside one long step at a short interval instead of across steps with
 * sleeps in between. A retry of that step starts a fresh export.
 */
export class D1BackupWorkflow extends WorkflowEntrypoint<D1BackupEnv> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep): Promise<{ key: string }> {
    try {
      const exported = await step.do(
        'run D1 export',
        { retries: { limit: 2, delay: '1 minute', backoff: 'constant' }, timeout: '55 minutes' },
        async () =>
          runD1Export((payload) => requestD1Export(this.env, payload), {
            intervalMs: D1_EXPORT_POLL_INTERVAL_MS,
            maxDurationMs: D1_EXPORT_MAX_DURATION_MS,
          }),
      )

      // The signed URL is valid for one hour, so download right away.
      const key = await step.do(
        'save D1 export to R2',
        { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' }, timeout: '30 minutes' },
        async () => {
          const signedUrl = new URL(exported.signedUrl)
          if (signedUrl.protocol !== 'https:') throw new Error('D1 export returned a non-HTTPS URL')

          const dump = await fetch(signedUrl)
          if (!dump.ok || !dump.body) throw new Error(`Failed to download D1 export (${dump.status})`)

          const date = (event.schedule?.scheduledTime
            ? new Date(event.schedule.scheduledTime)
            : event.timestamp).toISOString().slice(0, 10)
          const objectKey = `d1/${date}.sql.gz`
          await uploadStreamToR2(this.env.BACKUPS, objectKey, dump.body.pipeThrough(new CompressionStream('gzip')), {
            httpMetadata: { contentType: 'application/gzip' },
            customMetadata: {
              databaseId: this.env.D1_DATABASE_ID,
              bookmark: exported.bookmark,
              sourceFilename: exported.filename,
            },
          })
          return objectKey
        },
      )

      return { key }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await notifyRouterOperator(
        this.env.OPERATOR_EMAIL,
        '【PathGuardian 異常】D1 日次バックアップに失敗しました',
        [
          `発生時刻(UTC): ${new Date().toISOString()}`,
          `データベースID: ${this.env.D1_DATABASE_ID}`,
          `エラー: ${message}`,
        ],
      )
      throw error
    }
  }
}

async function handleTrafficAccidentsHealth(request: Request, env: RouterEnv): Promise<Response> {
  const authorization = request.headers.get('authorization')
  if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(null, { status: 404 })
  }

  const result = await env.TRAFFIC_DB.prepare(
    'SELECT count(*) AS count FROM traffic_accidents',
  ).first<{ count: number }>()

  const count = result?.count ?? null
  return Response.json({ ok: count != null && EXPECTED_TRAFFIC_ACCIDENT_COUNTS.includes(count), count })
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
    ...(minute === 0 && hour === 23 ? ['/api/cron/daily-ops-report'] : []),
    ...(minute === 0 && hour === 19
      ? [
          '/api/cron/hunter-retention-cleanup',
          // 保持期間を過ぎた報告・通知の購読・作成の記録・バックアップ(UIUX改装 項目60)
          '/api/cron/retention-cleanup',
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
  try {
    await env.D1_BACKUP_WORKFLOW.create({
      id: `d1-backup-${date}`,
      params: {},
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await notifyRouterOperator(
      env.OPERATOR_EMAIL,
      '【PathGuardian 異常】D1 バックアップワークフローの起動に失敗しました',
      [
        `実行予定時刻(UTC): ${new Date(controller.scheduledTime).toISOString()}`,
        `ワークフローID: d1-backup-${date}`,
        `エラー: ${message}`,
      ],
    )
    throw error
  }
}

async function runScheduledRoutes(
  controller: ScheduledController,
  env: RouterEnv,
  ctx: ExecutionContext,
): Promise<void> {
  const routes = scheduledRoutes(controller)
  const outcomes = await Promise.all(
    routes.map(async (route) => {
      try {
        const request = new Request(`https://pathguardian.internal${route}`, {
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        })
        const response = await openNextWorker.fetch(request, env, ctx)
        if (response.ok) return { route, ok: true as const, status: response.status }
        const snippet = (await response.text().catch(() => '')).slice(0, 200)
        return { route, ok: false as const, status: response.status, detail: snippet }
      } catch (error) {
        return {
          route,
          ok: false as const,
          status: 0,
          detail: error instanceof Error ? error.message : String(error),
        }
      }
    }),
  )
  const failed = outcomes.filter((item) => !item.ok)
  if (failed.length > 0) {
    await notifyRouterOperator(
      env.OPERATOR_EMAIL,
      `【PathGuardian 異常】定期Cron実行で ${failed.length} 件のエラーが発生しました`,
      [
        `実行予定時刻(UTC): ${new Date(controller.scheduledTime).toISOString()}`,
        `対象ルート数: ${routes.length} / 失敗: ${failed.length}`,
        '',
        '--- 失敗詳細 ---',
        ...failed.map((item) => `- ${item.route} (HTTP ${item.status}): ${item.detail || '(詳細なし)'}`),
      ],
    )
    throw new Error(`Scheduled routes failed: ${failed.map((item) => `${item.route}:${item.status}`).join(', ')}`)
  }
  void ctx
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api/traffic-accidents/__health') {
      return handleTrafficAccidentsHealth(request, env)
    }

    return openNextWorker.fetch(request, env, ctx)
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.all([runScheduledRoutes(controller, env, ctx), startD1Backup(controller, env)]).then(() => undefined))
  },
} satisfies ExportedHandler<RouterEnv>

export default worker
