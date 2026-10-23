import type { DangerReport, UserRoute } from '@/lib/types'
import { createKidsHazardCue } from '@/lib/ar-learning-tour-kids'
import { dangerReportDisplayUrl } from '@/lib/danger-report-image-access'
import { generateOverviewMapUrl } from './report-map'

export type PrintPurpose = 'family' | 'school'
export interface PrintItem {
  id: string
  number: number
  title: string
  observation: string
  action: string
  photoUrl?: string
  photoLabel?: string
}
export interface PrintDocument {
  purpose: PrintPurpose
  title: string
  generatedAt: string
  items: PrintItem[]
  mapUrl?: string
  mapNote?: string
  furigana?: boolean
}
export interface PrintOptions {
  route: UserRoute
  dangers: DangerReport[]
  purpose: PrintPurpose
  selectedIds: string[]
  sharedTitle?: string
  sharedPlaceNames?: Record<string, string>
  includePhotos?: boolean
  includeMap?: boolean
  selectedImageUrls?: Record<string, string>
  generatedAt?: string
  mapboxToken?: string
  furigana?: boolean
}

/** Build a fresh allowlisted school document; private content never reaches its renderer. */
export function buildPrintDocument(options: PrintOptions): PrintDocument {
  const byId = new Map(options.dangers.map(danger => [danger.id, danger]))
  const selected = [...new Set(options.selectedIds)].flatMap(id => byId.has(id) ? [byId.get(id)!] : [])
  const school = options.purpose === 'school'
  const items = selected.map((danger, index): PrintItem => {
    const cue = createKidsHazardCue(danger)
    const candidates = [...(danger.processed_image_urls ?? []), danger.processed_image_url, danger.image_url].filter((value): value is string => !!value)
    const selectedPhoto = options.selectedImageUrls?.[danger.id]
    const orderedPhotos = selectedPhoto && candidates.includes(selectedPhoto) ? [selectedPhoto, ...candidates] : candidates
    const photoUrl = !school && options.includePhotos ? orderedPhotos.map(value => dangerReportDisplayUrl(value)).find(Boolean) : null
    return {
      id: danger.id, number: index + 1,
      title: school ? options.sharedPlaceNames?.[danger.id]?.trim() || `たしかめる場所 ${index + 1}` : danger.title,
      observation: school ? cue.shortMessage : danger.description?.trim() || cue.shortMessage,
      action: danger.danger_type === 'traffic' ? '立ち止まれる場所で、車や自転車の動きを親子でたしかめよう' : cue.action,
      ...(!school && photoUrl ? { photoUrl, photoLabel: '投稿された写真' } : {}),
    }
  })
  // Static map symbols are single characters. Keep numerical labels faithful by
  // using a map only when every selected point is plottable and at most nine.
  const hasMap = !school && options.includeMap && !!options.route.route_geometry && !!options.mapboxToken
    && selected.length > 0 && selected.length <= 9 && selected.every(d => Number.isFinite(d.latitude) && Math.abs(d.latitude) <= 90 && Number.isFinite(d.longitude) && Math.abs(d.longitude) <= 180)
  return {
    purpose: options.purpose,
    title: school ? options.sharedTitle?.trim() || 'みんなの通学路' : options.route.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(), items,
    furigana: options.furigana ?? false,
    ...(hasMap ? {
      mapUrl: generateOverviewMapUrl(options.route.route_geometry!, selected, options.mapboxToken!, undefined, { spreadMarkers: false }),
      mapNote: '番号は下の一覧と同じです。近い場所の印は重なることがあります。',
    } : {}),
  }
}
