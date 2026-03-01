const DEFAULT_MAX_API_FILE_SIZE = 3 * 1024 * 1024

type CompressOptions = {
  maxDimension?: number
  jpegQuality?: number
  targetMaxSize?: number
  log?: boolean
}

const shouldLog = (log?: boolean) => log === true && process.env.NODE_ENV !== "production"

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxDimension = 1200,
    jpegQuality = 0.7,
    targetMaxSize = DEFAULT_MAX_API_FILE_SIZE,
    log = false,
  } = options

  const canLog = shouldLog(log)

  try {
    const objectUrl = URL.createObjectURL(file)
    let img: HTMLImageElement
    try {
      img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }

    const { width, height } = img

    // Helper function to create compressed file
    const createCompressedFile = async (
      targetW: number,
      targetH: number,
      quality: number
    ): Promise<File> => {
      const canvas = document.createElement("canvas")
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Failed to get canvas context")
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const supportsWebp = canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob from canvas"))),
          supportsWebp ? "image/webp" : "image/jpeg",
          quality,
        )
      })

      const extension = supportsWebp ? "webp" : "jpg"
      const mime = supportsWebp ? "image/webp" : "image/jpeg"
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-compressed.${extension}`, {
        type: mime,
        lastModified: Date.now(),
      })
    }

    // Initial compression with default settings
    let scale = Math.min(1, maxDimension / Math.max(width, height))
    let targetW = Math.max(1, Math.round(width * scale))
    let targetH = Math.max(1, Math.round(height * scale))

    // Skip compression for small files that don't need resizing
    if (scale === 1 && file.size <= targetMaxSize * 0.8) {
      return file
    }

    let compressedFile = await createCompressedFile(targetW, targetH, jpegQuality)

    // Progressive compression if still too large
    let attempts = 0
    const maxAttempts = 4
    let currentQuality = jpegQuality
    let currentMaxDim = maxDimension

    while (compressedFile.size > targetMaxSize && attempts < maxAttempts) {
      attempts++
      // Reduce quality and dimension progressively
      currentQuality = Math.max(0.4, currentQuality - 0.1)
      currentMaxDim = Math.max(800, currentMaxDim - 200)

      scale = Math.min(1, currentMaxDim / Math.max(width, height))
      targetW = Math.max(1, Math.round(width * scale))
      targetH = Math.max(1, Math.round(height * scale))

      if (canLog) {
        console.log(`[compressImage] Retry ${attempts}: dim=${currentMaxDim}, quality=${currentQuality.toFixed(2)}`)
      }
      compressedFile = await createCompressedFile(targetW, targetH, currentQuality)
    }

    if (canLog) {
      if (compressedFile.size > targetMaxSize) {
        console.warn(
          `[compressImage] Could not compress below ${targetMaxSize / 1024 / 1024}MB, final size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
        )
      } else {
        console.log(`[compressImage] Compressed to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
      }
    }

    return compressedFile
  } catch (error) {
    if (canLog) {
      console.error("compressImage error:", error)
    }
    return file
  }
}

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const result = String(fr.result || "")
      const base64 = result.startsWith("data:") ? result.split(",")[1] : result
      resolve(base64)
    }
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
