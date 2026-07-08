"use client"

import { useRef } from "react"
import { LpHeader } from "@/components/lp/lp-header"
import { LpHero } from "@/components/lp/lp-hero"
import { LpMarquee } from "@/components/lp/lp-marquee"
import { LpProblem } from "@/components/lp/lp-problem"
import { LpPhotoAi } from "@/components/lp/lp-photo-ai"
import { LpFeatures } from "@/components/lp/lp-features"
import { LpFeatureTour } from "@/components/lp/lp-feature-tour"
import { LpVideo } from "@/components/lp/lp-video"
import { LpShowcase } from "@/components/lp/lp-showcase"
import { LpHow } from "@/components/lp/lp-how"
import { LpTrust } from "@/components/lp/lp-trust"
import { LpFaq } from "@/components/lp/lp-faq"
import { LpCtaFooter } from "@/components/lp/lp-cta-footer"
import { useLpScrollReveal } from "@/components/lp/lp-motion"

export function LpPage() {
  const scopeRef = useRef<HTMLDivElement>(null)
  useLpScrollReveal(scopeRef)

  return (
    <div ref={scopeRef} className="font-lp-body bg-[#F3EFE4] text-[#2B2723] antialiased">
      <LpHeader />
      <LpHero />
      <LpMarquee />
      <LpProblem />
      <LpPhotoAi />
      <LpFeatures />
      <LpFeatureTour />
      <LpVideo />
      <LpShowcase />
      <LpHow />
      <LpTrust />
      <LpFaq />
      <LpCtaFooter />
    </div>
  )
}
