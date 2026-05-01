import {
  StickyHeader,
  LandingChildRouteDashboard,
  HeroCarousel,
  SchoolRouteNewsSection,
  LocalSafetyAlertsSection,
  HazardMapBanner,
  StoreSection,
  SafeMagazine,
  HiyariHatReport,
} from "@/components/landing"
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
    <div className="min-h-screen bg-white">
      {/* 固定ヘッダー */}
      <StickyHeader />

      {/* メインコンテンツ */}
      <main className="pt-[104px] md:pt-4 pb-24 md:pb-8">
        <LandingChildRouteDashboard newsPreview={newsPreview} />

        {/* ヒーローカルーセル */}
        <section data-testid="hero-section" className="py-4">
          <HeroCarousel />
        </section>
        {/* 今日の地域アラート（声かけ・不審者情報 リアルタイム） */}
        <LocalSafetyAlertsSection />

        {/* 通学路の安全ニュース（全国・編集部選定） */}
        <SchoolRouteNewsSection />

        {/* 危険マップ誘導バナー */}
        <HazardMapBanner />

        {/* 通学・見守りストア */}
        <StoreSection />

        {/* PathGuard Press */}
        <SafeMagazine />

        {/* みんなのヒヤリハット報告 */}
        <HiyariHatReport />

        {/* フッター（モバイルボトムナビの上に余白を確保） */}
        <footer className="mt-8 py-8 px-4 bg-gray-900 text-center">
          <p className="text-sm text-gray-400">
            © {currentYear} PathGuardian. All rights reserved.
          </p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">
              利用規約
            </a>
            <a href="#" className="hover:text-gray-300 transition-colors">
              プライバシーポリシー
            </a>
            <a href="#" className="hover:text-gray-300 transition-colors">
              お問い合わせ
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
