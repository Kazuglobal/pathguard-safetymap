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
const HTML2CANVAS_SCALE = 2
const IMAGE_TIMEOUT_MS = 15000

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

  // Encode route as coordinate path for Mapbox Static Images API
  // GeoJSON uses [lng, lat] which matches Mapbox static path format.
  const coordinates = routeGeometry.coordinates
  const coordinatePath = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const pathOverlay = `path-4+3b82f6-0.7(${encodeURIComponent(coordinatePath)})`

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
 * Uses html2canvas + jsPDF approach for proper Japanese font support.
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
  const canvas = await renderReportToCanvas(report, mapboxToken)

  // Create PDF from canvas
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10

  // Calculate image dimensions to fit on page
  const imgWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // Add pages as needed for long content
  let heightLeft = imgHeight
  let position = margin

  // First page
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
  heightLeft -= pageHeight - margin * 2

  // Add more pages if needed
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2
  }

  return pdf.output('blob')
}

/**
 * Creates an HTML container element for the report.
 * This is shared between PDF and image generation for consistency.
 */
function createReportHtmlContainer(
  report: RouteDangerReport,
  mapboxToken: string
): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.padding = '24px'
  container.style.backgroundColor = '#ffffff'
  container.style.fontFamily = 'sans-serif'

  // Title
  const title = document.createElement('h1')
  title.textContent = `危険箇所レポート: ${report.route.name}`
  title.style.fontSize = '24px'
  title.style.marginBottom = '8px'
  title.style.color = '#1f2937'
  container.appendChild(title)

  // Generated date
  const dateEl = document.createElement('p')
  dateEl.textContent = `作成日時: ${formatDate(report.generatedAt)}`
  dateEl.style.fontSize = '12px'
  dateEl.style.color = '#6b7280'
  dateEl.style.marginBottom = '16px'
  container.appendChild(dateEl)

  // Summary section
  const summarySection = document.createElement('div')
  summarySection.style.marginBottom = '20px'
  summarySection.style.padding = '16px'
  summarySection.style.backgroundColor = '#f9fafb'
  summarySection.style.borderRadius = '8px'

  const summaryTitle = document.createElement('h2')
  summaryTitle.textContent = '概要'
  summaryTitle.style.fontSize = '18px'
  summaryTitle.style.marginBottom = '12px'
  summaryTitle.style.color = '#1f2937'
  summarySection.appendChild(summaryTitle)

  const summaryContent = document.createElement('div')
  summaryContent.appendChild(
    createSummaryRow(`ルート距離: ${formatDistance(report.route.distance_meters)}`)
  )
  summaryContent.appendChild(createSummaryRow(`バッファ距離: ${report.bufferMeters}m`))
  summaryContent.appendChild(
    createSummaryRow(`危険箇所数: ${report.summary.totalDangers}件`, true)
  )
  summarySection.appendChild(summaryContent)
  container.appendChild(summarySection)

  // Map image (if route geometry exists)
  if (report.route.route_geometry) {
    const mapUrl = generateOverviewMapUrl(
      report.route.route_geometry,
      report.dangers,
      mapboxToken,
      { width: 750, height: 400 }
    )
    const mapImg = document.createElement('img')
    mapImg.crossOrigin = 'anonymous' // Enable CORS for html2canvas
    mapImg.src = mapUrl
    mapImg.style.width = '100%'
    mapImg.style.borderRadius = '8px'
    mapImg.style.marginBottom = '20px'
    container.appendChild(mapImg)
  }

  // Danger breakdown (if there are dangers)
  if (report.summary.totalDangers > 0) {
    // By type
    const byTypeSection = document.createElement('div')
    byTypeSection.style.marginBottom = '16px'

    const byTypeTitle = document.createElement('h3')
    byTypeTitle.textContent = '危険タイプ別'
    byTypeTitle.style.fontSize = '14px'
    byTypeTitle.style.marginBottom = '8px'
    byTypeTitle.style.color = '#374151'
    byTypeSection.appendChild(byTypeTitle)

    for (const [type, count] of Object.entries(report.summary.byType)) {
      const item = document.createElement('p')
      item.textContent = `${type}: ${count}件`
      item.style.margin = '2px 0'
      item.style.paddingLeft = '12px'
      item.style.fontSize = '13px'
      byTypeSection.appendChild(item)
    }
    container.appendChild(byTypeSection)

    // By level
    const byLevelSection = document.createElement('div')
    byLevelSection.style.marginBottom = '20px'

    const byLevelTitle = document.createElement('h3')
    byLevelTitle.textContent = '危険レベル別'
    byLevelTitle.style.fontSize = '14px'
    byLevelTitle.style.marginBottom = '8px'
    byLevelTitle.style.color = '#374151'
    byLevelSection.appendChild(byLevelTitle)

    const levelLabels: Record<number, string> = {
      1: '低',
      2: '中',
      3: '高',
    }
    for (const [level, count] of Object.entries(report.summary.byLevel)) {
      const levelNum = parseInt(level, 10)
      const item = document.createElement('p')
      item.textContent = `レベル${level} (${levelLabels[levelNum] || level}): ${count}件`
      item.style.margin = '2px 0'
      item.style.paddingLeft = '12px'
      item.style.fontSize = '13px'
      byLevelSection.appendChild(item)
    }
    container.appendChild(byLevelSection)

    // Danger list
    const dangerListSection = document.createElement('div')

    const dangerListTitle = document.createElement('h2')
    dangerListTitle.textContent = '危険箇所一覧'
    dangerListTitle.style.fontSize = '18px'
    dangerListTitle.style.marginBottom = '12px'
    dangerListTitle.style.color = '#1f2937'
    dangerListSection.appendChild(dangerListTitle)

    for (const danger of report.dangers) {
      const dangerItem = document.createElement('div')
      dangerItem.style.marginBottom = '16px'
      dangerItem.style.padding = '12px'
      dangerItem.style.borderLeft = `4px solid ${getDangerLevelBorderColor(danger.danger_level)}`
      dangerItem.style.backgroundColor = '#f9fafb'
      dangerItem.style.borderRadius = '0 8px 8px 0'

      const dangerTitle = document.createElement('div')
      dangerTitle.style.fontWeight = 'bold'
      dangerTitle.style.marginBottom = '4px'
      dangerTitle.textContent = danger.title
      dangerItem.appendChild(dangerTitle)

      const dangerMeta = document.createElement('div')
      dangerMeta.style.fontSize = '12px'
      dangerMeta.style.color = '#6b7280'
      dangerMeta.textContent = `タイプ: ${danger.danger_type} | レベル: ${danger.danger_level}`
      dangerItem.appendChild(dangerMeta)

      if (danger.description) {
        const dangerDesc = document.createElement('p')
        dangerDesc.style.margin = '8px 0 0 0'
        dangerDesc.style.fontSize = '13px'
        dangerDesc.textContent = danger.description
        dangerItem.appendChild(dangerDesc)
      }

      const location = [danger.town, danger.city, danger.prefecture]
        .filter(Boolean)
        .join(', ')
      if (location) {
        const locationEl = document.createElement('div')
        locationEl.style.fontSize = '12px'
        locationEl.style.color = '#6b7280'
        locationEl.style.marginTop = '4px'
        locationEl.textContent = `場所: ${location}`
        dangerItem.appendChild(locationEl)
      }

      // Original image (if exists)
      if (danger.image_url) {
        appendImageSection(dangerItem, '報告画像:', [danger.image_url], 400)
      }

      // Processed images (if exist)
      if (danger.processed_image_urls?.length) {
        appendImageSection(
          dangerItem,
          '処理済み画像:',
          danger.processed_image_urls,
          300
        )
      }

      dangerListSection.appendChild(dangerItem)
    }
    container.appendChild(dangerListSection)
  } else {
    const noDataEl = document.createElement('p')
    noDataEl.textContent = 'このルート付近に危険箇所は報告されていません。'
    noDataEl.style.color = '#6b7280'
    noDataEl.style.fontStyle = 'italic'
    container.appendChild(noDataEl)
  }

  return container
}

