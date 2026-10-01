/**
 * 警察庁「本票」CSV（直近5年分）から事故多発地点を計算し、D1 accident_hotspots 用の SQL を作る（生成のみ）。
 *
 * Usage:
 *   pnpm tsx scripts/migrate/build-traffic-hotspots.ts --csv-dir=<dir with honhyo_YYYY.csv> --out=<dir> [--top=20]
 * 出力:
 *   hotspots-insert.sql … 同じ dataset_version の行を消してから入れ直す（BATCH=100）
 *   hotspots-cleanup-old.sql … 他の dataset_version の行を消す（新しい版を確認したあとに流す）
 *   hotspots-top.json   … 件数上位（確認用）
 * 年・半径・件数の条件は lib/traffic-accident/hotspot-config.ts。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { honhyoInsertColumnIndex, honhyoRowToInsert } from '../../lib/traffic-accident/honhyo'
import {
  HOTSPOT_DATASET_VERSION,
  HOTSPOT_MAX_YEAR,
  HOTSPOT_MIN_COUNT,
  HOTSPOT_MIN_YEAR,
  HOTSPOT_RADIUS_METERS,
} from '../../lib/traffic-accident/hotspot-config'
import { computeHotspots, type HotspotPoint } from '../../lib/traffic-accident/hotspots'

const BATCH = 100
const YOUNG_AGE_CODE = 1 // 本票の年齢区分 01 = 0～24歳

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function sqlValue(value: string | number | null): string {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

async function readYear(csvDir: string, year: number): Promise<HotspotPoint[]> {
  const text = new TextDecoder('shift_jis').decode(await readFile(path.join(csvDir, `honhyo_${year}.csv`)))
  const lines = text.split(/\r?\n/)
  const index = honhyoInsertColumnIndex(lines[0].split(','))
  const minCells = Math.max(...Object.values(index)) + 1
  const points: HotspotPoint[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(',')
    const converted = cells.length >= minCells ? honhyoRowToInsert(cells, year, index) : null
    if (!converted) continue
    const { values, key } = converted
    const hour = values.occurredAt ? Number(values.occurredAt.slice(11, 13)) : null
    points.push({
      lat: values.latitude,
      lng: values.longitude,
      year,
      fatal: values.severityCode === 1,
      pedestrian: values.involvesPedestrian,
      young: values.partyAAge === YOUNG_AGE_CODE || values.partyBAge === YOUNG_AGE_CODE,
      accidentClass: values.accidentTypeLabel,
      hour,
      prefectureCode: key.prefectureCode,
      municipalityCode: values.municipalityCode,
    })
  }
  return points
}

async function main(): Promise<void> {
  const csvDir = argument('csv-dir')
  const out = argument('out')
  const top = Number(argument('top') ?? '20')
  if (!csvDir || !out) throw new Error('Use --csv-dir=<dir> --out=<dir> [--top=20]')
  await mkdir(out, { recursive: true })

  const points: HotspotPoint[] = []
  const perYear: Record<number, number> = {}
  for (let year = HOTSPOT_MIN_YEAR; year <= HOTSPOT_MAX_YEAR; year += 1) {
    const yearPoints = await readYear(csvDir, year)
    perYear[year] = yearPoints.length
    for (const point of yearPoints) points.push(point) // spread overflows the stack at ~300k items
  }

  const started = Date.now()
  const hotspots = computeHotspots(points, { radiusMeters: HOTSPOT_RADIUS_METERS, minCount: HOTSPOT_MIN_COUNT })
  const elapsedMs = Date.now() - started

  const columns = [
    'dataset_version', 'lat', 'lng', 'radius_meters', 'min_year', 'max_year', 'accident_count', 'fatal_count',
    'pedestrian_count', 'young_count', 'by_year_json', 'by_class_json', 'peak_hour', 'prefecture_code',
    'municipality_code', 'national_rank',
  ]
  const statements = [`DELETE FROM accident_hotspots WHERE dataset_version = ${sqlValue(HOTSPOT_DATASET_VERSION)};`]
  for (let start = 0; start < hotspots.length; start += BATCH) {
    const rows = hotspots.slice(start, start + BATCH).map((spot) => `(${[
      HOTSPOT_DATASET_VERSION, spot.lat, spot.lng, HOTSPOT_RADIUS_METERS, HOTSPOT_MIN_YEAR, HOTSPOT_MAX_YEAR,
      spot.accidentCount, spot.fatalCount, spot.pedestrianCount, spot.youngCount,
      JSON.stringify(spot.byYear), JSON.stringify(spot.byClass), spot.peakHour, spot.prefectureCode,
      spot.municipalityCode, spot.nationalRank,
    ].map(sqlValue).join(',')})`)
    statements.push(`INSERT INTO accident_hotspots (${columns.join(', ')}) VALUES ${rows.join(',')};`)
  }
  await writeFile(path.join(out, 'hotspots-insert.sql'), statements.join('\n') + '\n', 'utf8')
  await writeFile(path.join(out, 'hotspots-cleanup-old.sql'),
    `DELETE FROM accident_hotspots WHERE dataset_version <> ${sqlValue(HOTSPOT_DATASET_VERSION)};\n`, 'utf8')
  await writeFile(path.join(out, 'hotspots-top.json'), JSON.stringify(hotspots.slice(0, top), null, 2), 'utf8')

  const byPrefecture: Record<number, number> = {}
  for (const spot of hotspots) byPrefecture[spot.prefectureCode] = (byPrefecture[spot.prefectureCode] ?? 0) + 1
  console.log(JSON.stringify({
    datasetVersion: HOTSPOT_DATASET_VERSION,
    accidents: points.length,
    perYear,
    hotspots: hotspots.length,
    maxCount: hotspots[0]?.accidentCount ?? 0,
    elapsedMs,
    byPrefecture,
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error('[build-traffic-hotspots]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
