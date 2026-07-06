/**
 * Danger Level Presentation
 *
 * 危険レベル(danger_level: 1〜4)の表示定義を一元化するモジュール。
 * レポート(地図ピン・カード帯)とダイアログ(バッジ)の両方がここを参照する。
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
  },
  2: {
    level: 2,
    kidLabel: 'ちゅうい',
    stars: '★★☆☆',
    colorHex: '#f59e0b', // amber-500
    pinColor: 'f59e0b',
    kidPhrase: 'ちゃんと みて とおろう',
    badgeVariant: 'secondary',
  },
  3: {
    level: 3,
    kidLabel: 'とてもちゅうい',
    stars: '★★★☆',
    colorHex: '#f97316', // orange-500
    pinColor: 'f97316',
    kidPhrase: 'かならず とまって かくにん',
    badgeVariant: 'destructive',
  },
  4: {
    level: 4,
    kidLabel: 'いちばんちゅうい',
    stars: '★★★★',
    colorHex: '#ef4444', // red-500
    pinColor: 'ef4444',
    kidPhrase: 'おうちのひとと いっしょに かくにんしてね',
    badgeVariant: 'destructive',
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
