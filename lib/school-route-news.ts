// 通学路の安全ニュース データユーティリティ
//
// 注意: このモジュールは NEWS_ITEMS（記事全文）を含むため、クライアント
// コンポーネントから直接importしない。フィード用の型・純関数は
// lib/school-route-news-feed.ts からimportすること。

import {
  NEWS_CATEGORIES,
  computeDailyDigest,
  findLatestWeeklyTrend,
  formatNewsDate,
  toJstDateKey,
  type DailyDigestSummary,
  type NewsCategory,
  type SchoolRouteNewsFeedItem,
  type SchoolRouteNewsType,
} from "./school-route-news-feed"

export { NEWS_CATEGORIES, computeDailyDigest, findLatestWeeklyTrend, formatNewsDate, toJstDateKey }
export type { DailyDigestSummary, NewsCategory, SchoolRouteNewsFeedItem, SchoolRouteNewsType }

export interface SchoolRouteNewsItem {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: NewsCategory
  categoryLabel: string
  categoryColor: string
  categoryIcon: string
  publishedDate: string
  location: {
    prefecture: string
    city?: string
    area?: string
  }
  tags: string[]
  sources: string[]
  keyPoints: string[]
  thumbnailUrl?: string
  isBreaking?: boolean
  verifiedAt?: string
  /** そなえの一言（30〜60字の具体行動）。accident/suspicious では必須運用 */
  actionAdvice?: string
  /** 省略時は "daily"。週次ロールアップ記事のみ "weekly_trend" */
  newsType?: SchoolRouteNewsType
}

