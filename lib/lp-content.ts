// PathGuardian 紹介HP(/lp)のコピー・構成データ一元定義
// 掲載する機能・文言はアプリの実装済み機能のみ(誇張・未実装機能の記載禁止)

export const LP_META = {
  title: "PathGuardian | 通学路の危険を見える化する、家族の見守りアプリ",
  description:
    "PathGuardianは、写真と地図で通学路の危険をAIが見える化し、地域のヒヤリハット報告・不審者アラート・毎日の安全ニュースで家族の安全習慣をつくる無料の見守りアプリです。",
  ogImage: "/images/lp/og-share.png",
} as const

export const LP_HERO = {
  eyebrow: "通学路みまもりアプリ",
  headline: ["「いってらっしゃい」に、", "確かな安心を。"],
  sub: "PathGuardian は、子どもの通学路にひそむ危険を地図で見える化し、地域の目と AI で家族の安全習慣をつくる見守りアプリです。",
  ctaPrimary: { label: "無料ではじめる", href: "/register" },
  ctaSecondary: { label: "機能を見る", href: "#features" },
  note: "登録は無料。アプリのインストールは不要で、ブラウザからすぐ使えます。",
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
      title: "「今日どうだった?」で終わる会話",
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

export interface LpFeature {
  key: string
  title: string
  kicker: string
  description: string
  image?: string
}

export const LP_FEATURES: LpFeature[] = [
  {
    key: "danger-map",
    title: "危険マップ",
    kicker: "地域の目が集めた危険を、地図の上に",
    description:
      "地域から寄せられたヒヤリハット報告が地図上のピンになり、通学路の危険を一目で確認。近い報告はまとまって表示されるので、危険が集中する場所もすぐ分かります。",
    image: "/images/lp/feature-crossing-natural.png",
  },
  {
    key: "heatmap",
    title: "事故ヒートマップ",
    kicker: "警察庁オープンデータで事故を見える化",
    description:
      "過去の交通事故データを地図に重ねて、事故が多い道をひと目で把握。子ども関与・歩行者関与だけに絞ったり、地点ごとの事故リスクスコアも確認できます。",
  },
  {
    key: "hazard",
    title: "ハザードマップ",
    kicker: "自分の地域の災害リスクを手軽にデジタルで",
    description:
      "国土交通省のハザードマップを重ねて、洪水・津波の浸水想定を通学路とあわせて確認。紙のハザードマップを探さなくても、いつもの地図ですぐ分かります。",
  },
  {
    key: "report",
    title: "みんなのヒヤリハット報告",
    kicker: "3ステップで報告、一覧でみんなと共有",
    description:
      "気づいた危険は場所を選んで3ステップで報告。地域の報告は一覧でも見られて、AI と運営の審査を経た安心な情報だけが共有されます。",
  },
  {
    key: "alerts",
    title: "不審者アラート",
    kicker: "声かけ・不審者情報をプッシュ通知",
    description:
      "地域で共有された声かけ・不審者情報を、見守る家族へそっとお知らせ。通知から地図を開けば、どこで何があったかをすぐ確認できます。",
  },
  {
    key: "news",
    title: "通学路の安全ニュース",
    kicker: "毎日3分の安全チェック習慣",
    description:
      "全国の通学路に関する事故・防犯・制度のニュースを編集部が毎日選定。「今日、家族で何を話すか」まで添えて届けます。",
  },
]

export const LP_HOW = {
  eyebrow: "はじめかた",
  headline: "今日から、3ステップで。",
  steps: [
    {
      title: "無料登録",
      description: "メールアドレスだけで登録完了。アプリのインストールは不要です。",
    },
    {
      title: "通学路をチェック",
      description: "危険マップでお子さんの通学路を確認。気になる場所は家族で共有。",
    },
    {
      title: "毎朝の安全習慣",
      description: "安全ニュースとアラート通知で、見守りが毎日の習慣になります。",
    },
  ],
} as const

export const LP_TRUST = {
  eyebrow: "安心への配慮",
  headline: "子どもが使うものだから、\n慎重に作っています。",
  items: [
    {
      title: "AI と人の二重審査",
      description:
        "投稿されたヒヤリハット報告は、AI 審査と運営の確認を経てから公開。不適切な内容や個人を特定できる情報は公開されません。",
    },
    {
      title: "個人情報への配慮",
      description:
        "顔やナンバープレートが写り込む投稿は非公開に。位置情報は報告地点の共有のためだけに使います。",
    },
    {
      title: "無料で使える",
      description:
        "地域の安全は、みんなで作るもの。基本機能はすべて無料で提供しています。",
    },
  ],
} as const

export const LP_FAQ = [
  {
    q: "利用料金はかかりますか?",
    a: "無料でご利用いただけます。危険マップの閲覧、ヒヤリハット報告、アラート通知、安全ニュースなどの基本機能に料金はかかりません。",
  },
  {
    q: "アプリのインストールは必要ですか?",
    a: "不要です。スマートフォン・タブレット・パソコンのブラウザからそのまま利用できます。ホーム画面に追加すればアプリのように使えます。",
  },
  {
    q: "子どもだけでも使えますか?",
    a: "きけんハンターや安全クイズなど、子ども向けの機能はお子さんが楽しく使える設計です。はじめての設定や報告の投稿は、保護者の方と一緒に行うことをおすすめします。",
  },
  {
    q: "投稿した報告はすぐに公開されますか?",
    a: "いいえ。すべての報告は AI による内容の審査を経てから公開されます。個人が特定できる情報や不適切な内容を含む報告は公開されません。",
  },
  {
    q: "どの地域で使えますか?",
    a: "日本全国でご利用いただけます。危険マップはお住まいの地域の報告が集まるほど充実していきます。",
  },
] as const

export const LP_PHOTO_AI = {
  eyebrow: "いちばんの目玉",
  headline: ["写真をとるだけ。", "AIがキケンを見える化。"],
  body: "通学路の写真をアップロードすると、AI が危険箇所と安全設備を検出して、写真の上に色分けして描画。安全スコアも算出されるから、子どもと一緒に「どこがあぶない?」をゲーム感覚で学べます。",
  points: [
    "カーブミラーや横断歩道などの安全設備は緑、危険要素は赤で色分け",
    "劣化したブロック塀のような見落としがちな危険も AI が検出",
    "安全スコアで「どれくらい安全な道か」がひと目で分かる",
  ],
  image: "/images/lp/mocks/phone-hunter-result.png",
} as const

export const LP_FEATURE_TOUR = {
  src: "/videos/lp/pathguardian-features-v2.mp4",
  headline: "60秒でわかる 機能ツアー",
  caption: "実際の画面といっしょに、9つの機能をぎゅっとまとめました。",
} as const

export const LP_MARQUEE_WORDS = ["いってらっしゃい", "いってきます", "きをつけてね", "ただいま", "おかえり"] as const

export const LP_VIDEO = {
  src: "/videos/lp/pathguardian-intro.mp4",
  poster: "/images/lp/video-poster-v2.jpg",
  headline: "30秒でわかる PathGuardian",
  caption: "毎朝の「いってらっしゃい」から、家族の作戦会議まで。",
} as const

export const LP_CTA = {
  headline: ["明日の「いってらっしゃい」を、", "もっと安心に。"],
  sub: "登録は1分。今日から家族の見守りをはじめましょう。",
  primary: { label: "無料ではじめる", href: "/register" },
  secondary: { label: "ログインはこちら", href: "/login" },
} as const
