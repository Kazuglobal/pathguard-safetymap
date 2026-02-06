// 通学路の安全ニュース データユーティリティ

export interface SchoolRouteNewsItem {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: NewsCategory
  categoryLabel: string
  categoryColor: string
  categoryIcon: string
  publishedDate: string
  location: {
    prefecture: string
    city?: string
    area?: string
  }
  tags: string[]
  sources: string[]
  keyPoints: string[]
  thumbnailUrl?: string
  isBreaking?: boolean
  verifiedAt?: string
}

export type NewsCategory = "accident" | "suspicious" | "infrastructure" | "policy" | "community"

// カテゴリーの定義
export const NEWS_CATEGORIES = {
  "accident": {
    label: "交通事故",
    color: "#EF4444",
    bgColor: "bg-red-500",
    textColor: "text-red-600",
    bgLight: "bg-red-50",
    icon: "AlertTriangle"
  },
  "suspicious": {
    label: "不審者情報",
    color: "#F97316",
    bgColor: "bg-orange-500",
    textColor: "text-orange-600",
    bgLight: "bg-orange-50",
    icon: "AlertCircle"
  },
  "infrastructure": {
    label: "インフラ整備",
    color: "#3B82F6",
    bgColor: "bg-blue-500",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    icon: "Construction"
  },
  "policy": {
    label: "施策・対策",
    color: "#8B5CF6",
    bgColor: "bg-purple-500",
    textColor: "text-purple-600",
    bgLight: "bg-purple-50",
    icon: "FileText"
  },
  "community": {
    label: "地域活動",
    color: "#22C55E",
    bgColor: "bg-green-500",
    textColor: "text-green-600",
    bgLight: "bg-green-50",
    icon: "Users"
  }
} as const

