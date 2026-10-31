'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { ERROR_COPY } from '@/components/layout/error-copy'
import { pageTitle } from '@/lib/brand'
import { tankenTokens } from '@/lib/design/tanken'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  /** Next 16 の再試行(内容を取り直して描き直す) */
  retry?: () => void
  reset?: () => void
}

// この画面にはアプリの CSS(class)が当たらないので、見た目は style で書く。色は lib/design/tanken.ts から読む
const C = tankenTokens.color

/**
 * ルートの layout ごと表示できなくなったときの画面(UIUX改装 項目42)。
 * 以前は英語の既定の画面(next/error)を出していた。日本語で、もう一度読み込む・ホームへを出す(文は app/error.tsx と同じ)。
 */
export default function GlobalError({ error, retry, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const tryAgain = retry ?? reset

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          background: C.paper,
          color: C.ink,
          fontFamily: '"Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
        }}
      >
        <title>{pageTitle(ERROR_COPY.title)}</title>
        <main role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            Path<span style={{ color: '#E8A33D' }}>Guardian</span>
          </p>
          <h1 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 900 }}>{ERROR_COPY.title}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.inkSoft }}>{ERROR_COPY.body}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            {tryAgain && (
              <button
                type="button"
                onClick={() => tryAgain()}
                style={{
                  minHeight: 44,
                  padding: '0 24px',
                  border: 'none',
                  borderRadius: 9999,
                  background: C.primary,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {ERROR_COPY.retry}
              </button>
            )}
            {/* ルートの layout が壊れているときは、画面ごと読み込み直す普通のリンクにする */}
            <a
              href="/landing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 24px',
                borderRadius: 9999,
                border: `2px solid ${tankenTokens.border.soft}`,
                background: C.card,
                color: C.ink,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {ERROR_COPY.home}
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 12, color: C.inkSoft }}>
              {ERROR_COPY.digest} {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
