function decodeDataUrl(dataUrl: string): Blob {
  const matched = dataUrl.match(/^data:([^;,]+)?(;base64)?,([^]*)$/)
  if (!matched) {
    throw new Error("Invalid data URL")
  }

  const mimeType = matched[1] || "application/octet-stream"
  const isBase64 = Boolean(matched[2])
  const payload = matched[3] || ""

  if (isBase64) {
    const binary = atob(payload.replace(/\s/g, ""))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType })
}

export async function urlOrDataUrlToBlob(source: string, signal?: AbortSignal): Promise<Blob> {
  if (source.startsWith("data:")) {
    return decodeDataUrl(source)
  }

  const response = await fetch(source, { signal })
  return response.blob()
}
