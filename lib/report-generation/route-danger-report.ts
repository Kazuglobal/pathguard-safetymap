/**
 * Route Danger Report Generation
 *
 * 危険箇所レポートの出力オーケストレーション。
 *  - PDF: セクション(表紙/地図/カード/チェックリスト/ガイド/学校サマリー)を
 *    個別に html2canvas でレンダリングし、ページに割り付ける。
 *    カードがページ境界で分断されない(1セクションがページ超過の場合のみ
 *    従来のスライス方式でフォールバック分割)。
 *  - PNG/JPEG: 全セクションを縦に連結した1枚画像として出力。
 *
 * セクションの中身は report-sections.ts、地図URLは report-map.ts、
 * 写真選択は report-images.ts を参照。公開APIの互換のため、それらの
 * 主要関数はこのモジュールから re-export している。
 */

import type { DangerReport, RouteDangerReport, RouteDangerSummary } from '@/lib/types'
import { buildReportSections } from './report-sections'
import { reportTheme } from './report-theme'

export { generateOverviewMapUrl } from './report-map'
export type { MapDimensions } from './report-map'
export { getDangerImageOptions, resolveDangerDisplayImageUrl } from './report-images'
export type { DangerImageOption } from './report-images'

const HTML2CANVAS_SCALE = 2
const IMAGE_TIMEOUT_MS = 15000
const PDF_MARGIN_MM = 10

/**
 * Creates a summary of danger reports.
 *
 * @param dangers - Array of danger reports
 * @returns Summary object with counts by type and level
 */
export function createReportSummary(dangers: DangerReport[]): RouteDangerSummary {
  if (!dangers || dangers.length === 0) {
    return {
      totalDangers: 0,
      byType: {},
      byLevel: {},
    }
  }

  const byType: Record<string, number> = {}
  const byLevel: Record<number, number> = {}

  for (const danger of dangers) {
    // Count by type
    byType[danger.danger_type] = (byType[danger.danger_type] || 0) + 1

    // Count by level
    byLevel[danger.danger_level] = (byLevel[danger.danger_level] || 0) + 1
  }

  return {
    totalDangers: dangers.length,
    byType,
    byLevel,
  }
}

/**
 * セクションの高さ(mm)の列を、A4等のページ有効高さに先頭から詰めて
 * 割り付ける。ページ有効高さを超えるセクションは単独ページになる
 * (呼び出し側でスライス分割される)。
 *
 * @param heightsMm - 各セクションの描画高さ(mm)
 * @param pageHeightMm - ページの有効高さ(mm、余白を除く)
 * @returns ページごとのセクションindex配列
 */
export function packSectionsIntoPages(
  heightsMm: number[],
  pageHeightMm: number
): number[][] {
  const pages: number[][] = []
  let currentPage: number[] = []
  let usedHeight = 0

  heightsMm.forEach((height, index) => {
    if (currentPage.length > 0 && usedHeight + height > pageHeightMm) {
      pages.push(currentPage)
      currentPage = []
      usedHeight = 0
    }
    currentPage.push(index)
    usedHeight += height
  })

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages
}

/**
 * Generates a PDF report for the route dangers.
 * セクション単位でページに割り付ける(日本語はhtml2canvas経由の画像として埋め込み)。
 *
 * @param report - The route danger report data
 * @param mapboxToken - Mapbox access token for map generation
 * @returns A Blob containing the PDF
 */
export async function generatePDFReport(
  report: RouteDangerReport,
  mapboxToken: string
): Promise<Blob> {
  // For server-side, test environments (jsdom), return placeholder
  if (!isRealBrowserEnvironment()) {
    return new Blob(['placeholder'], { type: 'application/pdf' })
  }

  // Dynamic imports to avoid SSR issues
  const { jsPDF } = await import('jspdf')

  const sections = buildReportSections(report, mapboxToken)
  const canvases = await renderSectionsToCanvases(sections)

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2
  const contentHeight = pageHeight - PDF_MARGIN_MM * 2

  const heightsMm = canvases.map((canvas) =>
    canvas.width > 0 ? (canvas.height * contentWidth) / canvas.width : 0
  )
  const pages = packSectionsIntoPages(heightsMm, contentHeight)

  let isFirstPage = true
  for (const sectionIndexes of pages) {
    if (!isFirstPage) {
      pdf.addPage()
    }
    isFirstPage = false

    let y = PDF_MARGIN_MM
    for (const sectionIndex of sectionIndexes) {
      const canvas = canvases[sectionIndex]
      const heightMm = heightsMm[sectionIndex]
      if (heightMm <= 0) {
        continue
      }

      if (heightMm > contentHeight) {
        // ページ有効高さを超える巨大セクション(長いコールアウト付き地図など)
        // のみ、従来どおり複数ページへスライスして流し込む。
        addOversizedCanvas(pdf, canvas, {
          contentWidth,
          contentHeight,
          marginMm: PDF_MARGIN_MM,
          heightMm,
        })
      } else {
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          PDF_MARGIN_MM,
          y,
          contentWidth,
          heightMm
        )
        y += heightMm
      }
    }
  }

  return pdf.output('blob')
}

interface OversizedCanvasLayout {
  contentWidth: number
  contentHeight: number
  marginMm: number
  heightMm: number
}

/**
 * ページ有効高さを超えるセクションを、負オフセット方式で複数ページへ分割する。
 * (旧レポート全体スライスと同じ手法を単一セクションに限定して適用)
 */
