// 事故多発地点の API 返り値（クライアントからも使うので server 専用の import をしない）

export interface AccidentHotspotSummary {
  id: number
  latitude: number
  longitude: number
  radiusMeters: number
  minYear: number
  maxYear: number
  accidentCount: number
  fatalCount: number
  pedestrianCount: number
  /** 当事者に 0～24歳 区分を含む件数（本票では子どもだけを数えられない）。 */
  youngCount: number
  byYear: Record<string, number>
  byClass: Record<string, number>
  peakHour: number | null
  nationalRank: number
  /** 検索点・経路からの距離（m）。bbox 検索では null。 */
  distanceMeters: number | null
}

export interface AccidentHotspotList {
  hotspots: AccidentHotspotSummary[]
  truncated: boolean
}

/** 件数が最も多い事故類型（同数は先に現れた方）。 */
export function dominantAccidentClass(byClass: Record<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [name, count] of Object.entries(byClass)) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}
