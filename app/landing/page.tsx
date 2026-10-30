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
      <main className="pb-8 pt-[64px] md:pt-0">
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

        {/* SAFE MAGAZINE */}
        <SafeMagazine />

        {/* みんなのヒヤリハット報告 */}
        <HiyariHatReport />

        {/* フッターは全画面共通のもの(components/layout/site-footer.tsx)を、ナビの包みが出す */}
      </main>
    </div>
  )
}
