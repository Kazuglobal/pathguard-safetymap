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
    id: "2026-09-11-autumn-bicycle-blue-ticket-watch-2026",
    slug: "autumn-bicycle-blue-ticket-watch-2026",
    title: "【9/21〜30】秋の交通安全運動の重点に自転車——通学で確認する2点",
    excerpt: "内閣府は令和8年7月1日、秋の全国交通安全運動（9月21日〜30日）の推進要綱を決定し、全国重点の3番目に「自転車・特定小型原動機付自転車の交通ルールの理解・遵守の徹底」を掲げました。青切符の実データから割り出した、通学で確認すべき2点をまとめます。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-09-11",
    thumbnailUrl: "/images/safe-magazine/thumbnails/autumn-bicycle-blue-ticket-watch-2026.png",
  },
  {
    id: "2026-09-11-e-scooter-under16-family-rules",
    slug: "e-scooter-under16-family-rules",
    title: "【保存版】電動キックボードは16歳未満が運転禁止——家庭で決める5つのルール",
    excerpt: "電動キックボード等（特定小型原動機付自転車）は16歳未満の運転が禁止され、16歳未満が運転するおそれのある人への「提供」も禁じられています。シェアサービスの普及で「親が解錠して子どもに渡す」形がいちばん起きやすい状況です。印刷して使える家庭のルール5つをまとめました。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-09-11",
    thumbnailUrl: "/images/safe-magazine/thumbnails/e-scooter-under16-family-rules.png",
  },
  {
    id: "2026-09-04-autumn-twilight-reflective-gear",
    slug: "autumn-twilight-reflective-gear",
    title: "【10月がピーク】小1の歩行中事故は4月の2.2倍——秋の夕方に効く備え",
    excerpt: "小学1年生の歩行中の死者・重傷者数は10月が最多で、入学直後の4月の約2.2倍（内閣府『令和7年交通安全白書』）。リスクが高まるのは春ではなく秋です。日没が早まり下校時間が薄暮に重なるこの時期に、今日からできる3つの備えをまとめました。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-09-04",
    thumbnailUrl: "/images/safe-magazine/thumbnails/autumn-twilight-reflective-gear.png",
  },
  {
    id: "2026-09-04-30kmh-speed-limit-enforced",
    slug: "30kmh-speed-limit-enforced",
    title: "【9月1日施行】生活道路は30km/hへ——通学路の「いつもの道」はこう変わる",
    excerpt: "2026年9月1日、中央線などがない生活道路の法定速度が60km/hから30km/hへ引き下げられました。対象は全国の一般道の約7割。新しい標識は立たないため、通学路が対象かどうかは親子で見分ける必要があります。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-09-04",
    thumbnailUrl: "/images/safe-magazine/thumbnails/30kmh-speed-limit-enforced.png",
  },
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