// サンプルニュースデータ（実際はAPIから取得）
export const NEWS_ITEMS: SchoolRouteNewsItem[] = [
  {
    id: "news-2026-02-06-001",
    slug: "fukuoka-chikushino-accident-20260206",
    title: "福岡県筑紫野市で下校中の小学生4人が車にはねられる",
    excerpt: "2月6日午後3時半頃、筑紫野市針摺西の市道で、下校中の小学生4人が軽乗用車にはねられました。全員意識あり、うち1人が骨折の重傷。",
    content: `## 事故の概要

2月6日午後3時半頃、福岡県筑紫野市針摺西の市道で、74歳女性が運転する軽乗用車が下校中の小学生の列に突っ込む事故が発生しました。

### 被害状況
- 小学3年生の男児4人が病院に搬送
- うち1人が骨折の重傷
- 全員意識があり、命に別条なし
- 運転手の女性も軽傷

### 現場の状況
- 現場は住宅街の見通しの良い直線道路
- 歩道と車道の区別がない道路
- 事故当時、見守りボランティアは不在

### 警察の対応
警察は運転手の女性から事情を聴取中。自動車運転処罰法違反（過失傷害）の疑いで捜査を進めています。`,
    category: "accident",
    categoryLabel: "交通事故",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-02-06T16:30:00+09:00",
    location: {
      prefecture: "福岡県",
      city: "筑紫野市",
      area: "針摺西"
    },
    tags: ["交通事故", "小学生", "下校中", "福岡県"],
    sources: [
      "NHK福岡放送局",
      "西日本新聞",
      "福岡県警察"
    ],
    keyPoints: [
      "下校中の小学生4人が車にはねられた",
      "1人が骨折の重傷、全員命に別条なし",
      "歩道のない住宅街の道路で発生"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/fukuoka-accident-20260206.png",
    isBreaking: true,
    verifiedAt: "2026-02-06T17:00:00+09:00"
  },
  {
    id: "news-2026-02-06-002",
    slug: "tokyo-setagaya-suspicious-20260206",
    title: "東京都世田谷区で登校中の児童に不審者が声かけ",
    excerpt: "2月6日午前7時45分頃、世田谷区内の通学路で、登校中の小学生に男が「一緒に遊ぼう」と声をかける事案が発生。児童は走って逃げ、無事。",
    content: `## 事案の概要

2月6日午前7時45分頃、東京都世田谷区の通学路で、登校中の小学4年生女児に不審な男が声をかける事案が発生しました。

### 詳細
- 女児が1人で登校中、後ろから男に声をかけられた
- 男は「一緒に遊ぼう」「お菓子をあげる」などと声をかけた
- 女児はすぐに走って逃げ、近くの「こども110番の家」に駆け込んだ
- 男はその後いなくなった

### 不審者の特徴
- 年齢：30〜40代
- 身長：170cm前後
- 服装：黒のジャンパー、紺色のズボン
- 特徴：黒縁メガネ

### 警察・学校の対応
- 警察がパトロールを強化
- 学校から保護者に注意喚起のメール配信
- 見守りボランティアの増員を要請`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-02-06T10:00:00+09:00",
    location: {
      prefecture: "東京都",
      city: "世田谷区"
    },
    tags: ["不審者", "声かけ", "小学生", "東京都"],
    sources: [
      "警視庁",
      "世田谷区教育委員会"
    ],
    keyPoints: [
      "登校中の女児に男が「一緒に遊ぼう」と声かけ",
      "児童は「こども110番の家」に逃げ込み無事",
      "警察がパトロール強化中"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/tokyo-suspicious-20260206.png",
    verifiedAt: "2026-02-06T11:00:00+09:00"
  },
  {
    id: "news-2026-02-05-001",
    slug: "osaka-sakai-guardrail-20260205",
    title: "大阪府堺市、通学路に新たにガードレール200m設置",
    excerpt: "堺市は、市内の危険通学路に新たにガードレール200mを設置完了。昨年の一斉点検で「対策必要」と判定された箇所の安全対策。",
    content: `## 整備の概要

大阪府堺市は2月5日、市内堺区の通学路にガードレール約200mの設置工事を完了したと発表しました。

### 整備内容
- 設置場所：堺市堺区○○町の市道
- 延長：約200m
- 工事費：約800万円
- 工期：2026年1月15日〜2月5日

### 背景
- 2021年の全国一斉点検で「危険箇所」と判定
- 歩道がなく、車両の通行量が多い
- 過去3年間で軽微な接触事故が2件発生
- 地域住民・PTAからの要望

### 今後の予定
市は2026年度中に市内10箇所の危険通学路の整備を完了する予定。`,
    category: "infrastructure",
    categoryLabel: "インフラ整備",
    categoryColor: "#3B82F6",
    categoryIcon: "Construction",
    publishedDate: "2026-02-05T14:00:00+09:00",
    location: {
      prefecture: "大阪府",
      city: "堺市",
      area: "堺区"
    },
    tags: ["ガードレール", "インフラ整備", "通学路", "大阪府"],
    sources: [
      "堺市役所",
      "産経新聞"
    ],
    keyPoints: [
      "危険通学路にガードレール200m設置完了",
      "2021年の一斉点検で判定された箇所",
      "2026年度中に市内10箇所を整備予定"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/osaka-guardrail-20260205.png",
    verifiedAt: "2026-02-05T15:00:00+09:00"
  }
]

// ニュースをスラッグで取得
export function getNewsItemBySlug(slug: string): SchoolRouteNewsItem | undefined {
  return NEWS_ITEMS.find(item => item.slug === slug)
}

// すべてのニュースを取得（新しい順）
export function getAllNewsItems(): SchoolRouteNewsItem[] {
  return [...NEWS_ITEMS].sort((a, b) =>
    new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  )
}

// カテゴリでニュースをフィルタ
export function getNewsItemsByCategory(category: NewsCategory): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.category === category)
}

// 都道府県でニュースをフィルタ
export function getNewsItemsByPrefecture(prefecture: string): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.location.prefecture === prefecture)
}

// 速報ニュースを取得
export function getBreakingNews(): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.isBreaking)
}

// 最新N件を取得
export function getLatestNews(count: number = 5): SchoolRouteNewsItem[] {
  return getAllNewsItems().slice(0, count)
}

// 日付をフォーマット
export function formatNewsDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) {
    return "たった今"
  } else if (diffHours < 24) {
    return `${diffHours}時間前`
  } else if (diffDays < 7) {
    return `${diffDays}日前`
  } else {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }
}

// 相対時間を取得
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return `${diffMins}分前`
  } else if (diffHours < 24) {
    return `${diffHours}時間前`
  } else {
    return `${diffDays}日前`
  }
}
