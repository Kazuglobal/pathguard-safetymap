import * as Sentry from '@sentry/nextjs'

import { scrubPII } from './lib/sentry/scrub-pii'
import { scrubBreadcrumbUrls, scrubEventUrls, scrubReplayFrameUrls, scrubSpanUrls } from './lib/sentry/scrub-urls'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // 通常時の画面の録画はしない。エラーが起きたときだけ、文字と画像を隠して記録する(UIUX改装 項目60・プライバシーポリシー 6.)
    replaysSessionSampleRate: 0,
    // URL のクエリ(住所の検索語・地図の表示範囲など)は送らない(lib/sentry/scrub-urls.ts)
    beforeSend: (event) => scrubEventUrls(scrubPII(event)),
    beforeSendTransaction: (event) => scrubEventUrls(event),
    beforeSendSpan: scrubSpanUrls,
    beforeBreadcrumb: scrubBreadcrumbUrls,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        beforeAddRecordingEvent: scrubReplayFrameUrls,
      }),
    ],
    debug: process.env.NODE_ENV === 'development',
    enabled: process.env.NODE_ENV !== 'test',
  })
  // 録画のイベント(見たページの URL の一覧)にも同じ処理をする
  Sentry.addEventProcessor((event) => scrubEventUrls(event))
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
