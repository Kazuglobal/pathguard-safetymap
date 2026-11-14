import type { SpotGuideStep } from "@/components/map/spot-guide"
import type { SpotGuideId } from "@/lib/spot-guide-storage"
import { PRODUCT_FACTS } from "@/lib/product-facts"
import { REPORT_ENTRY_LABEL } from "@/lib/report-entry"

/**
 * 画面の上でボタンの位置を指す案内の手順。target は実際の部品に付けた data-guide(または class)。
 * 画面に無い手順は自動で飛ばすので、スマホとパソコンの両方のぶんを並べておく。
 * 手順や指す場所を大きく変えたら、lib/spot-guide-storage.ts の版を上げる。
 */
export const MAP_GUIDE_STEPS: readonly SpotGuideStep[] = [
  {
    target: '[data-guide="map-search"]',
    title: "場所をさがす",
    body: "学校の名前や住所を入れると、その場所へ地図が動きます。",
  },
  {
    target: '[data-guide="map-route-check"]',
    title: "通学路チェック",
    body: "登録した通学路と、その近くの危険・事故の多い場所を確かめられます。",
  },
  {
    target: '[data-guide="map-details"]',
    title: "くわしい表示",
    body: "事故ヒートマップ・不審者情報・AR・3D と、洪水・津波などの「地図の見た目」は、ここをひらいて選びます。はじめてひらいたときに、1つずつ案内します。",
  },
  {
    target: '[data-guide="map-legend"]',
    title: "ピンの見方",
    body: "ピンの絵は危険の種類、色はあぶなさです。迷ったらここで確かめられます。",
  },
  {
    target: ".danger-marker",
    title: "ピンをタップ",
    body: "ピンをタップすると、報告の内容や写真が出ます。数字の丸は、近くのピンをまとめたものです。",
    visibleInMiddleOnly: true,
  },
  {
    target: '[data-guide="map-dock"]',
    title: "一覧と報告",
    body: "「一覧」で近くの報告を並べて見られます。危ない場所を見つけたら「現在地」か「報告」から知らせてください。",
  },
  {
    target: '[data-guide="map-menu"]',
    title: "メニュー",
    body: "ホーム・きけんハンター・通学路・マイページ・報告一覧など、ほかの画面へはここから行けます。",
    note: "この案内は、左下の「?」(使い方)からいつでも見直せます。",
  },
  {
    target: '[data-guide="map-report"]',
    title: REPORT_ENTRY_LABEL,
    body: "危ない場所を見つけたら、ここから地図にピンを立てて知らせてください。",
    note: "この案内は、右下の「使い方」からいつでも見直せます。",
  },
]

/**
 * 「くわしい表示」をはじめてひらいたときに出す、中の5つの案内。
 * 列は横にスクロールするので、画面の外のボタンは見える位置まで送ってから照らす。
 */
export const MAP_DETAILS_GUIDE_STEPS: readonly SpotGuideStep[] = [
  {
    target: '[data-guide="map-chip-heatmap"]',
    title: "事故ヒートマップ",
    body: "実際に起きた交通事故の多い場所が、色の濃さでわかります。",
    scrollIntoView: true,
  },
  {
    target: '[data-guide="map-chip-suspicious"]',
    title: "不審者情報",
    body: "不審者の情報を、おおよその範囲の円で地図に出します。",
    scrollIntoView: true,
  },
  {
    target: '[data-guide="map-chip-ar"]',
    title: "AR",
    body: "カメラに映した景色の上に、近くの事故・浸水の想定・みんなの報告を重ねます。立ち止まって使ってください。",
    scrollIntoView: true,
  },
  {
    target: '[data-guide="map-chip-3d"]',
    title: "3D",
    body: "建物と地形を立体で見られます。坂や見通しを確かめるときに使います。",
    scrollIntoView: true,
  },
  {
    target: '[data-guide="map-chip-style"]',
    title: "地図の見た目",
    body: "地図の背景を変えたり、事故多発地点・洪水・津波の想定を重ねたりできます。",
    note: "地図を動かすと、この列は自動でたたまれます。出している表示の数は「くわしい表示」に数字で出ます。",
    scrollIntoView: true,
  },
]

/** ARの上の切りかえで選んでいるほう。risk=事故・浸水 / report=みんなの報告(親子モードでは通学路の学習) */
export type ARGuideTab = "risk" | "report"

export const AR_GUIDE_TABS_STEP: SpotGuideStep = {
  target: '[data-guide="ar-tabs"]',
  title: "見る情報を切りかえる",
  body: "「事故・浸水」は公的なデータ、もう一方は近くの人が知らせた危険(みんなの報告・通学路の学習)です。",
  note: `立ち止まって使ってください。${PRODUCT_FACTS.ar.speedSuppress}`,
}

export const AR_GUIDE_SETTINGS_STEP: SpotGuideStep = {
  target: '[data-guide="ar-settings"]',
  title: "見る距離を変える",
  body: "どこまで遠くの情報を出すかは、ここで変えられます。",
}

/**
 * 下のシートの手順。シートは選んでいるタブのぶんしか画面に無い(案内のあいだはタブを切りかえられない)ので、
 * タブごとに別の手順・別の記録にして、そのタブをはじめて開いたときに案内する
 */
export const AR_GUIDE_SHEET_STEPS: Record<ARGuideTab, { id: SpotGuideId; step: SpotGuideStep }> = {
  risk: {
    id: "ar-risk-sheet",
    step: {
      target: ".ar-risk-dock",
      title: "近くの事故と浸水の想定",
      body: "カメラを向けた先の実事故と、この場所の浸水の想定がここに出ます。右の矢印でくわしくひらけます。",
    },
  },
  report: {
    id: "ar-report-sheet",
    step: {
      target: '[data-guide="ar-report-sheet"]',
      title: "近くの報告",
      body: "いちばん近い報告の要点です。「くわしく見る」で写真と確認ポイントがひらきます。",
    },
  },
}

/**
 * ARの案内の手順を組む。withIntro: 切りかえと設定の手順も入れる(はじめてARを開いたとき・「?」から)。
 * 入れないときは、そのタブのシートの手順だけ(もう一方のタブをはじめて開いたとき)
 */
export function buildARGuideSteps(tab: ARGuideTab, withIntro: boolean): readonly SpotGuideStep[] {
  const sheetStep = AR_GUIDE_SHEET_STEPS[tab].step
  return withIntro ? [AR_GUIDE_TABS_STEP, sheetStep, AR_GUIDE_SETTINGS_STEP] : [sheetStep]
}

/** 実際に照らした手順から、見たと記録する案内を決める(画面に無くて飛ばしたシートは記録しない) */
export function getARGuideIdsSeen(shownTargets: readonly string[]): SpotGuideId[] {
  const ids: SpotGuideId[] = []
  if (shownTargets.includes(AR_GUIDE_TABS_STEP.target)) ids.push("ar")
  for (const sheet of Object.values(AR_GUIDE_SHEET_STEPS)) {
    if (shownTargets.includes(sheet.step.target)) ids.push(sheet.id)
  }
  return ids
}
