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
    id: "2026-03-15-bicycle-blue-ticket",
    slug: "bicycle-blue-ticket",
    title: "【4月から施行】自転車も「青切符」の対象に——中高生の通学に何が変わる？",
    excerpt: "2026年4月1日から、自転車の交通違反に「青切符（交通反則通告制度）」が適用されます。通学で自転車を使う中学生・高校生にも直接関係する制度変更です。保護者として知っておくべきポイントをまとめました。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-03-15",
    thumbnailUrl: "/images/safe-magazine/thumbnails/bicycle-blue-ticket.png",
  },
  {
    id: "2026-03-15-30kmh-speed-limit",
    slug: "30kmh-speed-limit",
    title: "【2026年9月施行】住宅街・通学路の速度制限が30km/hへ——何が変わるの？",
    excerpt: "2026年9月1日から、住宅街や生活道路の法定速度が現行の60km/hから30km/hに引き下げられます。通学路を含む多くの住宅街の道路がこの恩恵を受けます。「ゾーン30」とは何が違うのか、保護者目線でわかりやすく解説します。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-03-15",
    thumbnailUrl: "/images/safe-magazine/thumbnails/30kmh-speed-limit.png",
  },
  {
    id: "2026-03-15-ai-camera-kakogawa",
    slug: "ai-camera-kakogawa",
    title: "高度化カメラが通学路を支援——加古川市の「見守りカメラ」施策に学ぶ",
    excerpt: "兵庫県加古川市は、見守りカメラ約1,500ヵ所に加え、高度化見守りカメラ150台を整備しています。高度化カメラでは異常音検知や車両接近検知などを行い、2017年から2023年にかけて市内の刑法犯認知件数は約4割減少しました。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-03-15",
    thumbnailUrl: "/images/safe-magazine/thumbnails/ai-camera-kakogawa.png",
  },
]

export function getLandingSafeMagazinePreview(count = 3): LandingSafeMagazinePreviewItem[] {
  return LANDING_SAFE_MAGAZINE_PREVIEW_ITEMS.slice(0, count)
}

export function formatLandingSafeMagazineDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
