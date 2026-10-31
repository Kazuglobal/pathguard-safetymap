import type { ReactNode } from "react"

import { SiteFooter } from "@/components/layout/site-footer"

// /accidents は共通のナビの外(LayoutProvider がそのまま通す)なので、共通のフッターだけここで出す(UIUX改装 項目32)
export default function AccidentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
