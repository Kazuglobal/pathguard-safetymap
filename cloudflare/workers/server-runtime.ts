import { runWithCloudflareRequestContext } from '../../.open-next/cloudflare/init.js'

type OpenNextHandler = (
  request: Request,
  env: CloudflareEnv,
  ctx: ExecutionContext,
  signal?: AbortSignal,
) => Promise<Response>

type BeforeFetch<Env extends CloudflareEnv> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | null | Promise<Response | null>

export function createServerWorker<Env extends CloudflareEnv = CloudflareEnv>(
  handler: OpenNextHandler,
  beforeFetch?: BeforeFetch<Env>,
): ExportedHandler<Env> {
  return {
    fetch(request, env, ctx) {
      return runWithCloudflareRequestContext(request, env, ctx, async () => {
        const response = await beforeFetch?.(request, env, ctx)
        return response ?? handler(request, env, ctx, request.signal)
      })
    },
  }
}
