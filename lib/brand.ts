/**
 * 名前と外向きの表記の決まり(UIUX改装 項目1・3・4・25・41)。タイトル・OGP・フッター・認証の画面はここから読む。
 *
 * 名前のセット(これ以外の名前を画面に出さない。tests/unit/lib/brand-names.test.ts が旧名の残りを見つける):
 *   主名 PathGuardian / 説明名 通学路みまもりアプリ / 子ども向けの傘 きけんハンター
 */
export const BRAND = {
  name: 'PathGuardian',
  descriptor: '通学路みまもりアプリ',
  kidsUmbrella: 'きけんハンター',
  /** ホームなど、ページ名のない画面のタイトル */
  defaultTitle: 'PathGuardian｜通学路みまもりアプリ',
  /** 各ページのタイトルの書式(Next の title.template。ページ側はページ名だけを書く) */
  titleTemplate: '%s | PathGuardian',
  description:
    '通学路の危険を家族で見つけて地図にのこし、地域のヒヤリハット報告・不審者アラート・毎日の通学路の安全ニュースで見守る、無料の通学路みまもりアプリです。',
  siteUrl: 'https://path-guardian.com',
  /** 紙の色(lib/design/tanken.ts の paper)。ブラウザの上の帯・PWA の色 */
  themeColor: '#FBF5E9',
  /** 呼び名の統一(項目25) */
  notebook: 'あんぜんノート',
  magazine: 'SAFE MAGAZINE',
  news: '通学路の安全ニュース',
  instagram: {
    handle: '@kiken_hunter_jp',
    url: 'https://www.instagram.com/kiken_hunter_jp/',
  },
  /** お問い合わせの Google フォーム(項目4)。URL を受け取るまでは null(画面には「準備中」と出す) */
  contactFormUrl: null as string | null,
  /** 運営者の表記(受け取るまでは準備中) */
  operator: null as string | null,
} as const

/** ページのタイトル(ページ名だけを渡す。null ならホームのタイトル) */
export function pageTitle(name: string | null): string {
  return name ? BRAND.titleTemplate.replace('%s', name) : BRAND.defaultTitle
}
