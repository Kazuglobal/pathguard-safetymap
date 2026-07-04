import Link from "next/link"
import {
  StickyHeader,
  LandingHero,
  LandingChildRouteDashboard,
  SchoolRouteNewsSection,
  LocalSafetyAlertsSection,
  HazardMapBanner,
  FamilyTalkCard,
  SafeMagazine,
  HiyariHatReport,
} from "@/components/landing"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"
import { getLandingNewsPreview } from "@/lib/landing-news-preview"

export default function LandingPage() {
  const currentYear = new Date().getFullYear()

  const newsPreview = getLandingNewsPreview(2).map((item) => ({
    id: item.id,
    title: item.title,
    categoryLabel: item.categoryLabel,
    categoryColor: item.categoryColor,
    slug: item.slug,
  }))

  return (
    <div
      className="min-h-screen"
      style={{
        background: tankenTokens.color.paper,
        backgroundImage: PAPER_NOISE,
        fontFamily: tankenTokens.font.family,
      }}
    >
      {/* 固定ヘッダー(モバイルのみ) */}
      <StickyHeader />

      {/* メインコンテンツ */}
      <main className="pb-24 pt-[64px] md:pb-8 md:pt-0">
        {/* ヒーロー: このアプリが何かを3秒で伝える */}
        <LandingHero />

        {/* 今日の通学3分チェック(ログイン済みの毎日の入口) */}
        <LandingChildRouteDashboard newsPreview={newsPreview} />

        {/* 今日の地域アラート(声かけ・不審者情報 リアルタイム) */}
        <LocalSafetyAlertsSection />

        {/* 通学路の安全ニュース(全国・編集部選定) */}
        <SchoolRouteNewsSection />

        {/* 危険マップへの直接導線 */}
        <HazardMapBanner />

        {/* こんやの かぞく さくせんかいぎ */}
        <FamilyTalkCard />

        {/* PathGuard Press */}
        <SafeMagazine />

        {/* みんなのヒヤリハット報告 */}
        <HiyariHatReport />

        {/* フッター(モバイルボトムナビの上に余白を確保) */}
        <footer
          className="mt-8 border-t px-4 py-8 text-center"
          style={{
            background: tankenTokens.color.paperDeep,
            borderColor: tankenTokens.border.faint,
          }}
        >
          <p className="text-sm font-bold" style={{ color: tankenTokens.color.inkSoft }}>
            Path<span style={{ color: tankenTokens.color.primary }}>Guardian</span>
          </p>
          <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <Link href="/terms" className="underline-offset-4 hover:underline" style={{ color: tankenTokens.color.inkSoft }}>
              利用規約
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline" style={{ color: tankenTokens.color.inkSoft }}>
              プライバシーポリシー
            </Link>
            <Link href="/contact" className="underline-offset-4 hover:underline" style={{ color: tankenTokens.color.inkSoft }}>
              お問い合わせ
            </Link>
          </nav>
          <p className="mt-2 text-xs" style={{ color: tankenTokens.color.inkFaint }}>
            © {currentYear} PathGuardian. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  )
}