// サンプルニュースデータ（実際はAPIから取得）
export const NEWS_ITEMS: SchoolRouteNewsItem[] = [
  {
    id: "news-2026-07-14-003",
    slug: "hamamatsu-chuo-crosswalk-accident-20260703",
    title: "【静岡県浜松市】通学中の9歳女児が横断歩道ではねられ一時重体—信号無視の疑いで21歳男を現行犯逮捕",
    excerpt: "浜松市中央区の交差点で7月3日午前8時ごろ、青信号の横断歩道を渡っていた9歳の小学生女児が乗用車にはねられ一時重体に。運転していた21歳の男を過失運転致傷の疑いで現行犯逮捕。女児はその後意識を回復した。",
    content: `## 事案の概要

2026年7月3日（金）午前8時ごろ、静岡県浜松市中央区の交差点で、通学中の9歳の小学生女児が横断歩道を渡っていたところを乗用車にはねられる事故が発生しました。

### 発生状況（判明している範囲）

- **日時**：2026年7月3日（金）午前8時ごろ
- **場所**：浜松市中央区内の交差点（信号機・横断歩道あり）
- **被害者**：通学中の9歳女児
- **状況**：歩行者用信号が青の横断歩道を歩行中に、直進してきた乗用車にはねられた

女児は一時意識不明の重体で病院に搬送されましたが、その後意識を回復しています。

### 運転手の逮捕

事故を起こした乗用車を運転していた21歳の無職の男が、過失運転致傷の疑いで現行犯逮捕されました。男は「ぶつかったのは間違いない」と容疑を認めているとされ、警察は歩行者用信号が青だった女児に対し、男が信号無視をして交差点に進入した可能性があるとみて捜査しています。

### 青信号でも安心しきらない

横断歩道で歩行者側の信号が青であっても、信号無視や前方不注意の車が交差点に進入してくるケースは繰り返し起きています。子ども自身の落ち度の有無にかかわらず、「信号が青だから絶対に安全」とは限らないという前提で、家庭での声かけを続けることが被害を防ぐ力になります。

## そなえの一言

青信号でも渡る前に必ず立ち止まり、車が完全に止まったのを目で確認してから渡る——今日、通学路の横断歩道でこの動作を子どもと一緒に practice してみましょう。

### 保護者・地域にできること

1. **横断歩道での一呼吸**：青信号でも「渡る前に車を見る」動作を今日から習慣にする
2. **交差点の危険箇所共有**：見通しの悪い交差点・信号のタイミングが分かりにくい箇所を子どもと確認する
3. **登校時間帯の見守り**：朝の通学時間帯は特に車の交通量が多いことを踏まえ、地域の見守り活動への協力を検討する

### 出典
- 静岡放送（SBS）ニュース（2026年7月3日）
- テレビ静岡ニュース（2026年7月3日）
- 静岡朝日テレビニュース（2026年7月3日）
- 第一テレビニュース（2026年7月3日）`,
    category: "accident",
    categoryLabel: "交通事故",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-07-14T07:30:00+09:00",
    location: {
      prefecture: "静岡県",
      city: "浜松市",
      area: "中央区"
    },
    tags: ["交通事故", "浜松市", "静岡県", "横断歩道", "通学中", "信号無視", "9歳"],
    sources: [
      "静岡放送（SBS）ニュース「車が横断歩道を渡っていた通学途中の9歳女子児童をはね一時重体に 車運転の21歳男を逮捕 信号無視か」（2026年7月3日）",
      "https://news.yahoo.co.jp/articles/91eea979d9859b3aefac9768a744ef59a1513d47",
      "テレビ静岡ニュース「9歳の小学生女児 通学中に横断歩道で車にはねられ一時重体に」（2026年7月3日）",
      "静岡朝日テレビニュース「横断歩道を渡っていた小学生がはねられ重体 21歳の男を現行犯逮捕」（2026年7月3日）"
    ],
    keyPoints: [
      "浜松市中央区で7月3日午前8時ごろ、通学中の9歳女児が青信号の横断歩道で車にはねられ一時重体、21歳男が過失運転致傷容疑で現行犯逮捕",
      "青信号でも渡る前に必ず立ち止まり、車が完全に止まったのを目で確認してから渡ることを今日子どもと確認する"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/hamamatsu-chuo-crosswalk-accident-20260703.png",
    isBreaking: true,
    verifiedAt: "2026-07-14T07:00:00+09:00",
    actionAdvice: "青信号でも渡る前に必ず立ち止まり、車が完全に止まったのを目で確認してから渡る"
  },
  {
    id: "news-2026-07-14-002",
    slug: "sendai-miyagino-tsurugaya-suspicious-20260710",
    title: "【宮城県仙台市】宮城野区鶴ケ谷で登校中の女児が「おうちどこ」と声をかけられる—80代男",
    excerpt: "仙台市宮城野区鶴ケ谷2丁目の路上で7月10日午前8時20分ごろ、1人で登校途中の女子小学生が見知らぬ80代の男から「おうちどこ」と声をかけられる事案が発生。仙台東警察署が注意を呼びかけている。",
    content: `## 事案の概要

2026年7月10日（金）午前8時20分ごろ、宮城県仙台市宮城野区鶴ケ谷2丁目地内の路上で、1人で登校途中の女子小学生が見知らぬ男から「おうちどこ」と声をかけられる事案が発生しました。

### 発生状況

- **日時**：2026年7月10日（金）午前8時20分ごろ
- **場所**：仙台市宮城野区鶴ケ谷2丁目地内 路上
- **被害者**：1人で登校途中の女子小学生
- **発言内容**：「おうちどこ」

### 不審者の特徴

- 年齢：80歳代
- 髪型：坊主頭

### 「おうちどこ」という質問の危険性

住所や自宅の場所を尋ねる声かけは、一見他愛のない会話に見えても、相手の生活圏や行動パターンを把握しようとする意図が疑われるため、警戒が必要です。仙台東警察署は、事件や不審者を目撃した際はすぐに110番通報することと、子どもの見守り活動の強化を呼びかけています。

## そなえの一言

知らない人に家の場所を聞かれても答えず、大人がいる場所へすぐ逃げる——今晩、家族でこの対応を確認しておきましょう。

### 保護者・地域にできること

1. **住所を聞かれたときの対応**：「知らない人には家の場所を教えない」を今晩子どもと確認する
2. **1人登校の見直し**：登校時間帯に1人になる区間がないか、友達との待ち合わせ場所を確認する
3. **駆け込み先の確認**：鶴ケ谷2丁目周辺のこども110番の家・店舗を子どもと一緒に確認する
4. **情報提供**：不審者を目撃した場合は仙台東警察署または110番へ連絡する`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-07-14T07:15:00+09:00",
    location: {
      prefecture: "宮城県",
      city: "仙台市",
      area: "宮城野区鶴ケ谷2丁目"
    },
    tags: ["不審者", "声かけ事案", "仙台市", "宮城野区", "宮城県", "登校中", "女子小学生"],
    sources: [
      "みやぎ地域安全情報（河北新報、2026年7月10日分）",
      "https://kahoku.news/members/secm/",
      "仙台東警察署"
    ],
    keyPoints: [
      "仙台市宮城野区鶴ケ谷2丁目で7月10日午前8時20分ごろ、登校中の女子小学生が80代の男から「おうちどこ」と声をかけられる事案が発生",
      "知らない人に家の場所を聞かれても答えず、大人がいる場所へすぐ逃げることを今晩家族で確認する"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/sendai-miyagino-tsurugaya-suspicious-20260710.png",
    isBreaking: true,
    verifiedAt: "2026-07-14T07:00:00+09:00",
    actionAdvice: "知らない人に家の場所を聞かれても答えず、大人がいる場所へすぐ逃げる"
  },
  {
    id: "news-2026-07-14-001",
    slug: "kashima-minatogaoka-candy-suspicious-20260710",
    title: "【茨城県鹿嶋市】下校中の児童に「ガリガリ君あるけど食べる」と声かけ—60代男",
    excerpt: "鹿嶋市港ケ丘で7月10日午後4時ごろ、下校途中の児童らが見知らぬ60代の男から「ガリガリ君あるけど食べる」とアイスを勧められる事案が発生。茨城県警察が注意を呼びかけている。",
    content: `## 事案の概要

2026年7月10日（金）午後4時ごろ、茨城県鹿嶋市港ケ丘地内で、下校途中の児童らが見知らぬ男から菓子を勧められる事案が発生しました。現場は鹿嶋市立平井小学校・平井中学校の通学路周辺です。

### 発生状況

- **日時**：2026年7月10日（金）午後4時ごろ
- **場所**：鹿嶋市港ケ丘地内
- **被害者**：下校途中の児童ら
- **発言内容**：「ガリガリ君あるけど食べる」「いま買ってきたばかりだから」

### 不審者の特徴

- 年齢：60〜65歳
- 外見：頭頂部が薄い
- 服装：白色Tシャツ

### 物品譲渡型の手口に注意

お菓子や飲み物を差し出して気を引く手口は、子どもの警戒心を下げてから距離を縮める典型的なパターンです。今回は声かけの段階で留まっていますが、同様の手口が繰り返される可能性があるため、地域での警戒が呼びかけられています。

## そなえの一言

知らない人からお菓子を差し出されても受け取らず、その場を離れる練習を今日する——家庭内で「いらない」と断る一言を一緒に声に出してみましょう。

### 保護者・地域にできること

1. **物品を受け取らない練習**：「いりません」と断ってその場を離れる練習を今日家庭で行う
2. **下校時間帯の把握**：午後4時前後、港ケ丘地内で1人になる区間がないか確認する
3. **情報提供**：類似の声かけを目撃した場合は茨城県警察（最寄りの警察署）へ連絡する`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-07-14T07:00:00+09:00",
    location: {
      prefecture: "茨城県",
      city: "鹿嶋市",
      area: "港ケ丘"
    },
    tags: ["不審者", "声かけ事案", "物品譲渡", "鹿嶋市", "茨城県", "下校中"],
    sources: [
      "ガッコム安全ナビ 茨城県鹿嶋市（茨城県警察配信の地域安全情報を集約、報告日2026年7月11日）",
      "https://www.gaccom.jp/safety/area/p8/c222",
      "茨城県警察"
    ],
    keyPoints: [
      "鹿嶋市港ケ丘で7月10日午後4時ごろ、下校中の児童らが60代男から「ガリガリ君あるけど食べる」と声をかけられる事案が発生",
      "知らない人からお菓子を差し出されても受け取らず、その場を離れる練習を今日家庭でする"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/kashima-minatogaoka-candy-suspicious-20260710.png",
    isBreaking: false,
    verifiedAt: "2026-07-14T07:00:00+09:00",
    actionAdvice: "知らない人からお菓子を差し出されても受け取らず、その場を離れる練習を今日する"
  },
  {
    id: "news-2026-07-06-001",
    slug: "national-weekly-trend-20260706",
    title: "【週次傾向】6月29日〜7月5日の収集アラートは0件——夏休み前に確認したい3つの約束",
    excerpt: "本アプリが都道府県警察の公開防犯情報などを巡回して収集した6月29日〜7月5日の新規地域アラートは0件でした（前週も0件）。収集範囲には限りがあり「全国で事案ゼロ」を意味しません。夏休みを前に、家庭で確認しておきたい3つの約束を紹介します。",
    content: `## 今週の集計（2026年6月29日〜7月5日）

毎週月曜に、本アプリが収集した全国の地域安全情報を同じ形式で振り返ります。

| 項目 | 今週 | 前週（6/22〜6/28） |
|------|------|------------------|
| 新規収集アラート | 0件 | 0件 |
| うち声かけ・不審者・つきまとい | 0件 | 0件 |
| 編集部の新規記事 | 0件 | 0件 |

**集計対象**: 本アプリの自動収集（各都道府県警察の公開防犯情報・自治体の安全安心メール公開アーカイブ等）および編集部記事。収集開始からの累計は21件です（2026年7月6日時点）。

### この数字の読み方（たいせつな注意）

本アプリの収集は公開情報の巡回に基づくもので、**全国のすべての事案を網羅するものではありません**。「0件」は「全国で事案が1件もなかった」という意味ではなく、「本アプリの収集範囲で新しい記録がなかった」という意味です。お住まいの地域の一次情報は、各都道府県警察の防犯情報ページや自治体の安全安心メールもあわせてご確認ください。

## 今週の傾向

今週はデータ上の新規記録がなく、傾向の分析はありません。静かな週でした。

この定点観測は毎週月曜、同じ形式で「件数・カテゴリ内訳・時間帯」を追いかけます。数字が動いたときに「いつもと違う」と気づけることが、この欄の役割です。

## 今週のそなえ

7月中旬以降、多くの地域で夏休みが始まり、子どもの行動範囲と自由時間が一気に広がります。事案の有無にかかわらず、今週のうちに家族で「3つの約束」を確認しておきましょう。

1. **行っていい場所**: 行き先を必ず伝える。新しく行く場所は、最初は大人と一緒に
2. **帰る時間**: 帰宅時刻を決め、遅れるときの連絡方法も決めておく
3. **駆け込み先**: 困ったときに駆け込める場所（お店・交番・こども110番の家）を通り道ごとに1つ確認

## あなたの地域で確認するには

フィード上部の地域フィルターでお住まいの都道府県を選ぶと、「あなたの地域」欄に直近24時間のアラートが表示されます。夏休みの家庭での備え全般は、SAFE MAGAZINEの特集「【夏休み前に】熱中症2,813件・事故防止週間・浮く水泳授業に学ぶ守り方」もあわせてどうぞ。`,
    category: "policy",
    categoryLabel: "週次傾向",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-07-06T07:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["週次傾向", "定点観測", "夏休み", "地域アラート", "全国"],
    sources: [
      "mapsefe 地域安全アラート収集データ（local_safety_alerts、2026年6月22日〜7月5日分、2026年7月6日集計）"
    ],
    keyPoints: [
      "6月29日〜7月5日に本アプリが新規収集した地域アラートは0件（前週も0件・収集範囲には限りあり）",
      "夏休み前に「行っていい場所・帰る時間・駆け込み先」の3つの約束を子どもと確認する"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/national-weekly-trend-20260706.png",
    isBreaking: false,
    verifiedAt: "2026-07-06T07:00:00+09:00",
    actionAdvice: "夏休み前に「行っていい場所・帰る時間・駆け込み先」の3つの約束を子どもと決めておく",
    newsType: "weekly_trend"
  },
  {
    id: "news-2026-07-06-002",
    slug: "sendai-aoba-kawadaira-repeated-suspicious-20260706",
    title: "【宮城県仙台市】青葉区川平で下校中の女児への声かけ事案が3週間に3件相次ぐ",
    excerpt: "仙台市青葉区川平4丁目周辺で、下校中・帰宅中の女子小学生を対象とした声かけ事案が6月11日・15日・7月1日と3週間で3件発生。同一地域での繰り返しを踏まえ、下校時間帯の警戒強化が呼びかけられている。",
    content: `## 事案の概要

宮城県仙台市青葉区川平4丁目周辺で、下校中・帰宅中の女子小学生を対象とした声かけ事案が3週間の間に3件相次いで報告されました。

### 発生状況（判明している範囲）

| 発生日 | 時間帯 | 被害者の状況 |
|--------|--------|-------------|
| 6月11日（木） | 午後3時ころ | 2人で下校途中の女子小学生ら |
| 6月15日（月） | 午後3時ころ | 1人で下校途中の女子小学生 |
| 7月1日（水） | 午後1時30分ころ | 2人で帰宅途中の女子小学生ら |

いずれも青葉区川平4丁目地内の路上で発生しています。不審者の年齢・服装等の詳細は、情報源の公開範囲では確認できていません（確認でき次第、続報で追記します）。

### 同一地域での繰り返しに注意

3件とも同じ地区・近い時間帯（午後1時半〜3時、下校・帰宅の時間帯）で発生しており、単発の事案ではなく地域的な傾向として警戒が必要です。1人で下校していた6月15日の事案を含め、複数人での下校が徹底されていない時間帯・区間がある可能性があります。

### 保護者・地域にできること

1. **下校時間帯の把握**：13時台・15時台に一人歩きの区間がないか、子どもと通学路を確認する
2. **複数での下校の徹底**：同じ方向の友達と時間を合わせて一緒に帰る約束をする
3. **駆け込み先の確認**：川平4丁目周辺で駆け込める店舗・こども110番の家を子どもと確認する
4. **情報提供**：不審者を目撃した場合はみやぎSecurityメール・最寄りの警察署へ連絡する`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-07-06T08:00:00+09:00",
    location: {
      prefecture: "宮城県",
      city: "仙台市",
      area: "青葉区川平4丁目"
    },
    tags: ["不審者", "声かけ事案", "仙台市", "青葉区", "宮城県", "下校中", "女子小学生", "川平"],
    sources: [
      "ガッコム安全ナビ 宮城県仙台市青葉区（宮城県警察配信の地域安全情報を集約）",
      "https://www.gaccom.jp/safety/area/p4/c101/children",
      "https://www.gaccom.jp/safety/area/p4/c101/suspicious"
    ],
    keyPoints: [
      "仙台市青葉区川平4丁目周辺で、下校中の女子小学生を狙った声かけ事案が6/11・6/15・7/1と3週間で3件発生",
      "下校時間帯（13時台・15時台）は同じ道を避け、複数人で歩く約束を今日子どもとする"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/sendai-aoba-kawadaira-repeated-suspicious-20260706.png",
    isBreaking: true,
    verifiedAt: "2026-07-06T09:00:00+09:00",
    actionAdvice: "下校時間帯（13時台・15時台）は同じ道を避け、複数人で歩く約束を今日子どもとする"
  },
  {
    id: "news-2026-07-06-003",
    slug: "okayama-koto-guardrail-installed-20260627",
    title: "【岡山県岡山市】古都学区の児童通学路にガードレールを設置—用水路脇の危険箇所を改善",
    excerpt: "岡山市の古都学区で、児童通学路沿いの用水路脇にガードレールが設置された。地域住民から安全対策を求める声を受けたもので、2026年6月ごろ設置が完了し、児童がより安心して通学できる環境が整った。",
    content: `## 設置の概要

岡山県岡山市の古都学区（古都宿地区）で、児童通学路沿いの用水路脇にガードレールが設置されました。設置は2026年6月ごろに完了しています。

### 設置場所と背景

設置場所は中四国セキスイハイム工業南側（古都宿）の児童通学路沿い、用水路脇です。用水路に面した危険箇所として、以前から地域で安全対策が望まれていました。

### 地域にできること

1. **危険箇所の共有**：通学路沿いに安全対策が望まれる箇所があれば、学区の連合町内会や学校・自治体へ情報提供する
2. **設置後の確認**：ガードレールが機能しているか、子どもと一緒に実際の通学路で確認する`,
    category: "infrastructure",
    categoryLabel: "インフラ整備",
    categoryColor: "#3B82F6",
    categoryIcon: "Construction",
    publishedDate: "2026-07-06T07:30:00+09:00",
    location: {
      prefecture: "岡山県",
      city: "岡山市",
      area: "古都学区（古都宿）"
    },
    tags: ["ガードレール設置", "岡山市", "岡山県", "通学路整備", "用水路", "地域安全"],
    sources: [
      "古都学区連合町内会公式サイト（2026年6月27日掲載）",
      "https://townweb.e-okayamacity.jp/c-kozu-rengou/2026/06/27/kotosyukutuugakuro/"
    ],
    keyPoints: [
      "岡山市古都学区の児童通学路沿い（用水路脇）に、2026年6月ごろガードレールが設置された",
      "地域住民から安全対策を求める声を受けての対応で、危険箇所の共有が今後も有効"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/okayama-koto-guardrail-installed-20260627.png",
    isBreaking: false,
    verifiedAt: "2026-07-06T09:00:00+09:00"
  },
  {
    id: "news-2026-04-20-001",
    slug: "kitakyushu-kokurakita-izumidai-suspicious-sns-20260420",
    title: "【福岡県北九州市】小倉北区泉台で女児ら「SNSにのせる」とスマホで撮影される事案—40〜50代男が原付で接近",
    excerpt: "2026年4月20日午後1時50分頃、北九州市小倉北区泉台1丁目の道路上で、通行中の小学生女児らが原付バイクの男にスマートフォンのカメラを向けられ「SNSにのせる」と声をかけられる事案が発生。小倉北警察署が防犯メールで注意を呼びかけた。",
    content: `## 事案の概要

2026年4月20日（月）午後1時50分頃、福岡県北九州市小倉北区泉台1丁目14番付近の路上で、通行中の小学生女児らが見知らぬ男からスマートフォンのカメラを向けられ「SNSにのせる」と声をかけられる事案が発生しました。

### 発生状況

- **日時**：2026年4月20日（月）午後1時50分頃
- **場所**：北九州市小倉北区泉台1丁目14番付近 路上
- **被害者**：通行中の小学生女児等
- **行為**：スマートフォンのカメラを向け、「SNSにのせる」などと発言

### 不審者の特徴

- 年齢：40〜50歳代
- 服装：灰色上下の服
- ヘルメット：青色
- 乗車物：白色の原付バイク

### 警察の対応

小倉北警察署（093-583-0110）は防犯メールを発信し、地域住民・保護者へ注意を呼びかけました。

### 撮影系不審者事案への対応

撮影行為を伴う声かけ事案は、子どもの個人情報や顔写真がSNSへ投稿・拡散される二次被害につながる恐れがあります。

| 対応 | 内容 |
|------|------|
| 撮影されそうになったら | 背を向けて速やかに離れる |
| 大声で拒絶 | 「やめてください」と明確に拒否 |
| 写真の確認要請 | 大人を呼んで撮影者に削除を求める |
| 警察への通報 | 110番または最寄り警察署へ |

### 保護者・地域にできること

1. **顔写真の取り扱いを家庭で確認**：知らない人にスマホを向けられた時の対応を子どもと一緒に練習
2. **複数での通行**：登下校時はなるべく友達と一緒に行動
3. **不審な原付・自転車に注意**：停車中の原付バイクには近づかない
4. **情報提供**：類似事案を目撃した場合は小倉北警察署（093-583-0110）または110番へ`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-04-20T15:00:00+09:00",
    location: {
      prefecture: "福岡県",
      city: "北九州市",
      area: "小倉北区泉台1丁目"
    },
    tags: ["不審者", "声かけ事案", "撮影行為", "北九州市", "小倉北区", "福岡県", "SNS", "原付バイク", "小学生"],
    sources: [
      "kitakyu-net press（2026年4月20日）",
      "https://kitakyu-net.com/press/2026/04/caution-1838",
      "小倉北警察署 防犯メール"
    ],
    keyPoints: [
      "2026年4月20日午後1時50分頃、小倉北区泉台1丁目で女児がスマホで撮影される事案",
      "40〜50代男が灰色上下・青ヘルメット・白原付バイクの特徴で「SNSにのせる」と発言",
      "撮影行為を伴う声かけはSNS拡散の二次被害に直結、小倉北警察署が注意喚起"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/tokyo-suspicious-20260206.png",
    isBreaking: true,
    verifiedAt: "2026-05-01T09:00:00+09:00",
    actionAdvice: "「知らない人にスマホを向けられたら、背を向けてその場を離れる」を今晩子どもと練習する"
  },
  {
    id: "news-2026-04-17-001",
    slug: "hakodate-aoyagi-candy-handover-20260417",
    title: "【北海道函館市】青柳町で女子児童に「あげる」と菓子を手渡す不審者事案—中日ドラゴンズユニフォーム姿の男",
    excerpt: "2026年4月17日午後1時5分頃、函館市青柳町の路上で、女子児童が見知らぬ男から「あげる」と声をかけられ菓子を手渡される事案が発生。日本不審者情報センターが注意喚起情報を配信した。",
    content: `## 事案の概要

2026年4月17日（金）午後1時5分頃、北海道函館市青柳町の路上で、見知らぬ男が女子児童に「あげる」と声をかけ菓子を手渡す事案が発生しました。

### 発生状況

- **日時**：2026年4月17日（金）午後1時5分頃
- **場所**：函館市青柳町 路上
- **被害者**：女子児童（1名）
- **行為**：「あげる」と声をかけ菓子を渡す

### 不審者の特徴

- 身長：約172センチメートル
- 髪型：天然パーマ
- 服装：中日ドラゴンズのユニフォーム
- 所持品：リュックサック

### 物品譲渡型事案の危険性

声かけにとどまらず、菓子・物品の譲渡を伴う事案は、子どもの警戒心を低下させて誘引する手口の典型例として警察庁・防犯団体が繰り返し注意喚起しています。

### 子どもへの事前教育のポイント

| 場面 | 教えるべき行動 |
|------|---------------|
| 知らない人に物をもらいそうになった | 「いりません」と断り、その場を離れる |
| しつこく追ってきた | 大声で助けを求め、こども110番の家へ |
| 安全な場所に着いたら | すぐに保護者・先生・警察へ伝える |

### 「いかのおすし」の再確認

- **いか**：知らない人について「いか」ない
- **の**：知らない人の車に「の」らない
- **お**：「お」おきな声を出す
- **す**：「す」ぐ逃げる
- **し**：おとなに「し」らせる

### 保護者・地域にできること

1. **下校時間帯の見守り強化**：午後1時前後は早帰りや短縮授業で児童が個別下校する時間帯
2. **物品譲渡を断る練習**：家庭内で「もらわない・受け取らない」を反復練習
3. **目撃情報提供**：函館中央警察署（0138-54-0110）または110番へ
4. **地域連携**：通学路沿いの店舗・住民との顔の見える関係づくり`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-04-17T14:00:00+09:00",
    location: {
      prefecture: "北海道",
      city: "函館市",
      area: "青柳町"
    },
    tags: ["不審者", "声かけ事案", "物品譲渡", "函館市", "北海道", "女子児童", "下校中"],
    sources: [
      "日本不審者情報センター（2026年4月17日配信）",
      "函館中央警察署",
      "函館市公式 不審者情報"
    ],
    keyPoints: [
      "2026年4月17日午後1時5分頃、函館市青柳町で女子児童に菓子を手渡す事案",
      "不審者は身長172cm・天然パーマ・中日ドラゴンズユニフォーム・リュック所持の男",
      "物品譲渡型事案は警戒心低下による誘引手口、家庭内で『いかのおすし』を再確認"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/spring-suspicious-alert.png",
    isBreaking: true,
    verifiedAt: "2026-05-01T09:00:00+09:00",
    actionAdvice: "「知らない人から物をもらいそうになったら『いりません』と言って離れる」を家で練習する"
  }
]

// ニュースをスラッグで取得
export function getNewsItemBySlug(slug: string): SchoolRouteNewsItem | undefined {
  return NEWS_ITEMS.find(item => item.slug === slug)
}

// すべてのニュースを取得（新しい順）
export function getAllNewsItems(): SchoolRouteNewsItem[] {
  return [...NEWS_ITEMS].sort((a, b) =>
    new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  )
}

// カテゴリでニュースをフィルタ
export function getNewsItemsByCategory(category: NewsCategory): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.category === category)
}

// 都道府県でニュースをフィルタ
export function getNewsItemsByPrefecture(prefecture: string): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.location.prefecture === prefecture)
}

// 速報ニュースを取得
export function getBreakingNews(): SchoolRouteNewsItem[] {
  return NEWS_ITEMS.filter(item => item.isBreaking)
}

// 最新N件を取得
export function getLatestNews(count: number = 5): SchoolRouteNewsItem[] {
  return getAllNewsItems().slice(0, count)
}

// ---- 今日のダイジェスト（デイリーハビット設計 v3） ----

// 「今日は全国でX件・あなたの地域でY件」の集計
export function getTodaysDigest(prefecture: string, now: Date = new Date()): DailyDigestSummary {
  return computeDailyDigest(NEWS_ITEMS, prefecture, now)
}

// 最新の週次傾向記事（フィードの「今週の傾向」枠にピン留めする）
export function getLatestWeeklyTrend(): SchoolRouteNewsItem | undefined {
  return findLatestWeeklyTrend(getAllNewsItems())
}

// 相対時間を取得
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return `${diffMins}分前`
  } else if (diffHours < 24) {
    return `${diffHours}時間前`
  } else {
    return `${diffDays}日前`
  }
}
