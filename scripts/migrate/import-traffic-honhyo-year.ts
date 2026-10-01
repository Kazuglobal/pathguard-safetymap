/**
 * 警察庁「本票」CSV の新しい年を traffic_accidents に追加する SQL を作る（D1 には何も書かない。生成のみ）。
 *
 * Usage:
 *   pnpm tsx scripts/migrate/import-traffic-honhyo-year.ts --csv-dir=<dir with honhyo_YYYY.csv> --year=2025 --out=<dir>
 * 出力（D1 の制約: 1文 100KB 以内・1文 30 秒以内 に合わせて分割）:
 *   preflight.sql     … 同じ年の行が既にあるか数える（0 でなければ取り込まない）
 *   stage-0-create.sql / stage-<year>.sql … 一時テーブル traffic_import に入れる（traffic_accidents は触らない）
 *   apply-chunks.txt  … 1行1文の INSERT ... SELECT（都道府県ずつ。同じキーの行があれば入れない）
 *   cleanup.sql       … 一時テーブルを消す
 * 本番へは preflight → stage → 件数確認 → chunks → 抜き取り確認 → cleanup の順に、人が確認しながら流す。
 * 実行前に wrangler d1 time-travel info で復元点を控える。
 * CSV は Shift_JIS。https://www.npa.go.jp/publications/statistics/koutsuu/opendata/<year>/honhyo_<year>.csv
 */
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import path from 'node:path'

import {
  honhyoInsertColumnIndex,
  honhyoRowToInsert,
  type HonhyoInsertValues,
} from '../../lib/traffic-accident/honhyo'

const BATCH = 100 // keeps each INSERT well under D1's 100KB statement limit

const KEY_COLUMNS = ['source_year', 'prefecture_code', 'police_station_code', 'record_number'] as const

