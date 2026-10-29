// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  coarsenAddress,
  coarsenRouteLocation,
  distanceMeters,
  randomEndTrim,
  ROUTE_END_FALLBACK_LABEL,
  ROUTE_END_TRIM_JITTER_METERS,
  ROUTE_END_TRIM_METERS,
  ROUTE_MAX_POINTS,
  ROUTE_START_FALLBACK_LABEL,
  roundCoordinate,
  sanitizeRouteGeometry,
  trimLineEnds,
} from '@/lib/route-privacy'

type Position = [number, number]

/** 東京駅付近から真東へ、meters ごとの点を並べた直線(緯度一定) */
function eastwardLine(totalMeters: number, stepMeters = 50): Position[] {
  const metersPerDegreeLng = distanceMeters([139.76, 35.68], [139.77, 35.68]) / 0.01
  const points: Position[] = []
  for (let walked = 0; walked <= totalMeters; walked += stepMeters) points.push([139.76 + walked / metersPerDegreeLng, 35.68])
  return points
}

function length(coordinates: readonly Position[]): number {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index]!, point), 0)
}

describe('通学路の両端を削る(自宅・学校の前の道を残さない)', () => {
  it('始点側・終点側から、それぞれ指定の長さを削る', () => {
    const line = eastwardLine(1_000)
    const trimmed = trimLineEnds(line, { start: ROUTE_END_TRIM_METERS, end: ROUTE_END_TRIM_METERS })!

    expect(distanceMeters(line[0]!, trimmed[0]!)).toBeCloseTo(ROUTE_END_TRIM_METERS, 0)
    expect(distanceMeters(line[line.length - 1]!, trimmed[trimmed.length - 1]!)).toBeCloseTo(ROUTE_END_TRIM_METERS, 0)
    expect(length(trimmed)).toBeCloseTo(600, 0)
  })

  it('両端を削ると50mも残らない短い線(450m 未満)は保存しない', () => {
    expect(trimLineEnds(eastwardLine(400))).toBeNull()
    expect(trimLineEnds(eastwardLine(440, 40))).toBeNull()
    expect(trimLineEnds(eastwardLine(300))).toBeNull()
    expect(trimLineEnds([[139.76, 35.68]])).toBeNull()
    expect(trimLineEnds(eastwardLine(500))).not.toBeNull()
  })

  it('削る長さは端ごとに 200〜350m の乱数で、毎回ちがう(まっすぐな道でも、残った線の端から自宅・学校を逆算できない)', () => {
    const line = eastwardLine(2_000, 1_000)
    const starts = new Set<number>()
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const trimmed = trimLineEnds(line)!
      const start = distanceMeters(line[0]!, trimmed[0]!)
      const end = distanceMeters(line[line.length - 1]!, trimmed[trimmed.length - 1]!)
      for (const value of [start, end]) {
        expect(value).toBeGreaterThanOrEqual(ROUTE_END_TRIM_METERS - 0.5)
        expect(value).toBeLessThanOrEqual(ROUTE_END_TRIM_METERS + ROUTE_END_TRIM_JITTER_METERS + 0.5)
      }
      starts.add(Math.round(start))
    }
    expect(starts.size).toBeGreaterThan(1)
  })

  it('短い線では、50m 以上残るように足す長さを減らす(450m 以上の線は必ず保存する)', () => {
    expect(randomEndTrim(2_000, () => 0)).toEqual({ start: 200, end: 200 })
    expect(randomEndTrim(2_000, () => 0.5)).toEqual({ start: 275, end: 275 })
    expect(randomEndTrim(500, () => 0.999_999)).toEqual({ start: expect.closeTo(225, 3), end: expect.closeTo(225, 3) })
    for (let attempt = 0; attempt < 20; attempt += 1) expect(trimLineEnds(eastwardLine(500))).not.toBeNull()
  })

  it('点の間隔が粗くても、指定の長さのところで線を切る', () => {
    const trimmed = trimLineEnds(eastwardLine(1_000, 1_000), { start: 200, end: 200 })!
    expect(trimmed).toHaveLength(2)
    expect(length(trimmed)).toBeCloseTo(600, 0)
  })
})

describe('保存する道すじ', () => {
  it('LineString だけを、両端を削った印(削った最短の長さ)を書き添えて保存する', () => {
    const geometry = sanitizeRouteGeometry({ type: 'LineString', coordinates: eastwardLine(1_000) })
    expect(geometry).toMatchObject({ type: 'LineString', trimmedEndsMeters: 200 })
    expect((geometry!.coordinates as Position[])[0]![0]).toBeGreaterThan(139.76)
  })

  it('送られてきた線に印が付いていても信じず、必ず削る', () => {
    const line = eastwardLine(1_000)
    const geometry = sanitizeRouteGeometry({ type: 'LineString', coordinates: line, trimmedEndsMeters: 200 })!
    expect(distanceMeters(line[0]!, (geometry.coordinates as Position[])[0]!)).toBeGreaterThanOrEqual(ROUTE_END_TRIM_METERS - 0.5)
  })

  it.each([
    ['Point', { type: 'Point', coordinates: [139.76, 35.68] }],
    ['座標が範囲外', { type: 'LineString', coordinates: [[139.76, 35.68], [200, 35.68]] }],
    ['座標が数でない', { type: 'LineString', coordinates: [[139.76, 35.68], ['139.77', 35.68]] }],
    ['点が多すぎる', { type: 'LineString', coordinates: Array.from({ length: ROUTE_MAX_POINTS + 1 }, (_, index) => [139.76 + index * 1e-5, 35.68]) }],
  ])('%s の線は保存しない', (_label, geometry) => {
    expect(sanitizeRouteGeometry(geometry as Record<string, unknown>)).toBeNull()
  })
})

