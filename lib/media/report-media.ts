/**
 * ほかの人に渡す報告の写真の URL(UIUX改装 項目61)。保存のキー(danger-reports/{投稿者のid}/...)を見せず、
 * 報告の id と写真の場所だけで指す。配信は /api/media/report/[id]/[slot]。
 *
 *   image  … 元の写真(ぼかした写真)
 *   legacy … 以前の1枚だけの加工画像
 *   p{n}   … もしも画像(processed_image_keys の n 番目)
 */

export type ReportMediaSlot = { kind: 'image' } | { kind: 'legacy' } | { kind: 'processed'; index: number }

export function reportMediaUrl(reportId: string, slot: string): string {
  return `/api/media/report/${encodeURIComponent(reportId)}/${slot}`
}

export function parseReportMediaSlot(value: string): ReportMediaSlot | null {
  if (value === 'image') return { kind: 'image' }
  if (value === 'legacy') return { kind: 'legacy' }
  const match = value.match(/^p(\d{1,3})$/)
  return match ? { kind: 'processed', index: Number(match[1]) } : null
}

/** 報告の写真の場所 → 保存のキー。無ければ null */
export function keyForReportMediaSlot(
  report: { imageKey: string | null; processedImageKey: string | null; processedImageKeys: readonly string[] },
  slot: ReportMediaSlot,
): string | null {
  if (slot.kind === 'image') return report.imageKey
  if (slot.kind === 'legacy') return report.processedImageKey
  return report.processedImageKeys[slot.index] ?? null
}
