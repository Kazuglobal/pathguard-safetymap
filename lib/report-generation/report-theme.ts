/**
 * Route Danger Report — 「たんけんノート」レポートテーマ
 *
 * アプリ全体のデザイン言語(lib/design/tanken.ts)を、印刷前提の
 * レポートHTML(document.createElement によるDOM構築)へ持ち込むための
 * トークンとスタイルヘルパ。
 *
 * 印刷ポリシー(重要):
 *  - 背景のベタ塗りは使わない。白背景に、クリーム/みどり/黄の
 *    「帯・枠線・小さな装飾」だけで世界観を作り、インク量を抑える。
 *  - 段階(危険レベル)は色だけに頼らず星の数で伝える
 *    (色覚多様性・モノクロ印刷対応)。
 *  - 子ども向けテキストは分かち書き前提: word-break は keep-all。
 */

import { tankenTokens } from '@/lib/design/tanken'

const C = tankenTokens.color

export const reportTheme = {
  /** レポートHTMLの固定幅(px)。html2canvas レンダリングの基準。 */
  containerWidthPx: 800,
  color: {
    paper: C.paper,
    paperDeep: C.paperDeep,
    card: C.card,
    ink: C.ink,
    inkSoft: C.inkSoft,
    inkFaint: C.inkFaint,
    primary: C.primary,
    primaryStrong: C.primaryStrong,
    primarySoft: C.primarySoft,
    accent: C.accent,
    accentStrong: C.accentStrong,
    accentSoft: C.accentSoft,
    sun: C.sun,
    sunDeep: C.sunDeep,
    sunSoft: C.sunSoft,
    danger: C.danger,
    dangerSoft: C.dangerSoft,
    borderFaint: 'rgba(67,57,43,.12)',
    borderSoft: 'rgba(67,57,43,.18)',
  },
  /** 子ども向けページ: 丸ゴシック(グローバル読み込み済みの Zen Maru Gothic) */
  font: tankenTokens.font.family,
  /** 学校・事務向けページ: 従来どおりの sans-serif */
  officeFont: 'sans-serif',
  radius: {
    card: 16,
    panel: 12,
    chip: 8,
  },
} as const

/**
 * 手描き風アンダーライン(黄)。タイトルの下に敷く。
 * theme.tsx の SVG アンダーラインと同じモチーフの data-URI 版。
 */
export const HAND_DRAWN_UNDERLINE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='6' viewBox='0 0 120 6' preserveAspectRatio='none'%3E%3Cpath d='M2 4 Q30 1 60 3.2 T118 2.6' fill='none' stroke='%23FFC93E' stroke-width='3.4' stroke-linecap='round'/%3E%3C/svg%3E\")"

/**
 * 点線トレイル(探検の「みち」)。セクション区切りの装飾に使う。
 */
export const DOTTED_TRAIL =
  'repeating-linear-gradient(90deg, rgba(67,57,43,.28) 0 4px, transparent 4px 12px)'

export type ReportSectionTone = 'tanken' | 'office'

/**
 * セクションのルート要素を作る。各セクションは html2canvas で
 * 単独レンダリングできるよう自己完結(固定幅・白背景・フォント込み)にする。
 */
export function createSectionRoot(tone: ReportSectionTone = 'tanken'): HTMLDivElement {
  const root = document.createElement('div')
  root.style.width = `${reportTheme.containerWidthPx}px`
  root.style.boxSizing = 'border-box'
  root.style.padding = '20px 28px'
  root.style.backgroundColor = '#ffffff'
  root.style.fontFamily = tone === 'tanken' ? reportTheme.font : reportTheme.officeFont
  root.style.color = reportTheme.color.ink
  if (tone === 'tanken') {
    // 分かち書き前提の改行制御(単語の途中で折り返さない)
    root.style.wordBreak = 'keep-all'
    root.style.overflowWrap = 'break-word'
  }
  return root
}

/**
 * 「ちゅういポイント ①」のような見出し帯。左に太い色ボーダー、
 * 背景は白のまま(インク節約)。
 */
export function createHeadingBand(options: {
  text: string
  accentColor: string
  rightText?: string
  rightTextColor?: string
}): HTMLDivElement {
  const band = document.createElement('div')
  band.style.display = 'flex'
  band.style.alignItems = 'center'
  band.style.justifyContent = 'space-between'
  band.style.gap = '12px'
  band.style.borderLeft = `8px solid ${options.accentColor}`
  band.style.borderBottom = `2px solid ${reportTheme.color.borderFaint}`
  band.style.padding = '6px 12px'
  band.style.marginBottom = '12px'

  const title = document.createElement('div')
  title.textContent = options.text
  title.style.fontSize = '18px'
  title.style.fontWeight = 'bold'
  title.style.color = reportTheme.color.ink
  band.appendChild(title)

  if (options.rightText) {
    const right = document.createElement('div')
    right.textContent = options.rightText
    right.style.fontSize = '15px'
    right.style.fontWeight = 'bold'
    right.style.whiteSpace = 'nowrap'
    right.style.color = options.rightTextColor ?? reportTheme.color.inkSoft
    band.appendChild(right)
  }

  return band
}

/**
 * マスキングテープ風の飾り(写真の上辺に貼る半透明の矩形)。
 */
export function createTapeDecoration(side: 'left' | 'right'): HTMLSpanElement {
  const tape = document.createElement('span')
  tape.style.position = 'absolute'
  tape.style.top = '-10px'
  tape.style[side] = '24px'
  tape.style.width = '56px'
  tape.style.height = '20px'
  tape.style.borderRadius = '3px'
  tape.style.transform = side === 'left' ? 'rotate(-6deg)' : 'rotate(6deg)'
  tape.style.backgroundColor =
    side === 'left' ? 'rgba(255,201,62,.75)' : 'rgba(126,200,227,.7)'
  return tape
}

/**
 * 点線トレイルの区切り線。
 */
export function createTrailDivider(): HTMLDivElement {
  const divider = document.createElement('div')
  divider.style.height = '2px'
  divider.style.margin = '14px 0'
  divider.style.backgroundImage = DOTTED_TRAIL
  divider.style.backgroundRepeat = 'repeat-x'
  divider.style.backgroundSize = '12px 2px'
  return divider
}

/**
 * シール風チップ(白フチ+わずかな傾き)。星ラベルなどに使う。
 */
export function createStickerChip(options: {
  text: string
  color: string
  softColor?: string
  tiltDeg?: number
}): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.textContent = options.text
  chip.style.display = 'inline-block'
  chip.style.padding = '3px 12px'
  chip.style.borderRadius = '9999px'
  chip.style.border = `2px solid ${options.color}`
  chip.style.backgroundColor = options.softColor ?? '#ffffff'
  chip.style.color = reportTheme.color.ink
  chip.style.fontSize = '13px'
  chip.style.fontWeight = 'bold'
  chip.style.whiteSpace = 'nowrap'
  if (options.tiltDeg) {
    chip.style.transform = `rotate(${options.tiltDeg}deg)`
  }
  return chip
}
