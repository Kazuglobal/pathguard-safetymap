import type { MetadataRoute } from "next"
import { ROBOTS_DISALLOW, SITE_URL, absoluteUrl } from "@/lib/seo"

// /robots.txt。ログインが要る画面・API は検索に出さない(cloudflare の振り分けは CORE)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  }
}
