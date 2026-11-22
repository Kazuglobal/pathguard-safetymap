import type { MetadataRoute } from "next"
import { getAllArticles } from "@/lib/safe-magazine"
import { getAllNewsItems } from "@/lib/school-route-news"
import { STATIC_SITEMAP_PAGES, absoluteUrl } from "@/lib/seo"

// /sitemap.xml。記事のデータを読むので EDITORIAL の Worker に振り分ける(open-next.config.ts・cloudflare/router-paths.ts)
function toDate(value: string): Date | undefined {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function latestDate(dates: Array<Date | undefined>): Date | undefined {
  let latest: Date | undefined
  for (const date of dates) {
    if (!date) continue
    if (!latest || date.getTime() > latest.getTime()) latest = date
  }
  return latest
}

export default function sitemap(): MetadataRoute.Sitemap {
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
  const latestNewsDate = latestDate(news.map((entry) => (entry.lastModified instanceof Date ? entry.lastModified : undefined)))
  const latestMagazineDate = latestDate(magazine.map((entry) => (entry.lastModified instanceof Date ? entry.lastModified : undefined)))
  const latestContentDate = latestDate([latestNewsDate, latestMagazineDate])

  const pages: MetadataRoute.Sitemap = STATIC_SITEMAP_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified:
      page.path === "/school-route-news"
        ? latestNewsDate
        : page.path === "/safe-magazine"
          ? latestMagazineDate
          : page.path === "/landing"
            ? latestContentDate
            : undefined,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
  return [...pages, ...news, ...magazine]
}
