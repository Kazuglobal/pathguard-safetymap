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
    id: "2026-10-28-autumn-campaign-2026-night-pedestrians",
    slug: "autumn-campaign-2026-night-pedestrians",
    title: "【秋の運動結果】歩行中の死者26人中19人が夜——反射材は運動後こそ",
    excerpt: "警察庁の発表によると、令和8年秋の全国交通安全運動の10日間（9月21日〜30日）の死者は77人で、前年同期より3人減りました。一方、歩行中の死者26人のうち19人は夜で、前年より6人増えています。家族の夕方・夜の歩き方を見直す3つの行動を紹介します。",
    categoryLabel: "危険度情報",
    categoryColor: "#F97316",
    categoryIcon: "BarChart2",
    publishedDate: "2026-10-28",
    thumbnailUrl: "/images/safe-magazine/thumbnails/autumn-campaign-2026-night-pedestrians.jpg",
  },
  {
    id: "2026-10-28-pedestrian-deaths-age5-9-sep2026",
    slug: "pedestrian-deaths-age5-9-sep2026",
    title: "【警察庁・9月末】5〜9歳の歩行中の死者は9人、前年同期の4.5倍——数字の波の読み方",
    excerpt: "警察庁の統計月報（9月末）で、2026年1〜9月に歩行中に亡くなった5〜9歳は9人。前年同期（2人）の4.5倍でしたが、2016〜2018年は毎年9〜10人の水準でした。小さい数字の増減をどう読むかと、通学路以外の道も含めた3つの備えをまとめます。",
    categoryLabel: "危険度情報",
    categoryColor: "#F97316",
    categoryIcon: "BarChart2",
    publishedDate: "2026-10-28",
    thumbnailUrl: "/images/safe-magazine/thumbnails/pedestrian-deaths-age5-9-sep2026.jpg",
  },
  {
    id: "2026-10-28-winter-snow-ice-school-route",
    slug: "winter-snow-ice-school-route",
    title: "【冬の通学路】雪山で見通せない交差点——札幌の学校便りに学ぶ3つの備え",
    excerpt: "札幌市の小学校区の便りには、交差点の雪山で見通しが悪くなり、児童が車道寄りで信号を待つ傾向があると記されています。雪が降る前の今のうちに、信号待ちの位置・ハンドサイン・降雪後の朝の出発時刻の3つを決める方法と、保存版チェックリストをまとめます。",
    categoryLabel: "安全対策",
    categoryColor: "#3B82F6",
    categoryIcon: "Shield",
    publishedDate: "2026-10-28",
    thumbnailUrl: "/images/safe-magazine/thumbnails/winter-snow-ice-school-route.jpg",
  },
  {
    id: "2026-10-24-30kmh-road-identification",
    slug: "30kmh-road-identification",
    title: "【施行から2か月】生活道路30km/h、6割が「対象不明」——見分ける3条件",
    excerpt: "2026年9月1日に生活道路の法定速度が30km/hへ引き下げられてから約2か月。施行直前の意識調査では、この法改正を「知っている」と答えた人は約4割で、最も多かった不安は「どの道路が対象かわからない」でした。ルールが変わっても目の前の車の走り方はすぐには変わりません。対象道路を見分ける3条件と、見落としやすい2つの例外を整理しました。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-10-24",
    thumbnailUrl: "/images/safe-magazine/thumbnails/30kmh-road-identification.jpg",
  },
  {
    id: "2026-10-24-bicycle-commute-accident-ranking-2025",
    slug: "bicycle-commute-accident-ranking-2025",
    title: "【統計】通学時の自転車事故、高校生は中学生の4.2倍——進学の春が備えどき",
    excerpt: "2025年の通学時の自転車事故は中学生1,688件・高校生7,081件で、高校生は中学生の約4.2倍。全国の自転車事故全体が0.1%減とほぼ横ばいの中、中高生の通学時だけが増えています。自転車通学が本格化する高校段階で事故の件数がぐっと大きくなる一方、この集計だけで通学者1人あたりのリスクまでは測れません。数字の読み方と、進学前にそろえておく備えを整理しました。",
    categoryLabel: "危険度情報",
    categoryColor: "#F97316",
    categoryIcon: "BarChart2",
    publishedDate: "2026-10-24",
    thumbnailUrl: "/images/safe-magazine/thumbnails/bicycle-commute-accident-ranking-2025.jpg",
  },
  {
    id: "2026-09-11-autumn-campaign-bicycle-rules",
    slug: "autumn-campaign-bicycle-rules",
    title: "【9月21日から】秋の交通安全運動の重点に自転車——中高生の通学を3点見直す",
    excerpt: "9月21日から30日まで実施される「令和8年秋の全国交通安全運動」の全国重点3番目は、自転車・特定小型原動機付自転車の交通ルール徹底です。自転車ヘルメットの全国着用率21.2%という現実をふまえ、今週末15分でできる3つの見直しをまとめました。",
    categoryLabel: "施策・制度",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-09-11",
    thumbnailUrl: "/images/safe-magazine/thumbnails/autumn-campaign-bicycle-rules.jpg",
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
    thumbnailUrl: "/images/safe-magazine/thumbnails/autumn-twilight-reflective-gear.jpg",
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
    thumbnailUrl: "/images/safe-magazine/thumbnails/30kmh-speed-limit-enforced.jpg",
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
    thumbnailUrl: "/images/safe-magazine/thumbnails/gifu-mizuho-crosswalk-accident.jpg",
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
    thumbnailUrl: "/images/safe-magazine/thumbnails/otta-iot-mimamori-kawachinagano.jpg",
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
    thumbnailUrl: "/images/safe-magazine/thumbnails/summer-break-safety-2026.jpg",
  },
]

export function getLandingSafeMagazinePreview(count = 3): LandingSafeMagazinePreviewItem[] {
  return LANDING_SAFE_MAGAZINE_PREVIEW_ITEMS.slice(0, count)
}

export function formatLandingSafeMagazineDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
