/**
 * 報告の入口の名前と行き先(UIUX改装 項目5)。
 * 中央のボタンとシート・/report・ホーム・マイページ・ミッションで同じものを使う。
 */

/** 中央のボタンとシートの名前。中身はヒヤリハット報告・不審者アラート・きけんハンター */
export const REPORT_SHEET_TITLE = "知らせる・さがす"

/** 報告の入口のボタンの名前 */
export const REPORT_ENTRY_LABEL = "危険を報告する"

/** 報告の入口の行き先。地図を開き、報告フォームも開く(components/map/map-page-client.tsx の report=open) */
export const REPORT_PATH = "/map?report=open"
