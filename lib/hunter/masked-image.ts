// =============================================
// マスク済み写真の書き出し(きけんハンターのマスク確認画面)
// canvas で描き直すので Exif(位置情報を含む)は付かない。
// WebP を優先し、Safari のように canvas で WebP を作れない(黙って PNG を返す)ブラウザでは JPEG にする。
// PNG のままだと数 MB になって送るのが遅く、保存(lib/hunter/storage.ts は WebP と JPEG だけ)もできない。
// =============================================

export const MASKED_IMAGE_QUALITY = 0.85

interface EncodableCanvas {
  toDataURL(type: string, quality?: number): string
}

/** マスク済みの canvas を data URL にする(WebP、できなければ JPEG)。 */
export function encodeMaskedCanvas(canvas: EncodableCanvas): string {
  const webp = canvas.toDataURL("image/webp", MASKED_IMAGE_QUALITY)
  if (webp.startsWith("data:image/webp")) return webp
  return canvas.toDataURL("image/jpeg", MASKED_IMAGE_QUALITY)
}
