import html2canvas from "html2canvas"

export interface FamilyShareCardData {
  title: string
  summary: string
  action?: string | null
  mapLabel: string
  imageUrl?: string | null
  mapImageUrl?: string | null
  photoImageUrl?: string | null
}

interface ShareFamilyShareCardOptions {
  cardElement: HTMLElement
  card: FamilyShareCardData
  fileName?: string
}

const DEFAULT_DOWNLOAD_NAME = "family-share-card.png"
const IMAGE_LOAD_TIMEOUT_MS = 15000

export function buildFamilyShareCardText(card: FamilyShareCardData): string {
  return [
    card.title,
    `場所: ${card.mapLabel}`,
    `要点: ${card.summary}`,
    card.action ? `家族で確認: ${card.action}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildFamilyShareMapLabel(
  parts: Array<string | null | undefined>,
  coordinates?: [number, number] | null,
): string {
  const label = parts
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("・")

  if (label) {
    return label
  }

  if (coordinates) {
    return `${coordinates[1].toFixed(3)}, ${coordinates[0].toFixed(3)}`
  }

  return "通学路の確認ポイント"
}

export function buildFamilyShareSummary(
  description?: string | null,
  fallbackTitle?: string | null,
): string {
  const trimmedDescription = description?.trim()
  if (trimmedDescription) {
    return trimmedDescription
  }

  const trimmedTitle = fallbackTitle?.trim()
  if (trimmedTitle) {
    return `${trimmedTitle}について家族で注意点を確認してください。`
  }

  return "通学路で気をつけたい危険を家族で確認してください。"
}

export function buildFamilyShareAction(
  checkpoints?: string[] | null,
  fallbackAction?: string | null,
): string | null {
  const firstCheckpoint = checkpoints?.find((checkpoint) => checkpoint?.trim())
  if (firstCheckpoint) {
    return firstCheckpoint
  }

  if (fallbackAction?.trim()) {
    return fallbackAction.trim()
  }

  return "現地で安全な待機場所と声かけポイントを確認する"
}

async function waitForCardImages(
  cardElement: HTMLElement,
  timeoutMs = IMAGE_LOAD_TIMEOUT_MS,
): Promise<void> {
  const images = Array.from(cardElement.querySelectorAll("img"))

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalHeight > 0) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        const cleanup = () => {
          clearTimeout(timeoutId)
          image.removeEventListener("load", handleLoad)
          image.removeEventListener("error", handleError)
        }

        const handleLoad = () => {
          cleanup()
          resolve()
        }

        const handleError = () => {
          cleanup()
          resolve()
        }

        const timeoutId = window.setTimeout(() => {
          cleanup()
          resolve()
        }, timeoutMs)

        image.addEventListener("load", handleLoad, { once: true })
        image.addEventListener("error", handleError, { once: true })
      })
    }),
  )
}

export async function renderFamilyShareCardBlob(cardElement: HTMLElement): Promise<Blob> {
  await waitForCardImages(cardElement)

  const canvas = await html2canvas(cardElement, {
    backgroundColor: "#ffffff",
    scale: 2,
    logging: false,
    useCORS: true,
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error("共有カード画像を生成できませんでした"))
    }, "image/png")
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function shareFamilyShareCard({
  cardElement,
  card,
  fileName = DEFAULT_DOWNLOAD_NAME,
}: ShareFamilyShareCardOptions) {
  const blob = await renderFamilyShareCardBlob(cardElement)
  const shareText = buildFamilyShareCardText(card)
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }

  if (typeof File !== "undefined" && typeof nav.share === "function") {
    const file = new File([blob], fileName, { type: "image/png" })
    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      await nav.share({
        title: card.title,
        text: shareText,
        files: [file],
      })
      return { mode: "share" as const }
    }
  }

  downloadBlob(blob, fileName)

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareText)
  }

  return { mode: "download" as const }
}
