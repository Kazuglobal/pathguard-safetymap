/** 画面のエラー(app/error.tsx)と、ルートの layout ごと壊れたとき(app/global-error.tsx)で同じ文を出す(UIUX改装 項目42) */
export const ERROR_COPY = {
  title: "画面を表示できませんでした",
  body: "通信が不安定か、一時的な不具合が起きています。もう一度読み込むか、時間をおいてから開いてください。",
  retry: "もう一度読み込む",
  home: "ホームへ",
  digest: "お問い合わせのときは、この番号をお伝えください:",
} as const
