"use client"

import { useState, useEffect } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import {
  StickyHeader,
  HeroCarousel,
  SchoolRouteNewsSection,
  HazardMapBanner,
  StoreSection,
  SafeMagazine,
  HiyariHatReport,
  SafetyScoreDashboard,
} from "@/components/landing"

export default function LandingPage() {
  const currentYear = new Date().getFullYear()
  const { supabase } = useSupabase()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let isMounted = true

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (isMounted) setIsLoggedIn(!!user)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (isMounted) setIsLoggedIn(!!session?.user)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <div className="min-h-screen bg-white">
      {/* 固定ヘッダー */}
      <StickyHeader />

      {/* メインコンテンツ */}
      <main className="pt-[104px] md:pt-4 pb-24 md:pb-8">
        {/* パーソナライズダッシュボード（安全スコア・ミッション・CTA） */}
        <SafetyScoreDashboard isLoggedIn={isLoggedIn} />

        {/* ヒーローカルーセル */}
        <section className="py-4">
          <HeroCarousel />
        </section>

        {/* 通学路の安全ニュース（リアルタイム） */}
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
