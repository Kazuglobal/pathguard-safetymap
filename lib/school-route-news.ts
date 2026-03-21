// 通学路の安全ニュース データユーティリティ

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
}

export type NewsCategory = "accident" | "suspicious" | "infrastructure" | "policy" | "community"

// カテゴリーの定義
export const NEWS_CATEGORIES = {
  "accident": {
    label: "交通事故",
    color: "#EF4444",
    bgColor: "bg-red-500",
    textColor: "text-red-600",
    bgLight: "bg-red-50",
    icon: "AlertTriangle"
  },
  "suspicious": {
    label: "不審者情報",
    color: "#F97316",
    bgColor: "bg-orange-500",
    textColor: "text-orange-600",
    bgLight: "bg-orange-50",
    icon: "AlertCircle"
  },
  "infrastructure": {
    label: "インフラ整備",
    color: "#3B82F6",
    bgColor: "bg-blue-500",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    icon: "Construction"
  },
  "policy": {
    label: "施策・対策",
    color: "#8B5CF6",
    bgColor: "bg-purple-500",
    textColor: "text-purple-600",
    bgLight: "bg-purple-50",
    icon: "FileText"
  },
  "community": {
    label: "地域活動",
    color: "#22C55E",
    bgColor: "bg-green-500",
    textColor: "text-green-600",
    bgLight: "bg-green-50",
    icon: "Users"
  }
} as const

