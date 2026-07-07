import type { Metadata } from "next"
import { LpPage } from "@/components/lp/lp-page"
import { LP_META } from "@/lib/lp-content"

export const metadata: Metadata = {
  title: LP_META.title,
  description: LP_META.description,
  openGraph: {
    title: LP_META.title,
    description: LP_META.description,
    type: "website",
    images: [{ url: LP_META.ogImage, width: 1200, height: 675 }],
  },
  twitter: {
    card: "summary_large_image",
    title: LP_META.title,
    description: LP_META.description,
    images: [LP_META.ogImage],
  },
}

export default function Page() {
  return <LpPage />
}
