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
  {
    id: "2026-07-05-sendai-suspicious-person-incident",
    slug: "sendai-suspicious-person-incident",
    title: "【7月・仙台】下校中の女児に声かけ被害——他人事ではない3つの備え",
    excerpt: "仙台市青葉区で、下校中の女子小学生が見知らぬ女に腕をつかまれ、道をしつこく尋ねられる事案が発生しました。道を尋ねるふりで近づく手口は全国どこでも起こりうるため、今日から親子で確認できる3つの備えをまとめました。",
    categoryLabel: "事故ニュース",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-07-05",
    thumbnailUrl: "/images/safe-magazine/thumbnails/suspicious-person-statistics.png",
  },
  {
    id: "2026-07-05-bicycle-blue-ticket-one-month-report",
    slug: "bicycle-blue-ticket-one-month-report",
    title: "【施行1か月・暫定値】自転車青切符2,147件——一時停止とながらスマホが7割",
    excerpt: "2026年4月施行の自転車青切符、施行1か月間の暫定値を警察庁が公表し、告知2,147件のうち一時停止とながらスマホで7割を占めることが分かりました。中高生の自転車通学がある家庭はもちろん、数年後に備えたい家庭も今日から確認すべき2つの行動が分かります。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-07-05",
    thumbnailUrl: "/images/safe-magazine/thumbnails/bicycle-blue-ticket-one-month-report.png",
  },
]

export function getLandingSafeMagazinePreview(count = 3): LandingSafeMagazinePreviewItem[] {
  return LANDING_SAFE_MAGAZINE_PREVIEW_ITEMS.slice(0, count)
}

export function formatLandingSafeMagazineDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
