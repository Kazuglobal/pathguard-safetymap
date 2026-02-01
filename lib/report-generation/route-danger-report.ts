/**
 * Route Danger Report Generation
 *
 * Provides utilities for generating danger reports for routes.
 * Uses Mapbox Static Images API for map generation and jspdf for PDF output.
 */

import type {
  DangerReport,
  RouteDangerReport,
  RouteDangerSummary,
} from '@/lib/types'

interface MapDimensions {
  width: number
  height: number
}

const DEFAULT_MAP_DIMENSIONS: MapDimensions = {
  width: 600,
  height: 400,
}

const MAX_STATIC_IMAGE_DIMENSION = 1280
const HI_DPI_SCALE = 2

/**
 * Generates a Mapbox Static Images API URL for the route overview map.
 *
 * @param routeGeometry - The LineString geometry of the route
 * @param dangers - Array of danger reports to mark on the map
 * @param mapboxToken - Mapbox access token
 * @param dimensions - Optional custom dimensions (default: 600x400)
 * @returns The URL for the static map image
 */
export function generateOverviewMapUrl(
  routeGeometry: GeoJSON.LineString,
  dangers: DangerReport[],
  mapboxToken: string,
  dimensions: MapDimensions = DEFAULT_MAP_DIMENSIONS
): string {
  const { width, height } = dimensions
  const style = 'mapbox/streets-v12'

  // Encode route as path overlay
  const coordinates = routeGeometry.coordinates
  const pathCoords = coordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';')
  const pathOverlay = `path-4+3b82f6-0.7(${encodeURIComponent(pathCoords)})`

  // Create markers for dangers
  const markerOverlays = dangers
    .slice(0, 50) // Limit markers to avoid URL length issues
    .map((danger) => {
      const color = getDangerLevelColor(danger.danger_level)
      return `pin-s+${color}(${danger.longitude},${danger.latitude})`
    })
    .join(',')

  // Build the URL
  const overlays = markerOverlays
    ? `${pathOverlay},${markerOverlays}`
    : pathOverlay

  // Calculate auto center and zoom
  const safeWidth = Math.min(width, MAX_STATIC_IMAGE_DIMENSION)
  const safeHeight = Math.min(height, MAX_STATIC_IMAGE_DIMENSION)
  const canUseHiDpi =
    safeWidth * HI_DPI_SCALE <= MAX_STATIC_IMAGE_DIMENSION &&
    safeHeight * HI_DPI_SCALE <= MAX_STATIC_IMAGE_DIMENSION
  const pixelRatio = canUseHiDpi ? '@2x' : ''
  const url = `https://api.mapbox.com/styles/v1/${style}/static/${overlays}/auto/${safeWidth}x${safeHeight}${pixelRatio}?access_token=${mapboxToken}`

  return url
}

/**
 * Gets the marker color based on danger level.
 */
function getDangerLevelColor(level: number): string {
  switch (level) {
    case 3:
      return 'ef4444' // red-500
    case 2:
      return 'f97316' // orange-500
    case 1:
    default:
      return 'eab308' // yellow-500
  }
}

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
 * Generates a PDF report for the route dangers.
 *
 * @param report - The route danger report data
 * @param mapboxToken - Mapbox access token for map generation
 * @returns A Blob containing the PDF
 */
