/**
 * Route Danger Report — 教育版セクションビルダー
 *
 * レポートを「子どもと保護者が一緒に読んで学べるページ」の集まりとして
 * 構築する。各ビルダーは自己完結した固定幅の HTMLDivElement を返し、
 * PDF ではセクション単位でページに割り付けられる(カードがページ境界で
 * 分断されない)。PNG/JPEG では縦に連結して1枚画像になる。
 *
 * 文言のデータソース:
 *  - 子ども向け: createKidsHazardCue (lib/ar-learning-tour-kids.ts)
 *  - 保護者向け: createARLearningContent (lib/ar-learning-tour.ts)
 *    ※ LLM生成の learning_summary があれば優先、無ければタイプ別テンプレート
 *
 * プライバシー: 学校・地域共有用サマリー(buildSchoolSummarySection)には
 * 報告写真・説明文(description)を載せない。
 */

import type { DangerReport, RouteDangerReport } from '@/lib/types'
import { createARLearningContent } from '@/lib/ar-learning-tour'
import { createKidsHazardCue } from '@/lib/ar-learning-tour-kids'
import { getDangerLevelPresentation } from './danger-level-presentation'
import {
  MAP_CALLOUT_LIMIT,
  MAP_CALLOUT_THUMBNAIL_LIMIT,
  assignDangerMarkerLabels,
  generateOverviewMapUrl,
} from './report-map'
import { resolveDangerDisplayImageUrl } from './report-images'
import {
  HAND_DRAWN_UNDERLINE,
  createHeadingBand,
  createSectionRoot,
  createStickerChip,
  createTapeDecoration,
  createTrailDivider,
  reportTheme,
} from './report-theme'

const C = reportTheme.color

