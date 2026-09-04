export const MAX_MODERATION_IMAGES = 3

/** The same bounded list is used for paid reservations and R2 loading. */
export function moderationImageKeys(report: {
  imageKey: string | null
  processedImageKey: string | null
  processedImageKeys: string[]
}): string[] {
  return [report.imageKey, report.processedImageKey, ...report.processedImageKeys]
    .filter((key): key is string => Boolean(key)).slice(0, MAX_MODERATION_IMAGES)
}
