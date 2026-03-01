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
    id: "news-2026-02-09-001",
    slug: "iga-city-safety-signs-donation-20260209",
    title: "三重県伊賀市で建設会社が通学路に「飛び出し注意」看板を寄贈",
    excerpt: "伊賀市の竹島建設が、阿山小・中学校への通学路となっている県道沿いに「飛び出し注意」看板10基を寄贈。地域と企業の協働による通学路安全対策の事例。",
    content: `## 寄贈の概要

三重県伊賀市玉瀧の竹島建設が2026年2月9日、同市馬場、川合の2地区に「飛び出し注意」看板を5基ずつ、計10基寄贈しました。

### 寄贈の背景

両地区を通る**県道上友田円徳院線**は、阿山小学校（馬場）や阿山中学校（千貝）への通学路になっています。

竹島建設は「現場へ向かって県道を行き来した際、危険と思う路地が複数あった」ことから、地元への寄贈を提案しました。

### 設置場所の決定

具体的な設置場所は、今後**地区役員で協議**して決める予定です。地域住民が最も必要と感じる場所に設置することで、効果的な安全対策が期待されます。

### 地域と企業の協働モデル

この事例は、通学路の安全対策における「地域と企業の協働」の好事例として注目されます。

**ポイント:**
1. **現場の気づき**: 企業が業務で地域を往来する中で危険箇所を発見
2. **自主的な提案**: 行政に頼るだけでなく、企業側から安全対策を提案
3. **地域との協議**: 設置場所は地区役員と協議し、地域の声を反映
4. **持続可能性**: 企業のCSR活動として継続的な支援の可能性

### 全国の類似事例

企業による通学路安全対策の支援は全国で広がりつつあります。

- 看板・標識の寄贈
- 見守りボランティアへの参加
- 通学路の清掃活動
- 安全教育プログラムへの協力

### 保護者・地域にできること

企業の支援を受けつつ、保護者や地域住民ができることもあります。

1. **危険箇所の共有**: 地域で気づいた危険箇所を学校・自治体に報告
2. **看板の維持管理**: 寄贈された看板が見えづらくなっていないか定期確認
3. **感謝の表明**: 協力してくれる企業への感謝を伝え、継続的な関係を構築`,
    category: "community",
    categoryLabel: "地域活動",
    categoryColor: "#22C55E",
    categoryIcon: "Users",
    publishedDate: "2026-02-09T10:00:00+09:00",
    location: {
      prefecture: "三重県",
      city: "伊賀市",
      area: "馬場、川合"
    },
    tags: ["企業寄贈", "飛び出し注意", "通学路看板", "地域協働", "三重県", "CSR活動"],
    sources: [
      "伊賀タウン情報 YOU（2026年2月10日）",
      "伊賀市教育委員会 通学路交通安全プログラム"
    ],
    keyPoints: [
      "竹島建設が通学路に「飛び出し注意」看板10基を寄贈",
      "県道上友田円徳院線は阿山小・中学校への通学路",
      "地域と企業の協働による安全対策の好事例"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/iga-safety-signs.png",
    verifiedAt: "2026-02-10T09:00:00+09:00"
  },
  {
    id: "news-2026-02-01-001",
    slug: "bicycle-blue-ticket-school-route-impact-20260201",
    title: "4月施行の自転車青切符制度、通学路への影響と対策",
    excerpt: "2026年4月から自転車にも青切符が導入。13歳未満は対象外だが、通学路での自転車ルール変更により保護者・学校の対応が急務に。",
    content: `## 改正道路交通法の概要

2026年4月1日から施行される改正道路交通法により、自転車にも「青切符」制度が導入されます。

### 主な変更点
- 自転車の交通違反に反則金制度を適用（16歳以上が対象）
- 自転車は原則として車道の左側を通行
- 通行区分違反には反則金6,000円
- 歩道通行は標識のある場所か、やむを得ない場合のみ

### 通学路への影響
- 13歳未満の児童は歩道通行が引き続き可能
- 高校生の自転車通学が大きく影響を受ける
- 保護者の送迎時の自転車利用にも注意が必要
- 通学路周辺の自転車交通量の変化が予想される

### 学校・保護者に求められる対応
- 児童への自転車安全教育の強化
- 通学路の危険箇所の再点検
- 新ルールに対応した安全指導の実施
- PTA・地域と連携した見守り体制の確認`,
    category: "policy",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-02-01T09:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["道路交通法改正", "自転車", "青切符", "通学路", "2026年4月"],
    sources: [
      "政府広報オンライン",
      "JAF交通安全トレーニング",
      "警察庁"
    ],
    keyPoints: [
      "2026年4月から自転車にも青切符制度を導入",
      "13歳未満は対象外、歩道通行は引き続き可能",
      "通学路周辺の自転車ルール変更に学校・保護者の対応が必要"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/bicycle-blue-ticket.png",
    verifiedAt: "2026-02-01T10:00:00+09:00"
  },
  {
    id: "news-2026-01-19-001",
    slug: "fukuoka-asakura-bicycle-accident-20260119",
    title: "福岡県朝倉市で自転車の小学生2人が貨物自動車にはねられ1人死亡",
    excerpt: "1月19日午後3時50分頃、朝倉市屋永の道路交差点で、自転車に乗っていた小学2年生の男児2人が貨物自動車にはねられ、1人が死亡、1人が鎖骨骨折の重傷。",
    content: `## 事故の概要

2026年1月19日午後3時50分頃、福岡県朝倉市屋永の道路で、自転車に乗っていた小学2年生の男児2人（いずれも8歳）が普通貨物自動車にはねられました。

### 被害状況
- 男児1人が頭部を打つなどして死亡
- もう1人が鎖骨を折るなど重傷を負い病院に搬送

### 事故の状況
- 現場は信号機のない交差点
- 走行中の貨物自動車と自転車に乗った男児2人が衝突
- 現場に目立ったブレーキ痕はなく、前方不注意が原因とみられる

### 逮捕
福岡県警は、自称会社役員の男（53）を過失運転致傷の疑いで現行犯逮捕しました。`,
    category: "accident",
    categoryLabel: "交通事故",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-01-19T16:30:00+09:00",
    location: {
      prefecture: "福岡県",
      city: "朝倉市",
      area: "屋永"
    },
    tags: ["交通事故", "小学生", "自転車", "死亡事故", "福岡県"],
    sources: [
      "共同通信",
      "RKBニュース",
      "福岡県警察"
    ],
    keyPoints: [
      "自転車の小学2年生2人が信号なし交差点で貨物自動車にはねられた",
      "1人死亡、1人が鎖骨骨折の重傷",
      "運転者（53歳）を現行犯逮捕、前方不注意の疑い"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/fukuoka-asakura-accident.png",
    isBreaking: true,
    verifiedAt: "2026-01-19T18:00:00+09:00"
  },
  {
    id: "news-2026-01-15-001",
    slug: "mext-school-safety-volunteer-awards-20260115",
    title: "文部科学省、学校安全ボランティア活動奨励賞の受賞団体を発表",
    excerpt: "文科省が全国のスクールガード・見守りボランティア団体を表彰。通学路の安全を支える地域活動が評価され、各地の取り組みが注目される。",
    content: `## 表彰の概要

文部科学省は、学校保健及び学校安全の普及と向上に尽力し、多大な成果をあげた個人・学校・団体等に対する表彰を実施しました。

### 学校安全ボランティア活動奨励賞
通学路の安全確保のため、以下の活動を行っている団体が受賞:
- 通学時の児童の保護・誘導
- 校内・通学路のパトロール
- 地域の見守りネットワークの構築
- 「ながら見守り」活動の推進

### 受賞の要件
- 子供を守るための実践的なボランティア活動を行っている団体
- 町内会、自治会、商店街、ボランティア団体等
- 他の規範となる活動と認められること

### 全国の見守り活動の広がり
- スクールガード登録者は全国で約100万人
- 「ながら見守り」活動が各自治体で推進
- 地域全体で子どもを見守る体制が拡充`,
    category: "community",
    categoryLabel: "地域活動",
    categoryColor: "#22C55E",
    categoryIcon: "Users",
    publishedDate: "2026-01-15T12:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["文部科学省", "スクールガード", "見守り", "ボランティア", "表彰"],
    sources: [
      "文部科学省",
      "登下校見守り活動ハンドブック（文科省）"
    ],
    keyPoints: [
      "文科省がスクールガード・見守り団体を表彰",
      "全国のスクールガード登録者は約100万人",
      "「ながら見守り」活動が各自治体で拡大中"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/mext-volunteer-awards.png",
    verifiedAt: "2026-01-16T09:00:00+09:00"
  },
  {
    id: "news-2025-06-17-001",
    slug: "zone30plus-263-districts-expansion-20250617",
    title: "国交省「ゾーン30プラス」全国263地区への展開を発表",
    excerpt: "国土交通省は2025年6月、新たに77地区の整備計画を策定。既存186地区と合わせ全国263地区での展開を予定。速度規制と物理的デバイスを組み合わせた通学路の安全対策を推進。",
    content: `## ゾーン30プラスとは

国土交通省と警察庁は連携し、生活道路における歩行者優先の安全空間を確保する「ゾーン30プラス」の整備を全国で推進しています。

### 最新の整備状況

- **2025年3月末時点**: 全国186地区で「ゾーン30プラス」を導入済み
- **2025年6月17日**: 国土交通省が新たに77地区の整備計画を発表
- **今後の展開**: 全国263地区での展開を予定

### ゾーン30プラスの仕組み
- 最高速度30km/hの区域規制（警察）
- ハンプ・狭さくなどの物理的デバイスの設置（道路管理者）
- 両者の組み合わせにより、生活道路を人優先の安全空間に

### 従来のゾーン30との違い
従来の「ゾーン30」（2024年度末時点で全国4,410地区で実施）は速度規制のみでしたが、「ゾーン30プラス」はハンプや狭さくなどの物理的デバイスを組み合わせることで、より確実な速度抑制効果が期待されます。

### 通学路への効果
- ETC2.0プローブデータを活用した交通実態の分析
- 道路管理者・警察・学校・教育委員会・PTAの連携
- 速度抑制・進入抑制のための物理的対策の実施
- 国庫補助等による経済的支援`,
    category: "infrastructure",
    categoryLabel: "インフラ整備",
    categoryColor: "#3B82F6",
    categoryIcon: "Construction",
    publishedDate: "2025-06-17T10:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["ゾーン30プラス", "国土交通省", "警察庁", "通学路", "速度規制"],
    sources: [
      "国土交通省 報道発表資料（2025年6月17日）",
      "警察庁",
      "東京海上ディーアール コラム"
    ],
    keyPoints: [
      "2025年3月末時点で全国186地区に導入済み",
      "新たに77地区の整備計画を策定、計263地区へ展開予定",
      "速度30km/h規制と物理的デバイスの組み合わせで安全確保"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/zone30plus-model.png",
    verifiedAt: "2025-06-18T09:00:00+09:00"
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
