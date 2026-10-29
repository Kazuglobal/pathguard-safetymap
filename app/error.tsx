"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect } from "react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

interface ErrorPageProps {
  error: Error & { digest?: string }
  /** Next 16 の再試行(内容を取り直して描き直す) */
  retry?: () => void
  reset?: () => void
}

/**
 * 画面の途中で起きた不具合の表示(UIUX改装 項目42)。英語や内部のエラー文は出さず、
 * もう一度読み込む・ホームへ戻るを出す。エラーの中身は Sentry に送る。
 */
export default function ErrorPage({ error, retry, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const tryAgain = retry ?? reset

  return (
    <div role="alert" className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-12 text-center" style={{ color: C.ink }}>
      <h1 className="text-2xl font-black">画面を表示できませんでした</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: C.inkSoft }}>
        通信が不安定か、一時的な不具合が起きています。もう一度読み込むか、時間をおいてから開いてください。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {tryAgain && (
          <button
            type="button"
            onClick={() => tryAgain()}
            className={`inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold text-white ${tankenTokens.cls.focus}`}
            style={{ background: C.primary, boxShadow: tankenTokens.shadow.pressGreen }}
          >
            もう一度読み込む
          </button>
        )}
        <Link
          href="/landing"
          className={`inline-flex min-h-11 items-center rounded-full border-2 px-6 text-sm font-bold ${tankenTokens.cls.focus}`}
          style={{ background: C.card, borderColor: tankenTokens.border.soft, color: C.ink }}
        >
          ホームへ
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs" style={{ color: C.inkSoft }}>
          お問い合わせのときは、この番号をお伝えください: {error.digest}
        </p>
      )}
    </div>
  )
}
