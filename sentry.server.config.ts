import * as Sentry from '@sentry/nextjs'
import { scrubPII } from './lib/sentry/scrub-pii'
import { scrubBreadcrumbUrls, scrubEventUrls, scrubSpanUrls } from './lib/sentry/scrub-urls'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === 'development',
    enabled: process.env.NODE_ENV !== 'test',
    // URL のクエリ(住所の検索語・地図の表示範囲など)は送らない(lib/sentry/scrub-urls.ts)
    beforeSend: (event) => scrubEventUrls(scrubPII(event)),
    beforeSendTransaction: (event) => scrubEventUrls(event),
    beforeSendSpan: scrubSpanUrls,
    beforeBreadcrumb: scrubBreadcrumbUrls,
  })
}
