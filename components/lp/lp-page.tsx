"use client"

import { useRef } from "react"
import { LpHeader } from "@/components/lp/lp-header"
import { LpHero } from "@/components/lp/lp-hero"
import { LpProblem } from "@/components/lp/lp-problem"
import { LpFeatures } from "@/components/lp/lp-features"
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
    <div ref={scopeRef} className="font-lp-body bg-[#FBF9F5] text-[#16233A] antialiased">
      <LpHeader />
      <LpHero />
      <LpProblem />
      <LpFeatures />
      <LpVideo />
      <LpShowcase />
      <LpHow />
      <LpTrust />
      <LpFaq />
      <LpCtaFooter />
    </div>
  )
}
