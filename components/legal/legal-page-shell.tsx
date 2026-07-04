import type { ReactNode } from "react"
import Link from "next/link"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

const LEGAL_NAV = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/contact", label: "お問い合わせ" },
]

/**
 * 法務ページ(利用規約・プライバシーポリシー・お問い合わせ)共通の枠。
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
      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
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
        <p className="mt-2 text-xs" style={{ color: tankenTokens.color.inkFaint }}>
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

        <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-bold underline-offset-4 hover:underline"
              style={{ color: tankenTokens.color.primaryStrong }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}

/** 各ページ内の見出し(h2相当)。 */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold" style={{ color: tankenTokens.color.primaryStrong }}>
        {title}
      </h2>
      <div className="mt-2 space-y-2" style={{ color: tankenTokens.color.inkSoft }}>
        {children}
      </div>
    </section>
  )
}