describe('起点・終点の座標と住所を粗くする', () => {
  it('座標は小数2桁(約1km)に丸める', () => {
    expect(roundCoordinate(35.689634)).toBe(35.69)
    expect(roundCoordinate(139.691706)).toBe(139.69)
  })

  it.each([
    ['〒160-0023 東京都新宿区西新宿2丁目8-1', '東京都新宿区'],
    ['日本、〒100-0005 東京都千代田区丸の内1丁目', '東京都千代田区'],
    ['東京都中央区日本橋1丁目', '東京都中央区'],
    ['神奈川県 横浜市 中区 山下町', '神奈川県横浜市中区'],
    ['北海道札幌市中央区北1条西2丁目', '北海道札幌市中央区'],
    ['東京都西多摩郡奥多摩町氷川', '東京都西多摩郡奥多摩町'],
    ['東京都町田市原町田6丁目', '東京都町田市'],
    ['京都府京都市中京区', '京都府京都市中京区'],
    ['大阪府', '大阪府'],
    // 名前の途中に「市・郡・町・村」を含む市町村(途中で切らない・町名まではみ出さない)
    ['奈良県大和郡山市北郡山町248-4', '奈良県大和郡山市'],
    ['大阪府高槻市郡家新町48-1', '大阪府高槻市'],
    ['三重県四日市市諏訪町1-5', '三重県四日市市'],
    ['広島県廿日市市下平良1丁目', '広島県廿日市市'],
    ['石川県野々市市三納1丁目', '石川県野々市市'],
    ['東京都新宿区市谷本村町5-1', '東京都新宿区'],
    ['福島県郡山市朝日1丁目', '福島県郡山市'],
    ['千葉県市川市八幡1丁目', '千葉県市川市'],
    ['新潟県十日町市本町', '新潟県十日町市'],
    ['東京都東村山市本町', '東京都東村山市'],
    ['富山県中新川郡上市町横法音寺', '富山県中新川郡上市町'],
    ['富山県上市町横法音寺', '富山県上市町'],
    ['北海道余市郡余市町黒川町', '北海道余市郡余市町'],
    ['奈良県高市郡明日香村岡', '奈良県高市郡明日香村'],
    ['北海道ニセコ町字富士見', '北海道ニセコ町'],
    ['大阪府大阪市北区梅田1丁目', '大阪府大阪市北区'],
    ['東京都北区王子1丁目', '東京都北区'],
    ['静岡県浜松市中央区元城町', '静岡県浜松市中央区'],
    ['兵庫県姫路市本町', '兵庫県姫路市'],
  ])('%s → %s(番地・郵便番号は残さない)', (address, expected) => {
    expect(coarsenAddress(address)).toBe(expected)
  })

  it.each(['35.6896, 139.6917', '地点A', '', null])('都道府県が読み取れない住所 %j は使わない', (address) => {
    expect(coarsenAddress(address)).toBeNull()
  })

  it('「粗く保存」では道すじを保存せず、起点・終点を約10km(小数1桁)に丸める', () => {
    const located = coarsenRouteLocation({
      startLat: 35.689634, startLng: 139.691706, endLat: 35.681236, endLng: 139.767125,
      startAddress: '東京都新宿区西新宿2丁目8-1', endAddress: '東京都千代田区丸の内1丁目',
      routeGeometry: { type: 'LineString', coordinates: eastwardLine(1_000) },
    }, 'coarse')

    expect(located).toEqual({
      startLat: 35.7, startLng: 139.7, endLat: 35.7, endLng: 139.8,
      startAddress: '東京都新宿区', endAddress: '東京都千代田区', routeGeometry: null,
    })
    expect(coarsenRouteLocation({ name: 'のみ' }, 'coarse')).toEqual({ name: 'のみ' })
  })

  it('渡された項目だけを粗くし、読み取れない住所は「出発地」「到着地」にする', () => {
    const input = {
      name: '登校',
      startLat: 35.689634, startLng: 139.691706, endLat: 35.681236, endLng: 139.767125,
      startAddress: '35.6896, 139.6917', endAddress: '東京都千代田区丸の内1丁目9-1',
      routeGeometry: { type: 'LineString', coordinates: eastwardLine(1_000) },
    }

    const located = coarsenRouteLocation(input)

    expect(located).toMatchObject({
      name: '登校', startLat: 35.69, startLng: 139.69, endLat: 35.68, endLng: 139.77,
      startAddress: ROUTE_START_FALLBACK_LABEL, endAddress: '東京都千代田区',
    })
    expect(located.routeGeometry).toMatchObject({ trimmedEndsMeters: 200 })
    expect(coarsenRouteLocation({ name: 'のみ' })).toEqual({ name: 'のみ' })
    expect(coarsenRouteLocation({ endAddress: '番地だけ' }).endAddress).toBe(ROUTE_END_FALLBACK_LABEL)
  })
})
