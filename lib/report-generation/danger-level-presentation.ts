/**
 * Danger Level Presentation
 *
 * 危険レベル(danger_level)の表示定義を一元化するモジュール。
 * レポート(地図ピン・カード帯)・ダイアログ(バッジ)・ライブ地図マーカー・
 * AR表示・サイドバー・詳細モーダルのすべてがここを参照する。
 *
 * 入力データは1〜5がありうる(投稿フォームは5段階)が、表示は1〜4に
 * クランプする。5は4(いちばんちゅうい)と同じ最危険表示になる。
 *
 * 背景: データは1〜4段階だが、かつて表示側が1〜3しか扱っておらず、
 * レベル4(最危険)が「低」ラベル・黄色ピンで描画されるバグがあった。
 * 範囲外の値は必ず 1〜4 にクランプし、「不明なら安全側(=低)に見せる」
 * 逆転を起こさない。
 *
 * 表現方針(教育的レポート向け):
 *  - 星の数(★の個数)を主表現にする。色だけに頼らないため、
 *    色覚多様性・モノクロ印刷でも段階が伝わる。
 *  - kidLabel / kidPhrase は小学校低〜中学年向けのことば。
 */

export type DangerLevel = 1 | 2 | 3 | 4

export const DANGER_LEVEL_MAX: DangerLevel = 4

export interface DangerLevelPresentation {
  level: DangerLevel
  /** 子ども向けラベル(例: とてもちゅうい) */
  kidLabel: string
  /** 星4つ固定の段階表示(例: ★★★☆) */
  stars: string
  /** カード帯・バッジ用の色(#付きhex) */
  colorHex: string
  /** Mapbox Static Images のピン色(#なしhex) */
  pinColor: string
  /** 子ども向けのひとこと(例: かならず とまって かくにん) */
  kidPhrase: string
  /** shadcn Badge の variant */
  badgeVariant: 'outline' | 'secondary' | 'destructive'
  /** バッジ用 Tailwind クラス(bg-*-100 text-*-800 border-*-200) */
  badgeClass: string
  /** 一覧カード左端のアクセント(border-l-*-500) */
  borderAccentClass: string
  /** 詳細ヘッダー等の面配色。band は colorHex と同色相 */
  surface: {
    bg: string
    text: string
    border: string
    band: string
  }
}

const PRESENTATIONS: Record<DangerLevel, DangerLevelPresentation> = {
  1: {
    level: 1,
    kidLabel: 'きをつけて',
    stars: '★☆☆☆',
    colorHex: '#eab308', // yellow-500
    pinColor: 'eab308',
    kidPhrase: 'すこし きをつけよう',
    badgeVariant: 'outline',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    borderAccentClass: 'border-l-yellow-500',
    surface: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      band: 'bg-yellow-500',
    },
  },
  2: {
    level: 2,
    kidLabel: 'ちゅうい',
    stars: '★★☆☆',
    colorHex: '#f59e0b', // amber-500
    pinColor: 'f59e0b',
    kidPhrase: 'ちゃんと みて とおろう',
    badgeVariant: 'secondary',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    borderAccentClass: 'border-l-amber-500',
    surface: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      band: 'bg-amber-500',
    },
  },
  3: {
    level: 3,
    kidLabel: 'とてもちゅうい',
    stars: '★★★☆',
    colorHex: '#f97316', // orange-500
    pinColor: 'f97316',
    kidPhrase: 'かならず とまって かくにん',
    badgeVariant: 'destructive',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    borderAccentClass: 'border-l-orange-500',
    surface: {
      bg: 'bg-orange-50',
      text: 'text-orange-800',
      border: 'border-orange-200',
      band: 'bg-orange-500',
    },
  },
  4: {
    level: 4,
    kidLabel: 'いちばんちゅうい',
    stars: '★★★★',
    colorHex: '#ef4444', // red-500
    pinColor: 'ef4444',
    kidPhrase: 'おうちのひとと いっしょに かくにんしてね',
    badgeVariant: 'destructive',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    borderAccentClass: 'border-l-red-500',
    surface: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
      band: 'bg-red-500',
    },
  },
}

function clampDangerLevel(level: number): DangerLevel {
  if (!Number.isFinite(level)) {
    // NaN等は最低レベル扱い。ただしInfinityは「大きい」ので最大に寄せる
    return level === Number.POSITIVE_INFINITY ? DANGER_LEVEL_MAX : 1
  }
  if (level <= 1) return 1
  if (level >= DANGER_LEVEL_MAX) return DANGER_LEVEL_MAX
  return Math.round(level) as DangerLevel
}

export function getDangerLevelPresentation(level: number): DangerLevelPresentation {
  return PRESENTATIONS[clampDangerLevel(level)]
}

/**
 * バッジ等で使う「★段階+子ども向けラベル」の合成表示(例: ★★★☆ とてもちゅうい)。
 * 各画面で `${stars} ${kidLabel}` を再実装しないこと(表記ズレの温床になる)。
 */
export function formatDangerLevelBadgeText(level: number): string {
  const presentation = getDangerLevelPresentation(level)
  return `${presentation.stars} ${presentation.kidLabel}`
}