const VALUE_COLUMNS: Array<[keyof HonhyoInsertValues, string]> = [
  ['municipalityCode', 'municipality_code'],
  ['latitude', 'lat'],
  ['longitude', 'lng'],
  ['occurredAt', 'occurred_at'],
  ['severityCode', 'severity_code'],
  ['accidentTypeCode', 'accident_type_code'],
  ['accidentTypeLabel', 'accident_type_label'],
  ['fatalities', 'fatalities'],
  ['injuries', 'injuries'],
  ['involvesChild', 'involves_child'],
  ['involvesPedestrian', 'involves_pedestrian'],
  ['partyAAge', 'party_a_age'],
  ['partyATypeCode', 'party_a_type_code'],
  ['partyATypeLabel', 'party_a_type_label'],
  ['partyBAge', 'party_b_age'],
  ['partyBTypeCode', 'party_b_type_code'],
  ['partyBTypeLabel', 'party_b_type_label'],
  ['injuryLevelA', 'injury_level_a'],
  ['injuryLevelB', 'injury_level_b'],
  ['dayNightCode', 'day_night_code'],
  ['dayOfWeek', 'day_of_week'],
  ['roadShapeCode', 'road_shape_code'],
  ['roadShapeLabel', 'road_shape_label'],
  ['roadSurfaceCode', 'road_surface_code'],
  ['roadSurfaceLabel', 'road_surface_label'],
  ['roadWidthCode', 'road_width_code'],
  ['sidewalkCode', 'sidewalk_code'],
  ['sidewalkLabel', 'sidewalk_label'],
  ['signalCode', 'signal_code'],
  ['terrainCode', 'terrain_code'],
  ['terrainLabel', 'terrain_label'],
  ['weatherCode', 'weather_code'],
  ['weatherLabel', 'weather_label'],
  ['zoneRegulationCode', 'zone_regulation_code'],
]

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function sqlValue(value: string | number | boolean | null): string {
  if (value == null) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

async function write(stream: NodeJS.WritableStream, text: string): Promise<void> {
  if (!stream.write(text)) await once(stream, 'drain')
}

async function main(): Promise<void> {
  const csvDir = argument('csv-dir')
  const out = argument('out')
  const yearText = argument('year')
  if (!csvDir || !out || !yearText || !/^\d{4}$/.test(yearText)) {
    throw new Error('Use --csv-dir=<dir> --year=YYYY --out=<dir>')
  }
  const year = Number(yearText)
  await mkdir(out, { recursive: true })

  const columns = [...KEY_COLUMNS, ...VALUE_COLUMNS.map(([, column]) => column)]
  await writeFile(path.join(out, 'preflight.sql'),
    `SELECT COUNT(*) AS existing_rows FROM traffic_accidents WHERE source_year = ${year};\n`, 'utf8')
  await writeFile(path.join(out, 'stage-0-create.sql'),
    `DROP TABLE IF EXISTS traffic_import;\nCREATE TABLE traffic_import (${columns.join(', ')});\n`, 'utf8')

  const text = new TextDecoder('shift_jis').decode(await readFile(path.join(csvDir, `honhyo_${year}.csv`)))
  const lines = text.split(/\r?\n/)
  const index = honhyoInsertColumnIndex(lines[0].split(','))
  const minCells = Math.max(...Object.values(index)) + 1
  const stage = createWriteStream(path.join(out, `stage-${year}.sql`), 'utf8')
  const stat = { rows: 0, staged: 0, skippedNoCoordinates: 0, skippedOther: 0, duplicateKeys: 0 }
  const seen = new Set<string>()
  const prefectures = new Set<number>()
  let batch: string[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    stat.rows += 1
    const cells = line.split(',')
    const converted = cells.length >= minCells ? honhyoRowToInsert(cells, year, index) : null
    if (!converted) {
      const hasKey = cells.length >= minCells && cells[index.recordType]?.trim() === '1'
      if (hasKey) stat.skippedNoCoordinates += 1
      else stat.skippedOther += 1
      continue
    }
    const { key, values } = converted
    const keyText = `${key.prefectureCode}/${key.policeStationCode}/${key.recordNumber}`
    if (seen.has(keyText)) {
      stat.duplicateKeys += 1
      continue
    }
    seen.add(keyText)
    prefectures.add(key.prefectureCode)
    batch.push(`(${[key.sourceYear, key.prefectureCode, key.policeStationCode, key.recordNumber]
      .map(sqlValue).concat(VALUE_COLUMNS.map(([field]) => sqlValue(values[field]))).join(',')})`)
    stat.staged += 1
    if (batch.length >= BATCH) {
      await write(stage, `INSERT INTO traffic_import VALUES ${batch.join(',')};\n`)
      batch = []
    }
  }
  if (batch.length) await write(stage, `INSERT INTO traffic_import VALUES ${batch.join(',')};\n`)
  stage.end()
  await once(stage, 'finish')

  const columnList = columns.join(', ')
  const chunks = [...prefectures].sort((a, b) => a - b).map((prefecture) =>
    `INSERT INTO traffic_accidents (${columnList}) SELECT ${columns.map((column) => `i.${column}`).join(', ')} `
    + `FROM traffic_import AS i WHERE i.source_year = ${year} AND i.prefecture_code = ${prefecture} `
    + 'AND NOT EXISTS (SELECT 1 FROM traffic_accidents AS t WHERE t.source_year = i.source_year '
    + 'AND t.lat BETWEEN i.lat - 0.0000001 AND i.lat + 0.0000001 '
    + 'AND t.prefecture_code = i.prefecture_code AND t.police_station_code = i.police_station_code '
    + 'AND t.record_number = i.record_number);')
  await writeFile(path.join(out, 'apply-chunks.txt'), chunks.join('\n') + '\n', 'utf8')
  await writeFile(path.join(out, 'cleanup.sql'), 'DROP TABLE IF EXISTS traffic_import;\n', 'utf8')
  console.log(JSON.stringify({ out, year, stat, prefectures: prefectures.size, chunks: chunks.length }, null, 2))
}

main().catch((error: unknown) => {
  console.error('[import-traffic-honhyo-year]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
