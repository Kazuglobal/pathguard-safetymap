"use client"

import { useEffect, type RefObject } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * LP共通のスクロール演出。
 * scope配下の [data-reveal] を下からフェードイン、
 * [data-reveal-group] は子要素をstaggerで順次表示する。
 * prefers-reduced-motion 時はアニメーションせず即表示。
 */
export function useLpScrollReveal(scopeRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = scopeRef.current
    if (!scope) return

    const mm = gsap.matchMedia()

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const singles = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll("[data-reveal]"))
      for (const el of singles) {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 48 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        )
      }

      const groups = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll("[data-reveal-group]"))
      for (const group of groups) {
        const items = Array.from(group.children)
        if (items.length === 0) continue
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: { trigger: group, start: "top 85%", once: true },
          },
        )
      }

      const parallaxItems = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll("[data-parallax]"))
      for (const el of parallaxItems) {
        const speed = Number(el.dataset.parallax || "0.15")
        gsap.to(el, {
          yPercent: speed * -100,
          ease: "none",
          scrollTrigger: {
            trigger: el.parentElement ?? el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        })
      }
    })

    mm.add("(prefers-reduced-motion: reduce)", () => {
      const hidden = scope.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group] > *")
      for (const el of hidden) {
        el.style.opacity = "1"
        el.style.visibility = "visible"
        el.style.transform = "none"
      }
    })

    return () => {
      mm.revert()
    }
  }, [scopeRef])
}
