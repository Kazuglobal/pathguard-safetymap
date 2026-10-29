// PathGuardian 紹介HP(/lp)のコピー・構成データ一元定義
// 掲載する機能・文言はアプリの実装済み機能のみ(誇張・未実装機能の記載禁止)
// 登録・審査・料金・写真の扱い・機能の一覧は lib/product-facts.ts から読む(ログイン・登録の画面と同じ約束にする)

import { BRAND } from "./brand"
import { PRODUCT_FACTS, PRODUCT_FEATURES, type ProductFeature } from "./product-facts"

export const LP_META = {
  // 紹介HPはホームと同じ既定のタイトル(ページ名を付けない。app/lp/page.tsx で absolute にする)
  title: BRAND.defaultTitle,
  description:
    "PathGuardianは、写真と地図で通学路の危険をAIが見える化し、地域のヒヤリハット報告・不審者アラート・毎日の通学路の安全ニュースで家族の安全習慣をつくる、無料の通学路みまもりアプリです。",
  ogImage: "/images/lp/og-share.png",
} as const

/** 登録とログインの入口(ヒーロー・ヘッダー・最後の呼びかけで同じ行き先にする) */
export const LP_SIGNUP = { label: "無料ではじめる", href: "/register" } as const
export const LP_LOGIN = { label: "ログイン", href: "/login" } as const

export const LP_HERO = {
  eyebrow: "通学路みまもりアプリ",
  headline: ["「いってらっしゃい」に、", "確かな安心を。"],
  sub: "PathGuardian は、子どもの通学路にひそむ危険を地図で見える化し、地域の目と AI で家族の安全習慣をつくる見守りアプリです。",
  ctaPrimary: LP_SIGNUP,
  ctaSecondary: { label: "機能を見る", href: "#features" },
  note: `${PRODUCT_FACTS.pricing}${PRODUCT_FACTS.install}`,
} as const

export const LP_PROBLEM = {
  eyebrow: "毎朝の、小さな不安",
  headline: ["見送ったあとの通学路を、", "親は見ることができない。"],
  outro:
    "PathGuardian は、この「見えない・聞けない・間に合わない」をなくすために作られました。",
  cards: [
    {
      tag: "見えない",
      title: "危険は、\n地図に載っていない",
      body: "交差点、見通しの悪い角、人通りの少ない路地。大人が気づきにくい「ヒヤリ」は、ふつうの地図には描かれていません。",
      color: "coral",
    },
    {
      tag: "聞けない",
      title: "「今日どうだった？」で終わる会話",
      body: "帰ってきた子どもに聞いても、通学路の話はなかなか出てきません。どこが危なかったかは、本人も気づいていないから。",
      color: "amber",
    },
    {
      tag: "間に合わない",
      title: "知ったときには、\nもう遅い",
      body: "不審者や事故の情報は、回覧板やニュースで知る頃には何日も経っています。ほしいのは「今」の情報です。",
      color: "green",
    },
  ],
} as const

export type LpFeature = ProductFeature

/** 機能の一覧(9件)。中身は lib/product-facts.ts */
export const LP_FEATURES: readonly LpFeature[] = PRODUCT_FEATURES

/** はじめかた: 準備は2つ(登録・通学路)、そのあとは毎朝の続ける習慣(UIUX改装 項目13) */
export const LP_HOW = {
  eyebrow: "はじめかた",
  headline: "準備は2つ。あとは毎朝3分。",
  steps: [
    {
      label: "準備 1",
      title: "無料で登録",
      description: `${PRODUCT_FACTS.registration.short}アプリのインストールもいりません。`,
    },
    {
      label: "準備 2",
      title: "通学路を登録",
      description: "地図でお子さんの通学路をえがくと、道の近くの危険と事故の多い場所が分かります。自宅と学校の前の道は保存しません。",
    },
    {
      label: "毎朝",
      title: "3分の安全チェック",
      description: "通学路の安全ニュースと地域のアラートで、見守りを毎日の習慣に。気になる場所は家族で話して、地図にのこします。",
    },
  ],
} as const

