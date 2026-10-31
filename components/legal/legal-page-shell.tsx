import type { ReactNode } from "react"
import Link from "next/link"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

/**
 * 法務ページ(利用規約・プライバシーポリシー・お問い合わせ)共通の枠。
 * 3つのページへのリンクは、共通のフッター(components/layout/site-footer.tsx)が出す。
 * NavigationWrapper の <main> の中に入るので、ここでは <main> を使わない。
 * デザインは「たんけんノート」トークンに合わせたシンプルな静的レイアウト。
 */
export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: tankenTokens.color.paper,
        backgroundImage: PAPER_NOISE,
        fontFamily: tankenTokens.font.family,
        color: tankenTokens.color.ink,
      }}
    >
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link
          href="/landing"
          className="text-sm font-bold"
          style={{ color: tankenTokens.color.primary }}
        >
          ← PathGuardian トップへ戻る
        </Link>

        <h1 className="mt-6 text-2xl font-bold sm:text-3xl" style={{ color: tankenTokens.color.ink }}>
          {title}
        </h1>
        <p className="mt-2 text-xs" style={{ color: tankenTokens.color.inkSoft }}>
          最終更新日: {updatedAt}
        </p>

        <div
          className="prose-legal mt-8 space-y-8 rounded-2xl border p-6 text-sm leading-relaxed sm:p-8"
          style={{
            background: tankenTokens.color.card,
            borderColor: tankenTokens.border.faint,
            boxShadow: tankenTokens.shadow.card,
            color: tankenTokens.color.ink,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** 各ページ内の見出し(h2相当)。 */
export function LegalSection({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={id ? "scroll-mt-24" : undefined}>
      <h2 className="text-base font-bold" style={{ color: tankenTokens.color.primaryStrong }}>
        {title}
      </h2>
      <div className="mt-2 space-y-2" style={{ color: tankenTokens.color.inkSoft }}>
        {children}
      </div>
    </section>
  )
}
