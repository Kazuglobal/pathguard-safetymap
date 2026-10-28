import { Search } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * きけんハンターを ひらくまでの待ち画面(page.tsx を包む Suspense の fallback)。
 *
 * page.tsx はログイン確認(Supabase)を待ち、本番では専用の Worker が担当するので、
 * 起動したてだと表示まで数秒かかる。待ち画面が無いと、中央ボタンのシートで
 * 「きけんハンターを はじめる」を押しても、前の画面のまま何も起きないように見えていた。
 * シートを開いた時点でこの画面まで先読み(router.prefetch)しているので、押した直後に切り替わる。
 *
 * 先読みと最初の表示を軽くするため、サーバーコンポーネントのまま描き、
 * framer-motion を使う Mascot(components/safety-quest/hunter/theme.tsx)は読み込まない。
 * layout.tsx は `display: contents` なので、この画面がそのまま全面をおおう。
 */
export default function HunterLoading() {
  return (
    <div
      className="paper-surface flex min-h-[100dvh] w-full items-center justify-center px-6 py-10"
      style={{ fontFamily: tankenTokens.font.family }}
    >
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-center">
        <span className="relative grid h-16 w-16 place-items-center" aria-hidden="true">
          <span
            className="absolute inset-0 animate-spin rounded-full border-4 motion-reduce:animate-none"
            style={{ borderColor: C.primarySoft, borderTopColor: C.primary }}
          />
          <span
            className="grid h-11 w-11 place-items-center rounded-full border-2"
            style={{ background: C.sun, borderColor: tankenTokens.border.soft, boxShadow: tankenTokens.shadow.pressSun }}
          >
            <Search className="h-5 w-5" style={{ color: C.ink }} strokeWidth={2.8} />
          </span>
        </span>
        <p className="text-[16px] font-black leading-relaxed" style={{ color: C.ink, wordBreak: "keep-all" }}>
          きけんハンターを じゅんびしているよ…
        </p>
      </div>
    </div>
  )
}
