import type { Metadata } from "next"
import { LpPage } from "@/components/lp/lp-page"
import { BRAND } from "@/lib/brand"
import { LP_FAQ, LP_FEATURES, LP_META } from "@/lib/lp-content"
import { SEO_KEYWORDS, buildLpJsonLd, jsonLdString } from "@/lib/seo"

export const metadata: Metadata = {
  // ルートの書式(「〜 | PathGuardian」)を通さない
  title: { absolute: LP_META.title },
  description: LP_META.description,
  keywords: [...SEO_KEYWORDS],
  // / は /lp へ恒久的に移すので、正規の URL は /lp
  alternates: { canonical: "/lp" },
  openGraph: {
    title: LP_META.title,
    description: LP_META.description,
    type: "website",
    url: "/lp",
    siteName: BRAND.name,
    locale: "ja_JP",
    images: [{ url: LP_META.ogImage, width: 1200, height: 675, alt: LP_META.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: LP_META.title,
    description: LP_META.description,
    images: [LP_META.ogImage],
  },
}

// 構造化データは画面に見えている内容(説明・機能の名前・よくある質問)と同じにする
const jsonLd = buildLpJsonLd({
  description: LP_META.description,
  faq: LP_FAQ,
  features: LP_FEATURES.map((feature) => feature.title),
})

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <LpPage />
    </>
  )
}