// サンプルニュースデータ（実際はAPIから取得）
export const NEWS_ITEMS: SchoolRouteNewsItem[] = [
  {
    id: "news-2026-03-18-001",
    slug: "residential-road-30kmh-law-reform-20260318",
    title: "【全国】2026年9月から生活道路の法定速度を30km/hに引き下げ—通学路の安全対策が大きく前進",
    excerpt: "改正道路交通法により、2026年9月1日から中央線・車両通行帯のない生活道路の法定速度が60km/hから30km/hに引き下げ。全国の通学路の約7割を占める生活道路で速度規制が強化される。",
    content: `## 法改正の概要

2026年9月1日、改正道路交通法が施行され、**中央線や車両通行帯のない生活道路**における自動車の法定最高速度が60km/hから**30km/h**に引き下げられます。

### 対象となる道路

「生活道路」として対象になるのは、主に以下の条件を満たす道路です。

- 中央線（センターライン）が設けられていない道路
- 車両通行帯が設けられていない道路
- 主に地域住民の日常生活に利用される道路

**全国の一般道路の約7割**がこの対象に該当すると試算されており、多くの通学路が含まれます。

### 通学路への影響

警察庁のデータによると、時速30km以上になると歩行者の致死率が急増することが確認されています。

- 時速30km以下：歩行者致死率 約10%
- 時速50km以上：歩行者致死率 約60%

今回の改正により、**標識が設置されていない生活道路でも自動的に30km/h規制**が適用されるため、通学路の安全性が大幅に向上することが期待されます。

### 保護者・学校が知っておくべき点

1. **標識がなくても30km/h**：従来「標識がないから60km/hまで出してよい」という解釈は法改正後は通用しません
2. **取り締まりの強化**：2026年9月以降、生活道路での速度超過取り締まりが強化される見通しです
3. **ゾーン30との関係**：既存の「ゾーン30」指定道路と合わせ、通学路全体での速度管理が一層厳格化されます

### 改正の背景

2021年6月の千葉県八街市での飲酒運転による小学生5人死傷事故を受け、政府は通学路の抜本的な安全対策を推進。今回の法定速度引き下げはその集大成の一つです。`,
    category: "policy",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-03-18T10:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["道路交通法改正", "生活道路", "速度規制", "30km/h", "通学路", "2026年9月"],
    sources: [
      "警察庁 生活道路における法定速度について",
      "JAF交通安全トレーニングコラム「2026年法改正」",
      "国土交通省 道路局"
    ],
    keyPoints: [
      "2026年9月1日から生活道路の法定速度が60km/hから30km/hに引き下げ",
      "中央線・車両通行帯のない道路が対象、全国一般道路の約7割に相当",
      "通学路を含む生活道路での速度超過取り締まりが強化される見通し"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/residential-road-30kmh.png",
    verifiedAt: "2026-03-21T09:00:00+09:00"
  },
  {
    id: "news-2026-03-13-001",
    slug: "spring-suspicious-alert-school-route-20260313",
    title: "【全国】新入学シーズン前後に通学路の不審者情報が増加—春の防犯対策を強化",
    excerpt: "毎年3〜4月は新1年生が一人歩きを始める時期と重なり、通学路での声かけ・つきまとい事案が急増。警察庁データでは、4〜5月の登下校時間帯の不審者情報は年間ピークを迎える。",
    content: `## 春季の不審者情報増加傾向

警察庁の統計によると、子どもに対する声かけ・つきまとい等の不審者事案は、毎年**3月下旬から5月にかけて件数が増加**する傾向があります。

### 主な増加要因

1. **新1年生の入学**：慣れない通学路を一人歩きし始める小学1年生が標的になりやすい
2. **登下校ルートの変化**：進学・進級による通学路の変更で子どもが周囲への注意が散漫になりがち
3. **見守り体制の空白**：新しいルートに対応した見守りボランティアの配置が遅れる場合がある

### 2026年3月の事案例

東京都内では2026年3月に複数の声かけ・つきまとい情報が報告されており、「ガッコム安全ナビ」等のサービスで保護者へのアラートが相次いで発信されています。

特に**夕方〜夜間の路上**での事案が多く、塾帰りや習い事帰りの子どもが対象となるケースが見られます。

### 不審者への対処「いかのおすし」

| 合言葉 | 意味 |
|--------|------|
| **いか**ない | 知らない人についていかない |
| **の**らない | 知らない人の車に乗らない |
| **お**おきな声を出す | 大声で助けを呼ぶ |
| **す**ぐ逃げる | 安全な場所へすぐ逃げる |
| **し**らせる | 大人や警察に知らせる |

### 保護者・学校にできること

1. **通学路の確認**：新入学・進学前に子どもと一緒に通学路を歩き、危険箇所を確認
2. **防犯ブザーの携帯確認**：電池切れがないか定期チェック
3. **帰宅時間の把握**：寄り道しないで帰宅する習慣づけ
4. **地域への情報共有**：不審者を見かけたら学校・警察・地域の情報ネットワークに速やかに報告

### ガッコム安全ナビの活用

「ガッコム安全ナビ」では、地域ごとの不審者情報をリアルタイムで確認できます。保護者はスマートフォンで自分の居住地域の情報を取得し、子どもへの注意喚起に活用できます。`,
    category: "suspicious",
    categoryLabel: "不審者情報",
    categoryColor: "#F97316",
    categoryIcon: "AlertCircle",
    publishedDate: "2026-03-13T09:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["不審者", "声かけ", "つきまとい", "新入学", "春の防犯", "いかのおすし"],
    sources: [
      "警察庁 不審者情報統計",
      "ガッコム安全ナビ（2026年3月）",
      "文部科学省 学校安全参考資料"
    ],
    keyPoints: [
      "3〜5月は新1年生入学と重なり通学路での不審者情報が年間ピークを迎える",
      "夕方〜夜間の路上での声かけ・つきまとい事案に警戒が必要",
      "「いかのおすし」を子どもに再確認し、防犯ブザーの携帯・点検を徹底"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/spring-suspicious-alert.png",
    verifiedAt: "2026-03-21T09:00:00+09:00"
  },
  {
    id: "news-2026-03-10-001",
    slug: "zone30plus-65-model-districts-20260310",
    title: "【全国】国土交通省 ゾーン30プラスの新モデル地区65箇所を選定—新学期前に通学路整備を加速",
    excerpt: "国土交通省が通学路の面的安全対策を推進する「ゾーン30プラス」のモデル地区として新たに65箇所を選定。道路管理者・警察・学校が連携し、ハンプ設置やカラー舗装など物理的対策を強化する。",
    content: `## モデル地区選定の概要

国土交通省は2026年3月、生活道路における歩行者優先の安全空間を確保するため、**「ゾーン30プラス」モデル地区として全国65箇所**を新たに選定しました。

### ゾーン30プラスとは

「ゾーン30プラス」は、以下の2つの対策を組み合わせた通学路安全システムです。

- **警察による速度規制**：最高速度30km/hの区域規制
- **道路管理者による物理的デバイス**：ハンプ・狭さく・カラー舗装等の設置

従来の「ゾーン30」（速度規制のみ）より確実な速度抑制効果が期待されます。

### 新モデル地区での実施内容

65箇所のモデル地区では、道路管理者が**警察や学校・教育委員会・PTA**と連携して以下の対策を実施します。

| 対策の種類 | 内容 |
|-----------|------|
| ハンプ設置 | 路面に緩やかな盛り上がりを設け、車の速度を物理的に抑制 |
| 狭さく（シケイン）| 走行幅を狭めることで速度低下を促す |
| カラー舗装 | 歩行者通行空間を色で明示し視覚的に注意を促す |
| グリーンベルト | 車道外側線に緑色の路面標示で歩行区間を明示 |

### 整備の進捗状況

- 2025年3月末時点：全国186地区に「ゾーン30プラス」を導入済み
- 2026年3月時点：新たに65箇所をモデル地区として選定、整備開始予定
- ETC2.0プローブデータを活用した交通実態分析で効果測定も実施

### 通学路への期待効果

国土交通省の試算では、物理的デバイスの組み合わせにより、対象地区内の**平均走行速度が約5〜10km/h低下**し、歩行者の事故リスクが大幅に減少するとされています。

### 保護者・地域にできること

1. **整備状況の確認**：地元自治体のウェブサイトで通学路の整備予定を確認
2. **危険箇所の報告**：学校や自治体への危険箇所報告がモデル地区選定の判断材料になる
3. **整備後の評価**：設置されたデバイスが機能しているか継続的に観察・報告`,
    category: "infrastructure",
    categoryLabel: "インフラ整備",
    categoryColor: "#3B82F6",
    categoryIcon: "Construction",
    publishedDate: "2026-03-10T10:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["ゾーン30プラス", "国土交通省", "モデル地区", "ハンプ", "カラー舗装", "通学路整備"],
    sources: [
      "国土交通省 道路局 報道発表資料",
      "国土交通省「通学路等の交通安全対策」ページ",
      "警察庁 生活道路対策"
    ],
    keyPoints: [
      "国交省がゾーン30プラスのモデル地区として全国65箇所を新たに選定",
      "ハンプ・狭さく・カラー舗装等の物理的デバイスで速度を確実に抑制",
      "道路管理者・警察・学校・PTAが連携し新学期前に通学路整備を加速"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/zone30plus-model-districts.png",
    verifiedAt: "2026-03-21T09:00:00+09:00"
  },
  {
    id: "news-2026-03-05-001",
    slug: "new-first-grader-traffic-accident-risk-spring-20260305",
    title: "【全国】新1年生の交通事故リスクが最高水準—入学直後の4〜5月に集中、通学路の事前確認を",
    excerpt: "文部科学省・警察庁のデータで、小学1年生の交通事故発生率は6年生の約4倍。事故の6割以上が入学後2ヶ月以内に集中するため、新学期前の通学路安全確認と交通安全教育の徹底が急務。",
    content: `## 新1年生の交通事故リスク

文部科学省と警察庁の合同調査によると、小学1年生の歩行中の交通事故発生率は**6年生の約4倍**に達し、入学直後の4〜5月に事故が集中することが明らかになっています。

### 事故が多発する時間帯・状況

| 時間帯 | 割合 |
|--------|------|
| 登校時（7〜8時台） | 約25% |
| 下校時（15〜17時台） | 約45% |
| その他の時間帯 | 約30% |

下校時の事故が最も多く、特に**一人で帰宅する際の飛び出し**や**信号のない交差点**での見落としが主因です。

### 事故多発の要因

1. **距離感・速度感の未発達**：車の速度を正確に把握する認知能力が低年齢ほど未熟
2. **視野の狭さ**：子どもの視野角は大人より狭く、側方から来る車を見落としやすい
3. **不慣れな通学路**：毎日異なる帰り方をしたり、寄り道で不慣れな道を歩くケース
4. **集団登校の解散後**：集団登校の解散地点から自宅までの「最後の区間」が危険

### 入学前に家族でやること

**通学路の事前確認チェックリスト**

- [ ] 実際の通学路を子どもと一緒に歩く（往復）
- [ ] 信号のない交差点・見通しの悪い場所を確認
- [ ] 「一時停止」「右左確認」の練習
- [ ] 防犯ブザーの使い方を確認
- [ ] 雨の日・暗い日の見え方の違いを体験
- [ ] 緊急時に駆け込める場所（コンビニ・交番等）を確認

### 学校・地域への協力

- **春の交通安全運動**（2026年4月6日〜15日）：登下校時間帯の見守り強化期間
- **スクールガード**への参加：地域全体で新1年生を見守る体制づくり
- **ヒヤリハット情報の共有**：危うく事故になりそうだった場所を学校・PTAに報告

### 自治体の支援制度

多くの自治体では、新1年生の通学路安全確保のため以下の支援を実施しています。

- 通学路の緊急点検（入学前後）
- 交通安全指導員の派遣
- 反射材・蛍光ランドセルカバーの配布
- 交通安全教育プログラムの実施`,
    category: "accident",
    categoryLabel: "交通事故",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-03-05T09:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["新入学", "小学1年生", "交通事故", "登下校", "春の交通安全運動", "飛び出し"],
    sources: [
      "文部科学省 学校安全の推進に関する計画",
      "警察庁 子どもの交通事故統計",
      "内閣府 交通安全白書"
    ],
    keyPoints: [
      "小学1年生の交通事故発生率は6年生の約4倍、入学後2ヶ月以内に事故が集中",
      "下校時（15〜17時台）の事故が全体の約45%を占め、一人歩き中の飛び出しが主因",
      "入学前に家族で通学路を歩き、信号・交差点での安全確認を実地練習することが重要"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/new-first-grader-safety.png",
    isBreaking: false,
    verifiedAt: "2026-03-21T09:00:00+09:00"
  },
  {
    id: "news-2026-02-09-001",
    slug: "iga-city-safety-signs-donation-20260209",
    title: "三重県伊賀市で建設会社が通学路に「飛び出し注意」看板を寄贈",
    excerpt: "伊賀市の竹島建設が、阿山小・中学校への通学路となっている県道沿いに「飛び出し注意」看板10基を寄贈。地域と企業の協働による通学路安全対策の事例。",
    content: `## 寄贈の概要

三重県伊賀市玉瀧の竹島建設が2026年2月9日、同市馬場、川合の2地区に「飛び出し注意」看板を5基ずつ、計10基寄贈しました。

### 寄贈の背景

両地区を通る**県道上友田円徳院線**は、阿山小学校（馬場）や阿山中学校（千貝）への通学路になっています。

竹島建設は「現場へ向かって県道を行き来した際、危険と思う路地が複数あった」ことから、地元への寄贈を提案しました。

### 設置場所の決定

具体的な設置場所は、今後**地区役員で協議**して決める予定です。地域住民が最も必要と感じる場所に設置することで、効果的な安全対策が期待されます。

### 地域と企業の協働モデル

この事例は、通学路の安全対策における「地域と企業の協働」の好事例として注目されます。

**ポイント:**
1. **現場の気づき**: 企業が業務で地域を往来する中で危険箇所を発見
2. **自主的な提案**: 行政に頼るだけでなく、企業側から安全対策を提案
3. **地域との協議**: 設置場所は地区役員と協議し、地域の声を反映
4. **持続可能性**: 企業のCSR活動として継続的な支援の可能性

### 全国の類似事例

企業による通学路安全対策の支援は全国で広がりつつあります。

- 看板・標識の寄贈
- 見守りボランティアへの参加
- 通学路の清掃活動
- 安全教育プログラムへの協力

### 保護者・地域にできること

企業の支援を受けつつ、保護者や地域住民ができることもあります。

1. **危険箇所の共有**: 地域で気づいた危険箇所を学校・自治体に報告
2. **看板の維持管理**: 寄贈された看板が見えづらくなっていないか定期確認
3. **感謝の表明**: 協力してくれる企業への感謝を伝え、継続的な関係を構築`,
    category: "community",
    categoryLabel: "地域活動",
    categoryColor: "#22C55E",
    categoryIcon: "Users",
    publishedDate: "2026-02-09T10:00:00+09:00",
    location: {
      prefecture: "三重県",
      city: "伊賀市",
      area: "馬場、川合"
    },
    tags: ["企業寄贈", "飛び出し注意", "通学路看板", "地域協働", "三重県", "CSR活動"],
    sources: [
      "伊賀タウン情報 YOU（2026年2月10日）",
      "伊賀市教育委員会 通学路交通安全プログラム"
    ],
    keyPoints: [
      "竹島建設が通学路に「飛び出し注意」看板10基を寄贈",
      "県道上友田円徳院線は阿山小・中学校への通学路",
      "地域と企業の協働による安全対策の好事例"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/iga-safety-signs.png",
    verifiedAt: "2026-02-10T09:00:00+09:00"
  },
  {
    id: "news-2026-02-01-001",
    slug: "bicycle-blue-ticket-school-route-impact-20260201",
    title: "4月施行の自転車青切符制度、通学路への影響と対策",
    excerpt: "2026年4月から自転車にも青切符が導入。13歳未満は対象外だが、通学路での自転車ルール変更により保護者・学校の対応が急務に。",
    content: `## 改正道路交通法の概要

2026年4月1日から施行される改正道路交通法により、自転車にも「青切符」制度が導入されます。

### 主な変更点
- 自転車の交通違反に反則金制度を適用（16歳以上が対象）
- 自転車は原則として車道の左側を通行
- 通行区分違反には反則金6,000円
- 歩道通行は標識のある場所か、やむを得ない場合のみ

### 通学路への影響
- 13歳未満の児童は歩道通行が引き続き可能
- 高校生の自転車通学が大きく影響を受ける
- 保護者の送迎時の自転車利用にも注意が必要
- 通学路周辺の自転車交通量の変化が予想される

### 学校・保護者に求められる対応
- 児童への自転車安全教育の強化
- 通学路の危険箇所の再点検
- 新ルールに対応した安全指導の実施
- PTA・地域と連携した見守り体制の確認`,
    category: "policy",
    categoryLabel: "施策・対策",
    categoryColor: "#8B5CF6",
    categoryIcon: "FileText",
    publishedDate: "2026-02-01T09:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["道路交通法改正", "自転車", "青切符", "通学路", "2026年4月"],
    sources: [
      "政府広報オンライン",
      "JAF交通安全トレーニング",
      "警察庁"
    ],
    keyPoints: [
      "2026年4月から自転車にも青切符制度を導入",
      "13歳未満は対象外、歩道通行は引き続き可能",
      "通学路周辺の自転車ルール変更に学校・保護者の対応が必要"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/bicycle-blue-ticket.png",
    verifiedAt: "2026-02-01T10:00:00+09:00"
  },
  {
    id: "news-2026-01-19-001",
    slug: "fukuoka-asakura-bicycle-accident-20260119",
    title: "福岡県朝倉市で自転車の小学生2人が貨物自動車にはねられ1人死亡",
    excerpt: "1月19日午後3時50分頃、朝倉市屋永の道路交差点で、自転車に乗っていた小学2年生の男児2人が貨物自動車にはねられ、1人が死亡、1人が鎖骨骨折の重傷。",
    content: `## 事故の概要

2026年1月19日午後3時50分頃、福岡県朝倉市屋永の道路で、自転車に乗っていた小学2年生の男児2人（いずれも8歳）が普通貨物自動車にはねられました。

### 被害状況
- 男児1人が頭部を打つなどして死亡
- もう1人が鎖骨を折るなど重傷を負い病院に搬送

### 事故の状況
- 現場は信号機のない交差点
- 走行中の貨物自動車と自転車に乗った男児2人が衝突
- 現場に目立ったブレーキ痕はなく、前方不注意が原因とみられる

### 逮捕
福岡県警は、自称会社役員の男（53）を過失運転致傷の疑いで現行犯逮捕しました。`,
    category: "accident",
    categoryLabel: "交通事故",
    categoryColor: "#EF4444",
    categoryIcon: "AlertTriangle",
    publishedDate: "2026-01-19T16:30:00+09:00",
    location: {
      prefecture: "福岡県",
      city: "朝倉市",
      area: "屋永"
    },
    tags: ["交通事故", "小学生", "自転車", "死亡事故", "福岡県"],
    sources: [
      "共同通信",
      "RKBニュース",
      "福岡県警察"
    ],
    keyPoints: [
      "自転車の小学2年生2人が信号なし交差点で貨物自動車にはねられた",
      "1人死亡、1人が鎖骨骨折の重傷",
      "運転者（53歳）を現行犯逮捕、前方不注意の疑い"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/fukuoka-asakura-accident.png",
    isBreaking: true,
    verifiedAt: "2026-01-19T18:00:00+09:00"
  },
  {
    id: "news-2026-01-15-001",
    slug: "mext-school-safety-volunteer-awards-20260115",
    title: "文部科学省、学校安全ボランティア活動奨励賞の受賞団体を発表",
    excerpt: "文科省が全国のスクールガード・見守りボランティア団体を表彰。通学路の安全を支える地域活動が評価され、各地の取り組みが注目される。",
    content: `## 表彰の概要

文部科学省は、学校保健及び学校安全の普及と向上に尽力し、多大な成果をあげた個人・学校・団体等に対する表彰を実施しました。

### 学校安全ボランティア活動奨励賞
通学路の安全確保のため、以下の活動を行っている団体が受賞:
- 通学時の児童の保護・誘導
- 校内・通学路のパトロール
- 地域の見守りネットワークの構築
- 「ながら見守り」活動の推進

### 受賞の要件
- 子供を守るための実践的なボランティア活動を行っている団体
- 町内会、自治会、商店街、ボランティア団体等
- 他の規範となる活動と認められること

### 全国の見守り活動の広がり
- スクールガード登録者は全国で約100万人
- 「ながら見守り」活動が各自治体で推進
- 地域全体で子どもを見守る体制が拡充`,
    category: "community",
    categoryLabel: "地域活動",
    categoryColor: "#22C55E",
    categoryIcon: "Users",
    publishedDate: "2026-01-15T12:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["文部科学省", "スクールガード", "見守り", "ボランティア", "表彰"],
    sources: [
      "文部科学省",
      "登下校見守り活動ハンドブック（文科省）"
    ],
    keyPoints: [
      "文科省がスクールガード・見守り団体を表彰",
      "全国のスクールガード登録者は約100万人",
      "「ながら見守り」活動が各自治体で拡大中"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/mext-volunteer-awards.png",
    verifiedAt: "2026-01-16T09:00:00+09:00"
  },
  {
    id: "news-2025-06-17-001",
    slug: "zone30plus-263-districts-expansion-20250617",
    title: "国交省「ゾーン30プラス」全国263地区への展開を発表",
    excerpt: "国土交通省は2025年6月、新たに77地区の整備計画を策定。既存186地区と合わせ全国263地区での展開を予定。速度規制と物理的デバイスを組み合わせた通学路の安全対策を推進。",
    content: `## ゾーン30プラスとは

国土交通省と警察庁は連携し、生活道路における歩行者優先の安全空間を確保する「ゾーン30プラス」の整備を全国で推進しています。

### 最新の整備状況

- **2025年3月末時点**: 全国186地区で「ゾーン30プラス」を導入済み
- **2025年6月17日**: 国土交通省が新たに77地区の整備計画を発表
- **今後の展開**: 全国263地区での展開を予定

### ゾーン30プラスの仕組み
- 最高速度30km/hの区域規制（警察）
- ハンプ・狭さくなどの物理的デバイスの設置（道路管理者）
- 両者の組み合わせにより、生活道路を人優先の安全空間に

### 従来のゾーン30との違い
従来の「ゾーン30」（2024年度末時点で全国4,410地区で実施）は速度規制のみでしたが、「ゾーン30プラス」はハンプや狭さくなどの物理的デバイスを組み合わせることで、より確実な速度抑制効果が期待されます。

### 通学路への効果
- ETC2.0プローブデータを活用した交通実態の分析
- 道路管理者・警察・学校・教育委員会・PTAの連携
- 速度抑制・進入抑制のための物理的対策の実施
- 国庫補助等による経済的支援`,
    category: "infrastructure",
    categoryLabel: "インフラ整備",
    categoryColor: "#3B82F6",
    categoryIcon: "Construction",
    publishedDate: "2025-06-17T10:00:00+09:00",
    location: {
      prefecture: "全国"
    },
    tags: ["ゾーン30プラス", "国土交通省", "警察庁", "通学路", "速度規制"],
    sources: [
      "国土交通省 報道発表資料（2025年6月17日）",
      "警察庁",
      "東京海上ディーアール コラム"
    ],
    keyPoints: [
      "2025年3月末時点で全国186地区に導入済み",
      "新たに77地区の整備計画を策定、計263地区へ展開予定",
      "速度30km/h規制と物理的デバイスの組み合わせで安全確保"
    ],
    thumbnailUrl: "/images/school-route-news/thumbnails/zone30plus-model.png",
    verifiedAt: "2025-06-18T09:00:00+09:00"
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

// 日付をフォーマット
export function formatNewsDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
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
