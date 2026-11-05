import type { MetadataRoute } from "next"
import { getAllArticles } from "@/lib/safe-magazine"
import { getAllNewsItems } from "@/lib/school-route-news"
import { STATIC_SITEMAP_PAGES, absoluteUrl } from "@/lib/seo"

// /sitemap.xml。記事のデータを読むので EDITORIAL の Worker に振り分ける(open-next.config.ts・cloudflare/router-paths.ts)
function toDate(value: string): Date | undefined {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = STATIC_SITEMAP_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
  const news: MetadataRoute.Sitemap = getAllNewsItems().map((item) => ({
    url: absoluteUrl(`/school-route-news/${item.slug}`),
    lastModified: toDate(item.verifiedAt ?? item.publishedDate),
    changeFrequency: "monthly",
    priority: 0.6,
  }))
  const magazine: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: absoluteUrl(`/safe-magazine/${article.slug}`),
    lastModified: toDate(article.publishedDate),
    changeFrequency: "monthly",
    priority: 0.6,
  }))
  return [...pages, ...news, ...magazine]
}
