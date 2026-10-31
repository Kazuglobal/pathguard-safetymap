import Link from "next/link"
import type { CSSProperties } from "react"

import { BrandLogo } from "@/components/brand/brand-logo"
import { BRAND } from "@/lib/brand"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/** フッターの決まったリンク(地図のメニューなど、フッターを出せない画面でも同じものを出す) */
export const SITE_FOOTER_LINKS = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/contact", label: "お問い合わせ" },
] as const

/** 運営者の表記(受け取るまでは準備中。UIUX改装 項目4) */
export const OPERATOR_LABEL = BRAND.operator ? `運営: ${BRAND.operator}` : "運営者の表記は準備中です"

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x={3} y={3} width={18} height={18} rx={5} />
      <circle cx={12} cy={12} r={4} />
      <circle cx={17.5} cy={6.5} r={1} fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 公式 Instagram へのリンク(項目41)。新しいタブで開く */
export function InstagramLink({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <a
      href={BRAND.instagram.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`公式Instagram ${BRAND.instagram.handle}(新しいタブで開きます)`}
      className={`inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline ${tankenTokens.cls.focus} ${className}`}
      style={style}
    >
      <InstagramIcon />
      <span>Instagram {BRAND.instagram.handle}</span>
    </a>
  )
}

/**
 * どの画面にも出す共通のフッター(UIUX改装 項目32・41)。規約・プライバシー・お問い合わせ・公式 Instagram・運営者の表記。
 * 画面ごとに出すかは lib/navigation-visibility.ts の shouldShowSiteFooter が決める。
 */
export function SiteFooter({ reserveBottomNav = false }: { reserveBottomNav?: boolean }) {
  const year = new Date().getFullYear()
  return (
    <footer
      // スマホの下部タブバーが重なる画面では、その高さぶん下を空ける。
      // relative z-10: 画面に固定の飾り(セーフティクエストの角など)の下に隠れないようにする
      className={`relative z-10 border-t px-4 pt-6 text-center ${reserveBottomNav ? "pb-28 lg:pb-8" : "pb-8"}`}
      style={{ background: C.paperDeep, borderColor: tankenTokens.border.faint, color: C.inkSoft }}
      data-testid="site-footer"
    >
      <Link href="/landing" aria-label={`${BRAND.name}のホーム`} className={`inline-flex rounded-lg ${tankenTokens.cls.focus}`}>
        <BrandLogo size="sm" showDescriptor />
      </Link>
      <nav aria-label="サイトの情報" className="mt-3 flex flex-wrap items-center justify-center gap-x-5 text-sm font-bold">
        {SITE_FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex min-h-11 items-center underline-offset-4 hover:underline ${tankenTokens.cls.focus}`}
            style={{ color: C.inkSoft }}
          >
            {link.label}
          </Link>
        ))}
        <InstagramLink style={{ color: C.inkSoft }} />
      </nav>
      <p className="mt-2 text-xs">{OPERATOR_LABEL}</p>
      {/* 年はサーバー(UTC・ビルドの時点)とブラウザ(日本時間)で年明けにずれることがあるので、食い違いを警告しない */}
      <p className="mt-1 text-xs" suppressHydrationWarning>
        © {year} {BRAND.name}
      </p>
    </footer>
  )
}
