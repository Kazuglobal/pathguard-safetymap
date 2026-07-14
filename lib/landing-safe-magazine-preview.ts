export interface LandingSafeMagazinePreviewItem {
  id: string
  slug: string
  title: string
  excerpt: string
  categoryLabel: string
  categoryColor: string
  categoryIcon: string
  publishedDate: string
  thumbnailUrl?: string
}

const LANDING_SAFE_MAGAZINE_PREVIEW_ITEMS: LandingSafeMagazinePreviewItem[] = [
  {
    id: "2026-07-14-gifu-mizuho-crosswalk-accident",
    slug: "gifu-mizuho-crosswalk-accident",
    title: "【7月・岐阜】信号のない横断歩道で登校中事故、自転車通学の見えない危険",
    excerpt: "岐阜県瑞穂市で、信号機のない横断歩道を自転車で渡っていた登校中の女子中学生が軽乗用車にはねられ、意識不明の重体となりました。信号のない交差点はどの通学路にもあり得る「見えない危険」です。今日から親子で確認したい渡り方をまとめました。",
    categoryLabel: "事故ニュース",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-07-14",
    thumbnailUrl: "/images/safe-magazine/thumbnails/gifu-mizuho-crosswalk-accident.png",
  },
  {
    id: "2026-07-14-otta-iot-mimamori-kawachinagano",
    slug: "otta-iot-mimamori-kawachinagano",
    title: "【大阪・河内長野市】IoT見守り端末を全13校に無償配布、通過記録の仕組みとは",
    excerpt: "大阪府河内長野市が株式会社ottaと協定を結び、市立小学校全13校の児童にIoT見守り端末を無償配布することになりました。「人の目」だけに頼らない新しい見守りの形が全国に広がりつつあります。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-07-14",
    thumbnailUrl: "/images/safe-magazine/thumbnails/otta-iot-mimamori-kawachinagano.png",
  },
  {
    id: "2026-07-05-summer-break-safety-2026",
    slug: "summer-break-safety-2026",
    title: "【夏休み前に】熱中症2,813件・事故防止週間・浮く水泳授業に学ぶ守り方",
    excerpt: "文部科学省が学校管理下の熱中症事故2,813件（令和7年度）を公表し対策を依頼、こども家庭庁は7月13〜19日を転落事故防止週間に定め、香川県はライフジャケット水泳授業を始めました。通学路の暑さ・自宅のベランダや窓・プールや水辺で高まる3つのリスクへ、今日からできる対策をまとめました。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-07-05",
    thumbnailUrl: "/images/safe-magazine/thumbnails/summer-break-safety-2026.png",
  },
]

export function getLandingSafeMagazinePreview(count = 3): LandingSafeMagazinePreviewItem[] {
  return LANDING_SAFE_MAGAZINE_PREVIEW_ITEMS.slice(0, count)
}

export function formatLandingSafeMagazineDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
