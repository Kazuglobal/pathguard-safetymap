export function register() {
  // Cloudflare Workers emit invocation errors through native observability.
  // Browser-side Sentry remains initialized in instrumentation-client.ts.
}

export function onRequestError(
  error: unknown,
  request: { method?: string },
  context: { routePath?: string; routerKind?: string; routeType?: string },
) {
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  const digest =
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string'
      ? error.digest.slice(0, 128)
      : undefined

  // Avoid messages, request URLs, headers, and stacks here: they can contain
  // credentials or user data. Cloudflare still records the invocation status.
  console.error('[server-request-error]', {
    errorName,
    digest,
    method: request.method,
    routePath: context.routePath,
    routerKind: context.routerKind,
    routeType: context.routeType,
  })
}
