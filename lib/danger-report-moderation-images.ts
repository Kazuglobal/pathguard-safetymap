import { isMaskedMediaKey } from '@/lib/media/url'

export const MAX_MODERATION_IMAGES = 3

/**
 * The same bounded list is used for paid reservations and R2 loading.
 * AI に送るのは端末でぼかした写真(ファイル名の頭が m-)だけ。ぼかしていない以前の写真は送らない
 * (写真つきの報告は、AI が写真を見られなくても運営の確認に回る。UIUX改装 項目57)
 */
export function moderationImageKeys(report: {
  imageKey: string | null
  processedImageKey: string | null
  processedImageKeys: string[]
}): string[] {
  return [report.imageKey, report.processedImageKey, ...report.processedImageKeys]
    .filter((key): key is string => isMaskedMediaKey(key)).slice(0, MAX_MODERATION_IMAGES)
}