export const LP_TRUST = {
  eyebrow: "安心への配慮",
  headline: "子どもが使うものだから、\n慎重に作っています。",
  items: [
    {
      title: "AIと運営スタッフの確認",
      description: `${PRODUCT_FACTS.moderation.adult}不適切な内容や、個人を特定できる情報は公開しません。`,
    },
    {
      title: "写真はスマホの中でぼかす",
      description: PRODUCT_FACTS.photo.adult,
    },
    {
      title: "すべての機能が無料",
      description: `地域の安全は、みんなで作るもの。${PRODUCT_FACTS.pricing}`,
    },
  ],
} as const

/** よくある質問。最初の2問(料金・インストール)は開いた状態で出す(LpFaq) */
export const LP_FAQ = [
  {
    q: "利用料金はかかりますか？",
    a: `${PRODUCT_FACTS.pricing}危険マップ・ヒヤリハット報告・アラート通知・安全ニュース・きけんハンターなど、料金がかかる機能はありません。`,
  },
  {
    q: "アプリのインストールは必要ですか？",
    a: `${PRODUCT_FACTS.install}ホーム画面に追加すれば、アプリのように使えます。`,
  },
  {
    q: "登録には何が必要ですか？",
    a: `${PRODUCT_FACTS.registration.summary}${PRODUCT_FACTS.registration.confirmationMail}`,
  },
  {
    q: "子どもだけでも使えますか？",
    a: "きけんハンターや安全クイズなど、子ども向けの機能はお子さんが楽しく使える設計です。はじめての設定や報告の投稿は、保護者の方と一緒に行うことをおすすめします。",
  },
  {
    q: "投稿した報告はすぐに公開されますか？",
    a: `いいえ。${PRODUCT_FACTS.moderation.adult}個人が特定できる情報や不適切な内容を含む報告は公開しません。`,
  },
  {
    q: "写真に写った顔やナンバーはどうなりますか？",
    a: PRODUCT_FACTS.photo.adult,
  },
  {
    q: "どの地域で使えますか？",
    a: "日本全国でご利用いただけます。危険マップはお住まいの地域の報告が集まるほど充実していきます。",
  },
] as const

/** 開いた状態で出す質問の数(料金・インストール) */
export const LP_FAQ_OPEN_COUNT = 2

export const LP_PHOTO_AI = {
  eyebrow: "いちばんの目玉",
  headline: ["写真をとるだけ。", "AIがキケンを見える化。"],
  body: "通学路の写真をアップロードすると、AI が危険箇所と安全設備を検出して、写真の上に色分けして描画。安全スコアも算出されるから、子どもと一緒に「どこがあぶない？」をゲーム感覚で学べます。",
  points: [
    "カーブミラーや横断歩道などの安全設備は緑、危険要素は赤で色分け",
    "劣化したブロック塀のような見落としがちな危険も AI が検出",
    "安全スコアで「どれくらい安全な道か」がひと目で分かる",
  ],
  image: "/images/lp/mocks/phone-hunter-result.png",
} as const

// 動画の見出しは日本語を主にする(UIUX改装 項目13)。動画ツアーは9つの場面で機能を紹介している
export const LP_FEATURE_TOUR = {
  src: "/videos/lp/pathguardian-features-v2.mp4",
  eyebrow: "機能ツアー",
  headline: `60秒でわかる ${PRODUCT_FEATURES.length}つの機能`,
  caption: `実際の画面といっしょに、${PRODUCT_FEATURES.length}つの機能をぎゅっとまとめました。`,
} as const

export const LP_MARQUEE_WORDS = ["いってらっしゃい", "いってきます", "きをつけてね", "ただいま", "おかえり"] as const

export const LP_VIDEO = {
  src: "/videos/lp/pathguardian-intro.mp4",
  poster: "/images/lp/video-poster-v2.jpg",
  eyebrow: "紹介ムービー",
  headline: "30秒でわかる PathGuardian",
  caption: "毎朝の「いってらっしゃい」から、家族の作戦会議まで。",
} as const

export const LP_CTA = {
  headline: ["明日の「いってらっしゃい」を、", "もっと安心に。"],
  sub: "登録は1分。今日から家族の見守りをはじめましょう。",
  primary: LP_SIGNUP,
  secondary: { label: "ログインはこちら", href: LP_LOGIN.href },
} as const

/** ログイン済みの人に出す入口(ヘッダーとフッターで同じ文言・同じ行き先。UIUX改装 項目13・54) */
export const LP_OPEN_APP = { label: "アプリを開く", href: "/landing" } as const
