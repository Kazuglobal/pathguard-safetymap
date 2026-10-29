import Link from "next/link"
import type { Metadata } from "next"

import { Lupe } from "@/components/brand/lupe"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

export const metadata: Metadata = { title: "ページが見つかりません" }

/** 見つからないページ(UIUX改装 項目42)。英語の既定の画面の代わりに、ホームと地図への入口を出す */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-12 text-center" style={{ color: C.ink }}>
      <Lupe size="lg" mood="think" decorative />
      <h1 className="mt-4 text-2xl font-black">ページが見つかりません</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: C.inkSoft }}>
        アドレスがまちがっているか、ページが移動・削除された可能性があります。ホームか地図から、もう一度さがしてください。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/landing"
          className={`inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold text-white ${tankenTokens.cls.focus}`}
          style={{ background: C.primary, boxShadow: tankenTokens.shadow.pressGreen }}
        >
          ホームへ
        </Link>
        <Link
          href="/map"
          className={`inline-flex min-h-11 items-center rounded-full border-2 px-6 text-sm font-bold ${tankenTokens.cls.focus}`}
          style={{ background: C.card, borderColor: tankenTokens.border.soft, color: C.ink }}
        >
          地図をひらく
        </Link>
      </div>
    </div>
  )
}