/* ------------------------------------------------------------------ *
 * 共通ヘルパ
 * ------------------------------------------------------------------ */

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDistance(meters: number | null): string {
  if (meters === null) {
    return '-'
  }
  if (meters < 1000) {
    return `${meters}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

function formatLocation(danger: DangerReport): string {
  return [danger.prefecture, danger.city, danger.town].filter(Boolean).join('')
}

function createText(options: {
  text: string
  fontSize: string
  color?: string
  bold?: boolean
  margin?: string
}): HTMLParagraphElement {
  const p = document.createElement('p')
  p.textContent = options.text
  p.style.fontSize = options.fontSize
  p.style.color = options.color ?? C.ink
  p.style.margin = options.margin ?? '4px 0'
  if (options.bold) {
    p.style.fontWeight = 'bold'
  }
  return p
}

/** 手書きチェック用の四角(□)。印刷して✔を書き込む前提。 */
function createCheckboxSquare(): HTMLSpanElement {
  const box = document.createElement('span')
  box.style.display = 'inline-block'
  box.style.width = '16px'
  box.style.height = '16px'
  box.style.flexShrink = '0'
  box.style.border = `2.5px solid ${C.inkSoft}`
  box.style.borderRadius = '4px'
  box.style.backgroundColor = '#ffffff'
  return box
}

interface PhotoFallback {
  /** プレースホルダの表示サイズ(元画像の枠に合わせる) */
  width: string
  height: string
  radius: string
  /** サムネイル等の小枠ではテキストを省き、アイコンのみにする */
  compact?: boolean
  /** プレースホルダの見出し(既定: 写真の読込失敗) */
  label?: string
}

/**
 * 画像の読込に失敗したときに表示するプレースホルダ。
 * 旧ストレージパスの画像が 400/404 を返すケースで、空の灰色枠だと
 * 「写真なし」なのか「読込失敗」なのか親に判別できないため、明示する。
 */
function createBrokenPhotoPlaceholder(fallback: PhotoFallback): HTMLDivElement {
  const ph = document.createElement('div')
  ph.dataset.photoPlaceholder = 'broken'
  ph.style.width = fallback.width
  ph.style.height = fallback.height
  ph.style.boxSizing = 'border-box'
  ph.style.display = 'flex'
  ph.style.flexDirection = 'column'
  ph.style.alignItems = 'center'
  ph.style.justifyContent = 'center'
  ph.style.gap = '4px'
  ph.style.borderRadius = fallback.radius
  ph.style.backgroundColor = '#f3f4f6'
  ph.style.border = `1px dashed ${C.borderFaint}`
  ph.style.color = C.inkFaint

  const glyph = document.createElement('div')
  glyph.textContent = '🖼'
  glyph.style.fontSize = fallback.compact ? '15px' : '24px'
  glyph.style.opacity = '0.7'
  glyph.style.lineHeight = '1'
  ph.appendChild(glyph)

  if (!fallback.compact) {
    const label = document.createElement('div')
    label.textContent = fallback.label ?? 'しゃしんを よみこめませんでした'
    label.style.fontSize = '11px'
    label.style.fontWeight = 'bold'
    label.style.textAlign = 'center'
    ph.appendChild(label)
  }

  return ph
}

function createReportImage(
  url: string,
  alt: string,
  fallback?: PhotoFallback
): HTMLImageElement {
  const img = document.createElement('img')
  img.crossOrigin = 'anonymous' // Enable CORS for html2canvas
  img.src = url
  img.alt = alt
  if (fallback) {
    // 読込失敗時はキャプチャ前にDOMを差し替える(error は waitForImages より
    // 先に発火し得るため、img を querySelector から外して待ち時間も短縮できる)。
    img.addEventListener('error', () => {
      img.replaceWith(createBrokenPhotoPlaceholder(fallback))
    })
  }
  return img
}

/* ------------------------------------------------------------------ *
 * 1. 表紙 — 「つうがくろ あんぜんノート」
 * ------------------------------------------------------------------ */

export function buildCoverSection(report: RouteDangerReport): HTMLDivElement {
  const root = createSectionRoot('tanken')
  root.dataset.reportSection = 'cover'
  root.style.paddingTop = '28px'

  const supTitle = createText({
    text: 'みつけて まなぶ',
    fontSize: '13px',
    color: C.inkSoft,
    bold: true,
    margin: '0 0 2px 0',
  })
  root.appendChild(supTitle)

  const title = document.createElement('h1')
  title.textContent = `${report.route.name} の つうがくろ あんぜんノート`
  title.style.fontSize = '26px'
  title.style.fontWeight = 'bold'
  title.style.color = C.ink
  title.style.margin = '0 0 4px 0'
  root.appendChild(title)

  // 手描き風アンダーライン
  const underline = document.createElement('div')
  underline.style.width = '240px'
  underline.style.height = '6px'
  underline.style.backgroundImage = HAND_DRAWN_UNDERLINE
  underline.style.backgroundRepeat = 'no-repeat'
  underline.style.backgroundSize = '100% 100%'
  underline.style.marginBottom = '14px'
  root.appendChild(underline)

  const intro = createText({
    text: 'この ノートは、きみの つうがくろで みつかった 「ちゅういポイント」を おうちのひとと いっしょに よむための ものだよ。',
    fontSize: '14px',
    bold: true,
    margin: '0 0 14px 0',
  })
  root.appendChild(intro)

  // 発見数(大きく)
  const countRow = document.createElement('div')
  countRow.style.display = 'flex'
  countRow.style.alignItems = 'baseline'
  countRow.style.gap = '8px'
  countRow.style.padding = '10px 14px'
  countRow.style.border = `2px solid ${C.borderSoft}`
  countRow.style.borderRadius = `${reportTheme.radius.card}px`
  countRow.style.marginBottom = '12px'

  const countLabel = document.createElement('span')
  countLabel.textContent = 'はっけんした ちゅういポイント:'
  countLabel.style.fontSize = '15px'
  countLabel.style.fontWeight = 'bold'
  countLabel.style.color = C.ink
  countRow.appendChild(countLabel)

  const countValue = document.createElement('span')
  countValue.textContent = `${report.summary.totalDangers} こ`
  countValue.style.fontSize = '26px'
  countValue.style.fontWeight = 'bold'
  countValue.style.color = C.primaryStrong
  countRow.appendChild(countValue)
  root.appendChild(countRow)

  // レベル別の星チップ(危険度の高い順)
  if (report.summary.totalDangers > 0) {
    const chipRow = document.createElement('div')
    chipRow.style.display = 'flex'
    chipRow.style.flexWrap = 'wrap'
    chipRow.style.gap = '8px'
    chipRow.style.marginBottom = '14px'

    const levels = Object.entries(report.summary.byLevel)
      .map(([level, count]) => ({ level: parseInt(level, 10), count }))
      .sort((a, b) => b.level - a.level)

    for (const [chipIndex, { level, count }] of levels.entries()) {
      const presentation = getDangerLevelPresentation(level)
      chipRow.appendChild(
        createStickerChip({
          text: `${presentation.stars} ${presentation.kidLabel} ×${count}`,
          color: presentation.colorHex,
          tiltDeg: chipIndex % 2 === 0 ? -1.5 : 1.5,
        })
      )
    }
    root.appendChild(chipRow)
  }

  root.appendChild(createTrailDivider())

  // ルート情報(小さめ・事務情報)
  const metaLines = [
    `ルート距離: ${formatDistance(report.route.distance_meters)} / 検索範囲: ルート周辺${report.bufferMeters}m`,
    `作成日時: ${formatDate(report.generatedAt)}`,
  ]
  for (const line of metaLines) {
    root.appendChild(
      createText({ text: line, fontSize: '12px', color: C.inkSoft, margin: '2px 0' })
    )
  }

  return root
}

/* ------------------------------------------------------------------ *
 * 2. 地図 — 「ちずで みてみよう」
 * ------------------------------------------------------------------ */

export function buildMapSection(
  report: RouteDangerReport,
  mapboxToken: string
): HTMLDivElement | null {
  if (!report.route.route_geometry) {
    return null
  }

  const root = createSectionRoot('tanken')
  root.dataset.reportSection = 'map'

  root.appendChild(
    createHeadingBand({
      text: 'ちずで みてみよう',
      accentColor: C.primary,
      rightText: 'ばんごうは カードと おなじだよ',
    })
  )

  const mapUrl = generateOverviewMapUrl(
    report.route.route_geometry,
    report.dangers,
    mapboxToken,
    { width: 750, height: 400 }
  )
  const mapImg = createReportImage(mapUrl, '通学路と危険箇所の地図', {
    width: '100%',
    height: '260px',
    radius: `${reportTheme.radius.panel}px`,
    label: 'ちずを よみこめませんでした',
  })
  mapImg.style.width = '100%'
  mapImg.style.borderRadius = `${reportTheme.radius.panel}px`
  mapImg.style.border = `2px solid ${C.borderFaint}`
  root.appendChild(mapImg)

  appendMapCallouts(
    root,
    report.dangers,
    assignDangerMarkerLabels(report.dangers),
    report.selectedImageUrls,
    report.signedImageUrls
  )

  return root
}

function appendMapCallouts(
  parent: HTMLElement,
  dangers: DangerReport[],
  markerLabels: Map<string, string>,
  selectedImageUrls?: Record<string, string>,
  signedImageUrls?: Record<string, string>
): void {
  if (dangers.length === 0) {
    return
  }

  const calloutSection = document.createElement('div')
  calloutSection.style.marginTop = '10px'
  calloutSection.style.display = 'flex'
  calloutSection.style.flexDirection = 'column'
  calloutSection.style.gap = '8px'

  dangers.slice(0, MAP_CALLOUT_LIMIT).forEach((danger, index) => {
    const presentation = getDangerLevelPresentation(danger.danger_level)

    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '8px'
    row.style.padding = '8px'
    row.style.border = `1px solid ${C.borderFaint}`
    row.style.borderRadius = `${reportTheme.radius.panel}px`

    const marker = document.createElement('div')
    marker.textContent = markerLabels.get(danger.id) ?? ''
    marker.style.width = '24px'
    marker.style.height = '24px'
    marker.style.flexShrink = '0'
    marker.style.borderRadius = '9999px'
    marker.style.display = 'flex'
    marker.style.alignItems = 'center'
    marker.style.justifyContent = 'center'
    marker.style.fontWeight = 'bold'
    marker.style.fontSize = '12px'
    marker.style.color = '#ffffff'
    marker.style.backgroundColor = presentation.colorHex
    row.appendChild(marker)

    const textBlock = document.createElement('div')
    textBlock.style.flex = '1'

    const title = document.createElement('div')
    title.textContent = danger.title
    title.style.fontSize = '13px'
    title.style.fontWeight = '600'
    title.style.color = C.ink
    textBlock.appendChild(title)

    const subParts = [presentation.stars, formatLocation(danger)].filter(Boolean)
    const sub = document.createElement('div')
    sub.textContent = subParts.join(' ')
    sub.style.fontSize = '11px'
    sub.style.color = C.inkSoft
    textBlock.appendChild(sub)

    row.appendChild(textBlock)

    const imageUrl =
      index < MAP_CALLOUT_THUMBNAIL_LIMIT
        ? resolveDangerDisplayImageUrl(danger, selectedImageUrls, signedImageUrls)
        : null
    if (imageUrl) {
      const thumb = createReportImage(imageUrl, `${danger.title}の写真`, {
        width: '76px',
        height: '54px',
        radius: '6px',
        compact: true,
      })
      thumb.style.width = '76px'
      thumb.style.height = '54px'
      thumb.style.objectFit = 'cover'
      thumb.style.borderRadius = '6px'
      thumb.style.backgroundColor = '#e5e7eb'
      row.appendChild(thumb)
    }

    calloutSection.appendChild(row)
  })

  if (dangers.length > MAP_CALLOUT_LIMIT) {
    const more = createText({
      text: `※ 危険箇所が多いため、地図注釈は上位${MAP_CALLOUT_LIMIT}件を表示しています。`,
      fontSize: '11px',
      color: C.inkSoft,
      margin: '2px 0 0 0',
    })
    calloutSection.appendChild(more)
  }

  parent.appendChild(calloutSection)
}

/* ------------------------------------------------------------------ *
 * 3. 危険箇所カード — 「学びのページ」(1箇所=1セクション)
 * ------------------------------------------------------------------ */

export function buildDangerCardSection(
  danger: DangerReport,
  markerLabel: string,
  selectedImageUrls?: Record<string, string>,
  signedImageUrls?: Record<string, string>
): HTMLDivElement {
  const root = createSectionRoot('tanken')
  root.dataset.reportSection = 'danger-card'
  root.dataset.dangerId = danger.id

  const presentation = getDangerLevelPresentation(danger.danger_level)
  const cue = createKidsHazardCue(danger)
  const learning = createARLearningContent(danger)

  const card = document.createElement('div')
  card.style.border = `2px solid ${C.borderFaint}`
  card.style.borderRadius = `${reportTheme.radius.card}px`
  card.style.padding = '14px 16px 16px 16px'

  card.appendChild(
    createHeadingBand({
      text: `ちゅういポイント ${markerLabel}`,
      accentColor: presentation.colorHex,
      rightText: `${presentation.stars} ${presentation.kidLabel}`,
      rightTextColor: presentation.colorHex,
    })
  )

  // 報告の基本情報(タイトル・場所・タイプ)
  const reportTitle = createText({
    text: danger.title,
    fontSize: '15px',
    bold: true,
    margin: '0 0 2px 0',
  })
  card.appendChild(reportTitle)

  const location = formatLocation(danger)
  const metaParts = [location ? `場所: ${location}` : null, `タイプ: ${danger.danger_type}`]
    .filter(Boolean)
    .join(' / ')
  card.appendChild(
    createText({ text: metaParts, fontSize: '11px', color: C.inkSoft, margin: '0 0 10px 0' })
  )

  // 写真(テープで貼ったポラロイド風)
  const imageUrl = resolveDangerDisplayImageUrl(danger, selectedImageUrls, signedImageUrls)
  if (imageUrl) {
    const frame = document.createElement('div')
    frame.style.position = 'relative'
    frame.style.margin = '14px 4px 12px 4px'
    frame.style.padding = '8px 8px 10px 8px'
    frame.style.backgroundColor = '#ffffff'
    frame.style.border = `1px solid ${C.borderFaint}`
    frame.style.borderRadius = '12px'

    frame.appendChild(createTapeDecoration('left'))
    frame.appendChild(createTapeDecoration('right'))

    const img = createReportImage(imageUrl, `${danger.title}の写真`, {
      width: '100%',
      height: '180px',
      radius: '8px',
    })
    img.style.width = '100%'
    img.style.maxHeight = '240px'
    img.style.objectFit = 'contain'
    img.style.borderRadius = '8px'
    img.style.backgroundColor = '#f3f4f6'
    frame.appendChild(img)

    card.appendChild(frame)
  }

  // ⚠ なにが あぶない?
  card.appendChild(
    createText({
      text: '⚠ なにが あぶない?',
      fontSize: '13px',
      color: C.accentStrong,
      bold: true,
      margin: '10px 0 2px 0',
    })
  )
  card.appendChild(
    createText({ text: cue.shortMessage, fontSize: '16px', bold: true, margin: '0 0 6px 0' })
  )
  if (danger.description) {
    card.appendChild(
      createText({
        text: `ほうこくメモ: ${danger.description}`,
        fontSize: '11px',
        color: C.inkSoft,
        margin: '0 0 6px 0',
      })
    )
  }

  // ✅ こうすると あんぜん!(行動指示は囲みで強調)
  const actionBox = document.createElement('div')
  actionBox.style.border = `2.5px solid ${C.primary}`
  actionBox.style.borderRadius = `${reportTheme.radius.panel}px`
  actionBox.style.padding = '8px 12px'
  actionBox.style.margin = '8px 0 10px 0'
  actionBox.appendChild(
    createText({
      text: '✅ こうすると あんぜん!',
      fontSize: '13px',
      color: C.primaryStrong,
      bold: true,
      margin: '0 0 2px 0',
    })
  )
  actionBox.appendChild(
    createText({
      text: cue.action,
      fontSize: '16px',
      color: C.primaryStrong,
      bold: true,
      margin: '0',
    })
  )
  card.appendChild(actionBox)

  // 👨‍👩‍👧 おうちのかたへ(保護者向け解説+現地確認チェック)
  const parentBlock = document.createElement('div')
  parentBlock.style.borderTop = `2px solid ${C.borderFaint}`
  parentBlock.style.paddingTop = '8px'
  parentBlock.appendChild(
    createText({
      text: '👨‍👩‍👧 おうちのかたへ',
      fontSize: '12px',
      color: C.inkSoft,
      bold: true,
      margin: '0 0 2px 0',
    })
  )
  parentBlock.appendChild(
    createText({ text: learning.summary, fontSize: '12px', color: C.inkSoft, margin: '0 0 6px 0' })
  )

  for (const checkpoint of learning.checkpoints) {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '8px'
    row.style.margin = '4px 0'
    row.appendChild(createCheckboxSquare())
    const label = document.createElement('span')
    label.textContent = checkpoint
    label.style.fontSize = '12px'
    label.style.color = C.ink
    row.appendChild(label)
    parentBlock.appendChild(row)
  }
  card.appendChild(parentBlock)

  root.appendChild(card)
  return root
}

/* ------------------------------------------------------------------ *
 * 4. 親子たんけんチェックリスト
 * ------------------------------------------------------------------ */

export function buildChecklistSection(dangers: DangerReport[]): HTMLDivElement {
  const root = createSectionRoot('tanken')
  root.dataset.reportSection = 'checklist'
  const markerLabels = assignDangerMarkerLabels(dangers)

  root.appendChild(
    createHeadingBand({
      text: 'おやこで たんけんに いこう!',
      accentColor: C.sun,
    })
  )

  root.appendChild(
    createText({
      text: 'この ノートを もって、じっさいに あるいて かくにんしてみよう。できたら □ に ✔ を かこう!',
      fontSize: '13px',
      bold: true,
      margin: '0 0 10px 0',
    })
  )

  const list = document.createElement('div')
  list.style.display = 'flex'
  list.style.flexDirection = 'column'
  list.style.gap = '8px'

  dangers.forEach((danger) => {
    const cue = createKidsHazardCue(danger)

    const row = document.createElement('div')
    row.dataset.checklistItem = danger.id
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '10px'
    row.style.padding = '8px 10px'
    row.style.border = `1.5px solid ${C.borderFaint}`
    row.style.borderRadius = `${reportTheme.radius.panel}px`

    row.appendChild(createCheckboxSquare())

    const label = document.createElement('span')
    label.textContent = `${markerLabels.get(danger.id) ?? ''} ${danger.title} — ${cue.action}`
    label.style.fontSize = '13px'
    label.style.fontWeight = 'bold'
    label.style.color = C.ink
    row.appendChild(label)

    list.appendChild(row)
  })
  root.appendChild(list)

  const rewardRow = document.createElement('div')
  rewardRow.style.marginTop = '12px'
  rewardRow.style.textAlign = 'center'
  const reward = createStickerChip({
    text: 'ぜんぶ できたら… 🏅 つうがくろマスター!',
    color: C.sunDeep,
    softColor: C.sunSoft,
    tiltDeg: -1.5,
  })
  reward.style.fontSize = '15px'
  reward.style.padding = '6px 18px'
  rewardRow.appendChild(reward)
  root.appendChild(rewardRow)

  return root
}

/* ------------------------------------------------------------------ *
 * 5. 保護者向けガイド(静的)
 * ------------------------------------------------------------------ */

const PARENT_GUIDE_ITEMS = [
  '子どもと一緒に地図を見て、「いつも通る道はどれ?」から始めてください。',
  '各カードの「こうすると あんぜん!」を子ども自身に音読してもらうと定着しやすくなります。',
  '声かけは「〜しちゃダメ」より「〜しようね」が効果的です。例: ×「飛び出しちゃダメ」 → ○「ここでは いったん止まろうね」',
  '可能なら週末に一度、このノートを持って親子で実際に歩き、チェックリストに✔を付けてみてください。',
]

export function buildParentGuideSection(): HTMLDivElement {
  const root = createSectionRoot('tanken')
  root.dataset.reportSection = 'parent-guide'

  root.appendChild(
    createHeadingBand({
      text: 'おうちのかたへ — このノートの使い方',
      accentColor: C.primary,
    })
  )

  PARENT_GUIDE_ITEMS.forEach((item, index) => {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '10px'
    row.style.margin = '8px 0'

    const num = document.createElement('span')
    num.textContent = `${index + 1}`
    num.style.width = '22px'
    num.style.height = '22px'
    num.style.flexShrink = '0'
    num.style.borderRadius = '9999px'
    num.style.display = 'flex'
    num.style.alignItems = 'center'
    num.style.justifyContent = 'center'
    num.style.fontSize = '13px'
    num.style.fontWeight = 'bold'
    num.style.color = '#ffffff'
    num.style.backgroundColor = C.primary
    row.appendChild(num)

    const text = document.createElement('span')
    text.textContent = item
    text.style.fontSize = '13px'
    text.style.color = C.ink
    row.appendChild(text)

    root.appendChild(row)
  })

  return root
}

/* ------------------------------------------------------------------ *
 * 6. 学校・地域共有用サマリー(事務調・写真/詳細説明なし)
 * ------------------------------------------------------------------ */

export function buildSchoolSummarySection(
  report: RouteDangerReport,
  mapboxToken: string
): HTMLDivElement {
  const root = createSectionRoot('office')
  root.dataset.reportSection = 'school-summary'

  const title = document.createElement('h1')
  title.textContent = `通学路危険箇所サマリー: ${report.route.name}`
  title.style.fontSize = '20px'
  title.style.margin = '0 0 6px 0'
  title.style.color = '#1f2937'
  root.appendChild(title)

  const metaLines = [
    `作成日時: ${formatDate(report.generatedAt)}`,
    `ルート距離: ${formatDistance(report.route.distance_meters)} / 検索範囲: ルート周辺${report.bufferMeters}m`,
    `検出された危険箇所: ${report.summary.totalDangers}件`,
  ]
  for (const line of metaLines) {
    const p = createText({ text: line, fontSize: '12px', color: '#6b7280', margin: '2px 0' })
    root.appendChild(p)
  }

  // 地図(Mapbox静的画像のみ。報告写真は載せない)
  if (report.route.route_geometry) {
    const mapUrl = generateOverviewMapUrl(
      report.route.route_geometry,
      report.dangers,
      mapboxToken,
      { width: 750, height: 400 }
    )
    const mapImg = createReportImage(mapUrl, '通学路と危険箇所の地図', {
      width: '100%',
      height: '260px',
      radius: '8px',
      label: '地図を読み込めませんでした',
    })
    mapImg.style.width = '100%'
    mapImg.style.borderRadius = '8px'
    mapImg.style.border = '1px solid #e5e7eb'
    mapImg.style.margin = '10px 0'
    root.appendChild(mapImg)
  }

  // 箇所一覧(タイトル・場所・レベルのみ)
  if (report.dangers.length > 0) {
    const markerLabels = assignDangerMarkerLabels(report.dangers)
    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '12px'
    table.style.margin = '8px 0 12px 0'

    const headerRow = document.createElement('tr')
    for (const headerText of ['番号', 'タイトル', '場所', 'タイプ', '危険レベル']) {
      const th = document.createElement('th')
      th.textContent = headerText
      th.style.border = '1px solid #d1d5db'
      th.style.padding = '4px 8px'
      th.style.backgroundColor = '#f9fafb'
      th.style.textAlign = 'left'
      headerRow.appendChild(th)
    }
    table.appendChild(headerRow)

    report.dangers.forEach((danger) => {
      const presentation = getDangerLevelPresentation(danger.danger_level)
      const tr = document.createElement('tr')
      const cells = [
        markerLabels.get(danger.id) ?? '',
        danger.title,
        formatLocation(danger) || '-',
        danger.danger_type,
        `${presentation.stars} (レベル${presentation.level})`,
      ]
      for (const cellText of cells) {
        const td = document.createElement('td')
        td.textContent = cellText
        td.style.border = '1px solid #d1d5db'
        td.style.padding = '4px 8px'
        tr.appendChild(td)
      }
      table.appendChild(tr)
    })
    root.appendChild(table)

    // タイプ別集計
    const byTypeTitle = createText({
      text: '危険タイプ別件数',
      fontSize: '13px',
      color: '#374151',
      bold: true,
      margin: '8px 0 4px 0',
    })
    root.appendChild(byTypeTitle)
    for (const [type, count] of Object.entries(report.summary.byType)) {
      root.appendChild(
        createText({
          text: `${type}: ${count}件`,
          fontSize: '12px',
          color: '#374151',
          margin: '2px 0 2px 12px',
        })
      )
    }
  }

  const note = createText({
    text: '※ 本ページは学校・地域共有用に、報告写真と詳細説明を除いたサマリーです。個別の詳細は保護者向けページをご参照ください。',
    fontSize: '11px',
    color: '#6b7280',
    margin: '12px 0 0 0',
  })
  root.appendChild(note)

  return root
}

/* ------------------------------------------------------------------ *
 * 合成 — レポート全体のセクション列
 * ------------------------------------------------------------------ */

export function buildReportSections(
  report: RouteDangerReport,
  mapboxToken: string
): HTMLDivElement[] {
  const sections: (HTMLDivElement | null)[] = [
    buildCoverSection(report),
    buildMapSection(report, mapboxToken),
  ]

  if (report.dangers.length > 0) {
    const markerLabels = assignDangerMarkerLabels(report.dangers)
    for (const danger of report.dangers) {
      sections.push(
        buildDangerCardSection(
          danger,
          markerLabels.get(danger.id) ?? '',
          report.selectedImageUrls,
          report.signedImageUrls
        )
      )
    }
    sections.push(buildChecklistSection(report.dangers))
  } else {
    const empty = createSectionRoot('tanken')
    empty.dataset.reportSection = 'empty'
    empty.appendChild(
      createText({
        text: 'このルート付近に危険箇所は報告されていません。',
        fontSize: '14px',
        color: C.inkSoft,
      })
    )
    sections.push(empty)
  }

  sections.push(buildParentGuideSection())

  if (report.includeSchoolSummary) {
    sections.push(buildSchoolSummarySection(report, mapboxToken))
  }

  return sections.filter((section): section is HTMLDivElement => section !== null)
}
