import { NATIONWIDE } from "@/lib/user-region"

/** 地図の報告の絞り込みの初期値(map-container の初期値と、0件の案内の「絞り込んでいないか」の判定で使う) */
export const DEFAULT_MAP_REPORT_FILTERS = {
  dangerType: "all",
  dangerLevel: "all",
  dateRange: "all",
  showPending: true,
  // ホームやニュースで選んだ地域を地図に持ち込まない(見えないところで絞り込まれていた)。
  // 地図は表示範囲だけで絞り、都道府県はサイドバーで選んだときだけ絞る
  prefecture: NATIONWIDE,
}

export type MapReportFilters = typeof DEFAULT_MAP_REPORT_FILTERS

/** 絞り込み(種類・あぶなさ・期間・自分の審査中の報告・都道府県)を何もしていないか */
export function isDefaultMapReportFilters(filters: MapReportFilters): boolean {
  return (Object.keys(DEFAULT_MAP_REPORT_FILTERS) as (keyof MapReportFilters)[]).every(
    (key) => filters[key] === DEFAULT_MAP_REPORT_FILTERS[key],
  )
}

/**
 * 地図の画面が低すぎて、上の列(検索・通学路チェック・くわしい表示)と下の操作の列のあいだに0件の案内が入らない(横向きのスマホなど)。
 * map-floating-controls の右上の部品も、同じ高さで横に並べる(クラス名の 499px と合わせる)
 */
export const SHORT_MAP_SCREEN_QUERY = "(max-height: 499px)"

/** 報告の取得のようす。idle=まだ一度も取れていない / loaded=最後の取得が成功 / error=最後の取得が失敗 */
export type ReportsLoadState = "idle" | "loaded" | "error"

export interface EmptyAreaNoticeInput {
  /** 地図の表示範囲が決まり、地図の load が済んだ */
  isMapReady: boolean
  /** 最初の読み込み中・絞り込みを変えた取り直しの最中 */
  isRefreshing: boolean
  hasMapError: boolean
  reportsLoadState: ReportsLoadState
  filters: MapReportFilters
  /** 見えている範囲の報告(公開中と自分の審査中)の数 */
  reportCount: number
  isDismissed: boolean
  /** 報告の入力・場所選び・AR・上のパネル・事故ヒートマップ・地点の事故の集計など、ほかのものを見ているとき */
  isBusy: boolean
  /** 画面が低すぎて案内が入らない(SHORT_MAP_SCREEN_QUERY) */
  isScreenTooShort: boolean
}

/**
 * 見えている範囲に報告が1件もないときの案内を出すか(UIUX改装 項目10)。
 * 「まだない」と言えるのは、取得に成功して、絞り込みもしていないときだけ(失敗・絞り込み中は出さない)
 */
export function shouldShowEmptyAreaNotice(input: EmptyAreaNoticeInput): boolean {
  return (
    input.isMapReady &&
    !input.isRefreshing &&
    !input.hasMapError &&
    input.reportsLoadState === "loaded" &&
    isDefaultMapReportFilters(input.filters) &&
    input.reportCount === 0 &&
    !input.isDismissed &&
    !input.isBusy &&
    !input.isScreenTooShort
  )
}