function addOversizedCanvas(
  pdf: import('jspdf').jsPDF,
  canvas: HTMLCanvasElement,
  layout: OversizedCanvasLayout
): void {
  const { contentWidth, contentHeight, marginMm, heightMm } = layout
  const imgData = canvas.toDataURL('image/png')

  let heightLeft = heightMm
  let position = marginMm

  pdf.addImage(imgData, 'PNG', marginMm, position, contentWidth, heightMm)
  heightLeft -= contentHeight

  while (heightLeft > 0) {
    position = heightLeft - heightMm + marginMm
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', marginMm, position, contentWidth, heightMm)
    heightLeft -= contentHeight
  }
}

/**
 * Generates an image report for the route dangers.
 * 全セクションを縦に連結した1枚画像として出力する。
 *
 * @param report - The route danger report data
 * @param mapboxToken - Mapbox access token for map generation
 * @param format - Image format: 'png' or 'jpeg'
 * @returns A Blob containing the image
 */
export async function generateImageReport(
  report: RouteDangerReport,
  mapboxToken: string,
  format: 'png' | 'jpeg' = 'png'
): Promise<Blob> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'

  // For server-side, test environments (jsdom), return placeholder
  if (!isRealBrowserEnvironment()) {
    return new Blob(['placeholder'], { type: mimeType })
  }

  const sections = buildReportSections(report, mapboxToken)
  const canvas = await renderSectionsToSingleCanvas(sections)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to generate image blob'))
        }
      },
      mimeType,
      0.95
    )
  })
}

/* ------------------------------------------------------------------ *
 * レンダリング下回り
 * ------------------------------------------------------------------ */

/**
 * レンダリング用の画面外ラッパーを作る。
 * display:none だと html2canvas が描画できないため、画面外配置にする。
 */
function createOffscreenWrapper(): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'absolute'
  wrapper.style.left = '-10000px'
  wrapper.style.top = '0'
  wrapper.style.width = `${reportTheme.containerWidthPx}px`
  wrapper.style.backgroundColor = '#ffffff'
  return wrapper
}

/** Webフォント(Zen Maru Gothic)のロード完了を待つ。未対応環境では即解決。 */
async function waitForFonts(): Promise<void> {
  try {
    await document.fonts?.ready
  } catch {
    // フォントAPI未対応・ロード失敗時はフォールバックフォントで続行
  }
}

/**
 * 全セクションをDOMに載せて画像・フォントのロードを待ち、
 * セクションごとに html2canvas でレンダリングする。
 */
async function renderSectionsToCanvases(
  sections: HTMLDivElement[]
): Promise<HTMLCanvasElement[]> {
  const html2canvas = (await import('html2canvas')).default
  const wrapper = createOffscreenWrapper()
  for (const section of sections) {
    wrapper.appendChild(section)
  }
  document.body.appendChild(wrapper)

  try {
    await waitForFonts()
    await waitForImages(wrapper)

    const canvases: HTMLCanvasElement[] = []
    for (const section of sections) {
      canvases.push(
        await html2canvas(section, {
          scale: HTML2CANVAS_SCALE,
          useCORS: true,
          logging: false,
          imageTimeout: IMAGE_TIMEOUT_MS,
          backgroundColor: '#ffffff',
        })
      )
    }
    return canvases
  } finally {
    document.body.removeChild(wrapper)
  }
}

/**
 * 全セクションを縦連結した1つのコンテナとしてレンダリングする(PNG/JPEG用)。
 */
async function renderSectionsToSingleCanvas(
  sections: HTMLDivElement[]
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default
  const wrapper = createOffscreenWrapper()
  const container = document.createElement('div')
  container.style.width = `${reportTheme.containerWidthPx}px`
  container.style.backgroundColor = '#ffffff'
  for (const section of sections) {
    container.appendChild(section)
  }
  wrapper.appendChild(container)
  document.body.appendChild(wrapper)

  try {
    await waitForFonts()
    await waitForImages(wrapper)

    return await html2canvas(container, {
      scale: HTML2CANVAS_SCALE,
      useCORS: true,
      logging: false,
      imageTimeout: IMAGE_TIMEOUT_MS,
      backgroundColor: '#ffffff',
    })
  } finally {
    document.body.removeChild(wrapper)
  }
}

/**
 * Waits for all images in the container to finish loading.
 * This ensures html2canvas captures images correctly.
 *
 * @param container - The HTML element containing images
 * @param timeoutMs - Maximum time to wait per image (default: 15000ms)
 */
async function waitForImages(
  container: HTMLElement,
  timeoutMs = IMAGE_TIMEOUT_MS
): Promise<void> {
  const images = container.querySelectorAll('img')
  const promises = Array.from(images).map((img) => {
    // Check both complete AND naturalHeight to ensure image data is available
    // (crossOrigin attribute may cause re-fetch even if complete is true)
    if (img.complete && img.naturalHeight > 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), timeoutMs)
      img.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      img.onerror = () => {
        clearTimeout(timeout)
        resolve() // Continue even on error
      }
    })
  })
  await Promise.all(promises)
}

/**
 * Checks if we're in a real browser environment (not jsdom/test environment)
 */
function isRealBrowserEnvironment(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  // Check for jsdom (test environment)
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent &&
    navigator.userAgent.includes('jsdom')
  ) {
    return false
  }

  // Check for test environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false
  }

  // Check if html2canvas would work
  if (typeof HTMLCanvasElement === 'undefined') {
    return false
  }

  return true
}
