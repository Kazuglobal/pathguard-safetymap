'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  /** Next 16 の再試行(内容を取り直して描き直す) */
  retry?: () => void
  reset?: () => void
}

// この画面にはアプリの CSS が当たらないので、色と文字はここで直に書く(lib/design/tanken.ts と同じ色)
const INK = '#43392B'
const INK_SOFT = '#746855'
const PAPER = '#FBF5E9'
const PRIMARY = '#159E72'

/**
 * ルートの layout ごと表示できなくなったときの画面(UIUX改装 項目42)。
 * 以前は英語の既定の画面(next/error)を出していた。日本語で、もう一度読み込む・ホームへを出す。
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
          background: PAPER,
          color: INK,
          fontFamily: '"Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
        }}
      >
        <title>画面を表示できませんでした | PathGuardian</title>
        <main role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            Path<span style={{ color: '#E8A33D' }}>Guardian</span>
          </p>
          <h1 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 900 }}>画面を表示できませんでした</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: INK_SOFT }}>
            通信が不安定か、一時的な不具合が起きています。もう一度読み込むか、時間をおいてから開いてください。
          </p>
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
                  background: PRIMARY,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                もう一度読み込む
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
                border: `2px solid rgba(67,57,43,.14)`,
                background: '#FFFDF7',
                color: INK,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ホームへ
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 12, color: INK_SOFT }}>
              お問い合わせのときは、この番号をお伝えください: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