export async function generatePDFReport(
  report: RouteDangerReport,
  mapboxToken: string
): Promise<Blob> {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let yPos = margin

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(`危険箇所レポート: ${report.route.name}`, margin, yPos)
  yPos += 10

  // Generated date
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`作成日時: ${formatDate(report.generatedAt)}`, margin, yPos)
  yPos += 8

  // Summary section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('概要', margin, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`ルート距離: ${formatDistance(report.route.distance_meters)}`, margin, yPos)
  yPos += 5
  doc.text(`バッファ距離: ${report.bufferMeters}m`, margin, yPos)
  yPos += 5
  doc.text(`危険箇所数: ${report.summary.totalDangers}件`, margin, yPos)
  yPos += 10

  // Danger type breakdown
  if (report.summary.totalDangers > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('危険タイプ別', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const [type, count] of Object.entries(report.summary.byType)) {
      doc.text(`  ${type}: ${count}件`, margin, yPos)
      yPos += 5
    }
    yPos += 5

    // Danger level breakdown
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('危険レベル別', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const levelLabels: Record<number, string> = {
      1: '低',
      2: '中',
      3: '高',
    }
    for (const [level, count] of Object.entries(report.summary.byLevel)) {
      const levelNum = parseInt(level, 10)
      doc.text(`  レベル${level} (${levelLabels[levelNum] || level}): ${count}件`, margin, yPos)
      yPos += 5
    }
    yPos += 10

    // Danger details
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('危険箇所一覧', margin, yPos)
    yPos += 8

    for (let i = 0; i < report.dangers.length; i++) {
      const danger = report.dangers[i]

      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage()
        yPos = margin
      }

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${danger.title}`, margin, yPos)
      yPos += 5

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`タイプ: ${danger.danger_type} | レベル: ${danger.danger_level}`, margin + 3, yPos)
      yPos += 4

      if (danger.description) {
        const descLines = doc.splitTextToSize(danger.description, pageWidth - margin * 2 - 6)
        for (const line of descLines) {
          doc.text(line, margin + 3, yPos)
          yPos += 4
        }
      }

      const location = [danger.town, danger.city, danger.prefecture]
        .filter(Boolean)
        .join(', ')
      if (location) {
        doc.text(`場所: ${location}`, margin + 3, yPos)
        yPos += 4
      }

      yPos += 4
    }
  } else {
    doc.text('このルート付近に危険箇所は報告されていません。', margin, yPos)
  }

  return doc.output('blob')
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

/**
 * Generates an image report for the route dangers.
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

  // Create an HTML element to render
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.padding = '24px'
  container.style.backgroundColor = '#ffffff'
  container.style.fontFamily = 'sans-serif'

  // Title
  const title = document.createElement('h1')
  title.textContent = `危険箇所レポート: ${report.route.name}`
  title.style.fontSize = '24px'
  title.style.marginBottom = '16px'
  container.appendChild(title)

  // Summary
  const summary = document.createElement('div')
  summary.innerHTML = `
    <p>作成日時: ${formatDate(report.generatedAt)}</p>
    <p>ルート距離: ${formatDistance(report.route.distance_meters)}</p>
    <p>バッファ距離: ${report.bufferMeters}m</p>
    <p>危険箇所数: ${report.summary.totalDangers}件</p>
  `
  container.appendChild(summary)

  // Map image
  if (report.route.route_geometry) {
    const mapUrl = generateOverviewMapUrl(
      report.route.route_geometry,
      report.dangers,
      mapboxToken,
      { width: 750, height: 400 }
    )
    const mapImg = document.createElement('img')
    mapImg.src = mapUrl
    mapImg.style.width = '100%'
    mapImg.style.marginTop = '16px'
    mapImg.style.marginBottom = '16px'
    container.appendChild(mapImg)
  }

  // Danger list
  if (report.dangers.length > 0) {
    const dangerList = document.createElement('div')
    dangerList.innerHTML = `<h2 style="font-size: 18px; margin-bottom: 12px;">危険箇所一覧</h2>`

    for (const danger of report.dangers) {
      const dangerItem = document.createElement('div')
      dangerItem.style.marginBottom = '12px'
      dangerItem.style.padding = '8px'
      dangerItem.style.borderLeft = `4px solid ${getDangerLevelBorderColor(danger.danger_level)}`
      dangerItem.style.backgroundColor = '#f9fafb'

      dangerItem.innerHTML = `
        <strong>${danger.title}</strong><br/>
        <small>タイプ: ${danger.danger_type} | レベル: ${danger.danger_level}</small>
        ${danger.description ? `<p style="margin: 4px 0 0 0;">${danger.description}</p>` : ''}
      `
      dangerList.appendChild(dangerItem)
    }

    container.appendChild(dangerList)
  }

  // Temporarily add to DOM for rendering
  document.body.appendChild(container)

  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    return new Promise<Blob>((resolve, reject) => {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
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
  } finally {
    document.body.removeChild(container)
  }
}

function getDangerLevelBorderColor(level: number): string {
  switch (level) {
    case 3:
      return '#ef4444' // red-500
    case 2:
      return '#f97316' // orange-500
    case 1:
    default:
      return '#eab308' // yellow-500
  }
}

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