function createSummaryRow(text: string, isBold = false): HTMLParagraphElement {
  const row = document.createElement('p')
  row.style.margin = '4px 0'
  row.textContent = text
  if (isBold) {
    row.style.fontWeight = 'bold'
  }
  return row
}

function appendImageSection(
  parent: HTMLElement,
  label: string,
  imageUrls: string[],
  maxHeightPx: number
): void {
  if (imageUrls.length === 0) {
    return
  }

  const section = document.createElement('div')
  section.style.marginTop = '12px'

  const labelEl = document.createElement('div')
  labelEl.style.fontSize = '12px'
  labelEl.style.color = '#6b7280'
  labelEl.style.marginBottom = '4px'
  labelEl.textContent = label
  section.appendChild(labelEl)

  const imageContainer = document.createElement('div')
  imageContainer.style.display = 'flex'
  imageContainer.style.flexDirection = 'column'
  imageContainer.style.gap = '8px'

  for (const imageUrl of imageUrls) {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous' // Enable CORS for html2canvas
    img.src = imageUrl
    img.style.width = '100%'
    img.style.maxHeight = `${maxHeightPx}px`
    img.style.objectFit = 'contain'
    img.style.borderRadius = '4px'
    img.style.backgroundColor = '#f3f4f6'
    imageContainer.appendChild(img)
  }

  section.appendChild(imageContainer)
  parent.appendChild(section)
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

async function renderReportToCanvas(
  report: RouteDangerReport,
  mapboxToken: string
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default
  const container = createReportHtmlContainer(report, mapboxToken)

  // Temporarily add to DOM for rendering
  document.body.appendChild(container)

  // Wait for all images to load before capturing
  await waitForImages(container)

  try {
    return await html2canvas(container, {
      scale: HTML2CANVAS_SCALE, // Reduced from 3 for better memory efficiency
      useCORS: true,
      logging: false,
      imageTimeout: IMAGE_TIMEOUT_MS,
    })
  } finally {
    document.body.removeChild(container)
  }
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

  const canvas = await renderReportToCanvas(report, mapboxToken)

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
