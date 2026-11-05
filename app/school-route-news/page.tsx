import type { Metadata } from "next"
import { getAllNewsItems } from "@/lib/school-route-news"
import { NewsFeedClient } from "@/components/school-route-news/news-feed-client"
import { BRAND } from "@/lib/brand"

const DESCRIPTION =
  "全国の通学路の事故・不審者情報・防犯や制度のニュースを、都道府県ごとのアラートと「今日、家族で何を話すか」のひとことを添えてまとめています。"

export const metadata: Metadata = {
  title: `${BRAND.news}(事故・不審者・防犯の情報)`,
  description: DESCRIPTION,
  alternates: { canonical: "/school-route-news" },
  openGraph: { title: `${BRAND.news}｜${BRAND.name}`, description: DESCRIPTION, url: "/school-route-news", type: "website" },
}

export default function SchoolRouteNewsPage() {
  // 記事全文（content）は詳細ページ専用。フィードに直列化しない
  const items = getAllNewsItems().map(({ content, ...item }) => item)
  return <NewsFeedClient items={items} />
}
