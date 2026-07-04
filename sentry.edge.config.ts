import * as Sentry from '@sentry/nextjs'
import { scrubPII } from './lib/sentry/scrub-pii'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    debug: process.env.NODE_ENV === 'development',
    enabled: process.env.NODE_ENV !== 'test',
    beforeSend: scrubPII,
  })
}
