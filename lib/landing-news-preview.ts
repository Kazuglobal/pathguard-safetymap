export interface LandingNewsPreviewItem {
  id: string
  slug: string
  title: string
  categoryLabel: string
  categoryColor: string
  categoryIcon: string
  publishedDate: string
  location: {
    prefecture: string
    city?: string
  }
  thumbnailUrl?: string
  isBreaking?: boolean
}

const LANDING_NEWS_PREVIEW_ITEMS: LandingNewsPreviewItem[] = [
  {
    id: "news-2026-04-20-001",
    slug: "kitakyushu-kokurakita-izumidai-suspicious-sns-20260420",
    title: "【福岡県北九州市】小倉北区泉台で女児ら「SNSにのせる」とスマホで撮影される事案—40〜50代男が原付で接近",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-04-20T15:00:00+09:00",
    location: {
      prefecture: "福岡県",
      city: "北九州市",
    },
    thumbnailUrl: "/images/school-route-news/thumbnails/tokyo-suspicious-20260206.png",
    isBreaking: true,
  },
  {
    id: "news-2026-04-17-001",
    slug: "hakodate-aoyagi-candy-handover-20260417",
    title: "【北海道函館市】青柳町で女子児童に「あげる」と菓子を手渡す不審者事案—中日ドラゴンズユニフォーム姿の男",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-04-17T14:00:00+09:00",
    location: {
      prefecture: "北海道",
      city: "函館市",
    },
    thumbnailUrl: "/images/school-route-news/thumbnails/spring-suspicious-alert.png",
    isBreaking: true,
  },
  {
    id: "news-2026-04-06-001",
    slug: "spring-traffic-safety-2026-launch-20260406",
    title: "【全国】令和8年春の全国交通安全運動が4月6日スタート—通学路の歩行者保護を最重点に取り締まり強化",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-04-06T08:00:00+09:00",
    location: {
      prefecture: "全国",
    },
    thumbnailUrl: "/images/school-route-news/thumbnails/national-spring-traffic-safety-campaign-20260330.png",
  },
  {
    id: "news-2026-04-01-001",
    slug: "bicycle-blue-ticket-enforcement-start-20260401",
    title: "【全国】自転車「青切符」制度が4月1日施行—16歳以上の通学・通勤に新ルール、反則金最大12,000円",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-04-01T08:00:00+09:00",
    location: {
      prefecture: "全国",
    },
    thumbnailUrl: "/images/school-route-news/thumbnails/bicycle-blue-ticket.png",
  },
  {
    id: "news-2026-03-30-001",
    slug: "national-spring-traffic-safety-campaign-20260330",
    title: "【全国】令和8年春の全国交通安全運動（4/6〜4/15）—通学路・こどもの安全確保を第一重点に",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-03-30T09:00:00+09:00",
    location: {
      prefecture: "全国",
    },
    thumbnailUrl: "/images/school-route-news/thumbnails/national-spring-traffic-safety-campaign-20260330.png",
    isBreaking: true,
  },
]

export function getLandingNewsPreview(count = 5): LandingNewsPreviewItem[] {
  return LANDING_NEWS_PREVIEW_ITEMS.slice(0, count)
}

export function formatLandingNewsDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
