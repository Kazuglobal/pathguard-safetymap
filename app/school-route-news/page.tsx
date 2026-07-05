import { getAllNewsItems } from "@/lib/school-route-news"
import { NewsFeedClient } from "@/components/school-route-news/news-feed-client"

export default function SchoolRouteNewsPage() {
  // 記事全文（content）は詳細ページ専用。フィードに直列化しない
  const items = getAllNewsItems().map(({ content, ...item }) => item)
  return <NewsFeedClient items={items} />
}
