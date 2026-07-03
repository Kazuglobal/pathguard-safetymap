"use client"

/**
 * はじめての絵本オンボーディングを、初回のアプリ入場時に一度だけ出すゲート。
 * 認証ページや管理画面では出さない。表示済みかは lib/tutorial-storage が管理する。
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import AppOnboarding from "@/components/onboarding/app-onboarding"
import { shouldShowTutorial } from "@/lib/tutorial-storage"

const SHOW_ON_PATHS = ["/", "/landing", "/map", "/routes", "/mypage"]

export function AppOnboardingGate() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const eligible = SHOW_ON_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  )

  useEffect(() => {
    if (!eligible || !shouldShowTutorial()) return
    const timer = setTimeout(() => setOpen(true), 700)
    return () => clearTimeout(timer)
  }, [eligible])

  if (!eligible) return null

  return <AppOnboarding open={open} onClose={() => setOpen(false)} />
}
