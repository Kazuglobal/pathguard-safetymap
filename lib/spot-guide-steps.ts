import type { SpotGuideStep } from "@/components/map/spot-guide"
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
    body: "事故ヒートマップ・不審者情報・AR・3D と、洪水・津波などの「地図の見た目」は、ここをひらいて選びます。地図を動かすと自動でたたまれます。",
  },
  {
    target: '[data-guide="map-legend"]',
    title: "ピンの見方",
    body: "ピンの絵は危険の種類、色はあぶなさです。迷ったらここで確かめられます。",
  },
  {
    target: '[data-guide="map-dock"]',
    title: "一覧と報告",
    body: "「一覧」で近くの報告を並べて見られます。危ない場所を見つけたら「現在地」か「報告」から知らせてください。",
  },
  {
    target: '[data-guide="map-report"]',
    title: REPORT_ENTRY_LABEL,
    body: "危ない場所を見つけたら、ここから地図にピンを立てて知らせてください。",
  },
  {
    target: '[data-guide="map-help"]',
    title: "使い方",
    body: "この案内は、ここからいつでも見直せます。",
  },
]

export const AR_GUIDE_STEPS: readonly SpotGuideStep[] = [
  {
    target: '[data-guide="ar-tabs"]',
    title: "見る情報を切りかえる",
    body: "「事故・浸水」は公的なデータ、「みんなの報告」は近くの人が知らせた危険です。",
    note: `立ち止まって使ってください。${PRODUCT_FACTS.ar.speedSuppress}`,
  },
  {
    target: ".ar-risk-dock",
    title: "近くの事故と浸水の想定",
    body: "カメラを向けた先の実事故と、この場所の浸水の想定がここに出ます。右の矢印でくわしくひらけます。",
  },
  {
    target: '[data-guide="ar-report-sheet"]',
    title: "近くの報告",
    body: "いちばん近い報告の要点です。「くわしく見る」で写真と確認ポイントがひらきます。",
  },
  {
    target: '[data-guide="ar-settings"]',
    title: "見る距離を変える",
    body: "どこまで遠くの情報を出すかは、ここで変えられます。",
  },
]
