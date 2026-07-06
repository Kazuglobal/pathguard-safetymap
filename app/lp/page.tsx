"use client"

import {
  LPNav,
  LPHero,
  LPProblem,
  LPFeatures,
  LPShowcase,
  LPCommunity,
  LPStats,
  LPTestimonials,
  LPCTA,
  LPFooter,
} from "@/components/lp"

export default function LandingPageLP() {
  return (
    <div className="min-h-screen bg-white">
      {/* ナビゲーション */}
      <LPNav />

      {/* Section 1: Hero（ファーストビュー） */}
      <LPHero />

      {/* Section 2: Problem（課題提起） */}
      <div id="problem">
        <LPProblem />
      </div>

      {/* Section 3: Features（5大機能紹介） */}
      <div id="features">
        <LPFeatures />
      </div>

      {/* Section 4: AI & 3D Showcase（技術力アピール） */}
      <div id="showcase">
        <LPShowcase />
      </div>

      {/* Section 5: Community & Gamification */}
      <div id="community">
        <LPCommunity />
      </div>

      {/* Section 6: Statistics（実績数値） */}
      <div id="stats">
        <LPStats />
      </div>

      {/* Section 7: Testimonials（利用者の声） */}
      <LPTestimonials />

      {/* Section 8: Final CTA（行動喚起） */}
      <LPCTA />

      {/* Section 9: Footer */}
      <LPFooter />
    </div>
  )
}
