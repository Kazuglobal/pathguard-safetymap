// 機能ツアーの場面ごとの画面(実際のアプリの画面。b-roll は使わない。図は illustration と明示する)。
// overlay は画面の外に貼るステッカー(Lottie)。画面の上に重ねて、実画面にないものを描き足さない。
// 機能の名前と1行は lib/product-facts.ts の PRODUCT_FEATURES から読む(動画に文字を直接書かない)。
// どの機能にも画面があることは tests/unit/lib/product-facts.test.ts が確かめる。
// このファイルは remotion を import しない(テストから読むため)。

export type TourOverlay = "pins" | "water" | "stars"

export type TourMedia =
  | { kind: "phone"; src: string; overlay?: TourOverlay }
  | { kind: "browser"; src: string; overlay?: TourOverlay }
  /** 2枚をワイプで見比べる(「いつも」と「もしも」) */
  | { kind: "phoneCompare"; before: string; after: string; beforeLabel: string; afterLabel: string }
  /** 実画面を撮れない場面だけの図(実画面とは書かない)。危険箇所レポートは見本の通学路に公開済みの危険が無く、実データで撮れないため */
  | { kind: "illustration"; name: "report-pdf" }
  /** 2枚を順に見せる(さがす画面 → 結果) */
  | { kind: "phoneSequence"; first: string; second: string; overlay?: TourOverlay }

export const TOUR_MEDIA: Record<string, TourMedia> = {
  "danger-map": { kind: "browser", src: "v3/desktop-map.webp" },
  heatmap: { kind: "browser", src: "v3/desktop-hotspots.webp" },
  hazard: { kind: "browser", src: "v3/desktop-hazard.webp", overlay: "water" },
  ar: { kind: "phone", src: "v3/phone-ar.webp", overlay: "pins" },
  report: { kind: "phone", src: "v3/phone-report-wizard.webp" },
  "what-if": {
    kind: "phoneCompare",
    before: "v3/whatif-before.webp",
    after: "v3/whatif-after.webp",
    beforeLabel: "いつも",
    afterLabel: "もしも(台風のあと)",
  },
  alerts: { kind: "phone", src: "v3/phone-alerts.webp" },
  news: { kind: "phone", src: "v3/phone-news.webp" },
  // 星のステッカーは付けない(実際の結果画面の星の数と食い違うため)
  hunter: { kind: "phoneSequence", first: "v3/phone-hunter-explore.webp", second: "v3/phone-hunter-result.webp" },
  quiz: { kind: "phone", src: "v3/phone-quiz.webp" },
  "report-pdf": { kind: "illustration", name: "report-pdf" },
}
