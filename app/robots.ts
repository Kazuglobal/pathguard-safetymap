import type { MetadataRoute } from "next"
import { ROBOTS_ALLOW, ROBOTS_DISALLOW, SITE_URL, absoluteUrl } from "@/lib/seo"

// /robots.txt。ログインが要る画面・API は検索に出さない(cloudflare の振り分けは CORE)
// ただし公開ページの描画に使う読み取り専用API(ROBOTS_ALLOW)は最長一致ルールで許可する
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: [...ROBOTS_ALLOW], disallow: [...ROBOTS_DISALLOW] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  }
}
