import Link from "next/link"
import type { ReactNode } from "react"

import { BrandLogo } from "@/components/brand/brand-logo"
import { Lupe } from "@/components/brand/lupe"
import { SiteFooter } from "@/components/layout/site-footer"
import { BRAND } from "@/lib/brand"
import { tankenTokens } from "@/lib/design/tanken"
import { PRODUCT_FACTS } from "@/lib/product-facts"

const C = tankenTokens.color

/**
 * ログイン・新規登録・パスワードの再設定の画面の外枠(UIUX改装 項目1・15・32)。
 * 上にロゴと「PathGuardianとは」(紹介HP /lp へ)、下に共通のフッター。
 * intro を付けると、1行の紹介・「無料・インストール不要」・相棒のルペを見出しの上に出す。
 */
export function AuthShell({
  title,
  titleTestId,
  intro = false,
  children,
}: {
  title: string
  titleTestId?: string
  intro?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: C.paper, color: C.ink }}>
      <header className="border-b" style={{ borderColor: tankenTokens.border.faint, background: "rgba(251,245,233,.94)" }}>
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Link href="/lp" aria-label={`${BRAND.name}の紹介ページへ`} className={`inline-flex rounded-lg ${tankenTokens.cls.focus}`}>
            <BrandLogo size="sm" />
          </Link>
          <Link
            href="/lp"
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold underline-offset-4 hover:underline ${tankenTokens.cls.focus}`}
            style={{ color: C.primaryStrong }}
          >
            {BRAND.name}とは
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          {intro && (
            <section
              aria-label={`${BRAND.name}について`}
              className="mb-6 flex items-center gap-3 rounded-[18px] border p-4"
              style={{ background: C.card, borderColor: tankenTokens.border.soft, boxShadow: tankenTokens.shadow.soft }}
              data-testid="auth-intro"
            >
              <Lupe size="sm" mood="happy" decorative />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-relaxed">{PRODUCT_FACTS.tagline}</p>
                <p
                  className="mt-2 inline-flex rounded-full border px-3 py-0.5 text-xs font-black"
                  style={{ background: C.sunSoft, borderColor: "rgba(226,168,18,.45)", color: C.ink }}
                >
                  {PRODUCT_FACTS.freeNoInstall}
                </p>
              </div>
            </section>
          )}
          <h1 className="text-2xl font-black" data-testid={titleTestId}>
            {title}
          </h1>
          <div className="mt-4">{children}</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
