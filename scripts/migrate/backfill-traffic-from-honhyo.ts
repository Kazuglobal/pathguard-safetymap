/**
 * traffic_accidents を警察庁「本票」CSV で補正する SQL を作る（D1 には何も書かない。生成のみ）。
 *
 * Usage:
 *   pnpm tsx scripts/migrate/backfill-traffic-from-honhyo.ts --csv-dir=<dir with honhyo_YYYY.csv> --years=2020-2024 --out=<dir>
 * 出力（D1 の制約: 1文 100KB 以内・1文 30 秒以内 に合わせて分割）:
 *   stage-0-create.sql / stage-<year>.sql … 補正値を一時テーブル traffic_backfill に入れる（traffic_accidents は触らない）
 *   apply-index.sql  … 一時テーブルと traffic_accidents に照合キーの索引を張る
 *   apply-chunks.txt … 1行1文の UPDATE ... FROM（1年×1都道府県ずつ）。1文ずつ --command で流す
 *   cleanup.sql      … 一時テーブルと一時索引を消す
 * 本番へは stage → 件数確認 → index → chunks → 抜き取り確認 → cleanup の順に、人が確認しながら流す。
 * 実行前に wrangler d1 time-travel info で復元点を控える。--file 実行中は DB が一時的に応答しなくなる。
 * CSV は Shift_JIS。https://www.npa.go.jp/publications/statistics/koutsuu/opendata/<year>/honhyo_<year>.csv
 */
import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { once } from 'node:events'
import path from 'node:path'

import { honhyoColumnIndex, honhyoRowToBackfill, type HonhyoBackfillValues } from '../../lib/traffic-accident/honhyo'

const BATCH = 100 // keeps each INSERT well under D1's 100KB statement limit

const COLUMNS: Array<[keyof HonhyoBackfillValues, string]> = [
  ['accidentTypeLabel', 'accident_type_label'],
  ['involvesPedestrian', 'involves_pedestrian'],
  ['partyATypeCode', 'party_a_type_code'],
  ['partyATypeLabel', 'party_a_type_label'],
  ['partyBTypeCode', 'party_b_type_code'],
  ['partyBTypeLabel', 'party_b_type_label'],
  ['roadSurfaceCode', 'road_surface_code'],
  ['roadSurfaceLabel', 'road_surface_label'],
  ['roadShapeCode', 'road_shape_code'],
  ['roadShapeLabel', 'road_shape_label'],
  ['sidewalkCode', 'sidewalk_code'],
  ['sidewalkLabel', 'sidewalk_label'],
  ['terrainCode', 'terrain_code'],
  ['terrainLabel', 'terrain_label'],
  ['weatherLabel', 'weather_label'],
  ['signalCode', 'signal_code'],
  ['roadWidthCode', 'road_width_code'],
  ['zoneRegulationCode', 'zone_regulation_code'],
  ['injuryLevelA', 'injury_level_a'],
  ['injuryLevelB', 'injury_level_b'],
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

function yearRange(spec: string): number[] {
  const match = /^(\d{4})-(\d{4})$/.exec(spec)
  if (!match) throw new Error('--years must look like 2020-2024')
  const years: number[] = []
  for (let year = Number(match[1]); year <= Number(match[2]); year += 1) years.push(year)
  return years
}

async function main(): Promise<void> {
  const csvDir = argument('csv-dir')
  const out = argument('out')
  const years = yearRange(argument('years') ?? '2020-2024')
  if (!csvDir || !out) throw new Error('Use --csv-dir=<dir> --out=<dir> [--years=2020-2024]')
  await mkdir(out, { recursive: true })
  const { writeFile } = await import('node:fs/promises')

  const keyCols = 'source_year, prefecture_code, police_station_code, record_number'
  await writeFile(path.join(out, 'stage-0-create.sql'),
    `DROP TABLE IF EXISTS traffic_backfill;\nCREATE TABLE traffic_backfill (${keyCols}, ${COLUMNS.map(([, col]) => col).join(', ')});\n`, 'utf8')

  const decoder = new TextDecoder('shift_jis')
  const stats: Record<number, { rows: number; staged: number; skipped: number }> = {}
  const prefecturesByYear: Record<number, Set<number>> = {}
  for (const year of years) {
    const stage = createWriteStream(path.join(out, `stage-${year}.sql`), 'utf8')
    const text = decoder.decode(await readFile(path.join(csvDir, `honhyo_${year}.csv`)))
    const lines = text.split(/\r?\n/)
    const index = honhyoColumnIndex(lines[0].split(','))
    const minCells = Math.max(...Object.values(index)) + 1
    const stat = { rows: 0, staged: 0, skipped: 0 }
    const prefectures = new Set<number>()
    let batch: string[] = []
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      stat.rows += 1
      const cells = line.split(',')
      const converted = cells.length >= minCells ? honhyoRowToBackfill(cells, year, index) : null
      if (!converted) {
        stat.skipped += 1
        continue
      }
      const { key, values } = converted
      prefectures.add(key.prefectureCode)
      batch.push(`(${[key.sourceYear, key.prefectureCode, key.policeStationCode, key.recordNumber]
        .map(sqlValue).concat(COLUMNS.map(([field]) => sqlValue(values[field]))).join(',')})`)
      stat.staged += 1
      if (batch.length >= BATCH) {
        await write(stage, `INSERT INTO traffic_backfill VALUES ${batch.join(',')};\n`)
        batch = []
      }
    }
    if (batch.length) await write(stage, `INSERT INTO traffic_backfill VALUES ${batch.join(',')};\n`)
    stage.end()
    await once(stage, 'finish')
    stats[year] = stat
    prefecturesByYear[year] = prefectures
  }

  const sets = COLUMNS.map(([, col]) => `${col} = b.${col}`).join(', ')
  await writeFile(path.join(out, 'apply-index.sql'), [
    'CREATE INDEX IF NOT EXISTS idx_traffic_backfill_key ON traffic_backfill (source_year, prefecture_code, police_station_code, record_number);',
    'CREATE INDEX IF NOT EXISTS idx_traffic_accidents_record_key ON traffic_accidents (source_year, prefecture_code, police_station_code, record_number);',
    '',
  ].join('\n'), 'utf8')
  const chunks: string[] = []
  for (const year of years) {
    for (const prefecture of [...prefecturesByYear[year]].sort((a, b) => a - b)) {
      chunks.push(`UPDATE traffic_accidents SET ${sets} FROM traffic_backfill AS b WHERE b.source_year = ${year} AND b.prefecture_code = ${prefecture} AND traffic_accidents.source_year = b.source_year AND traffic_accidents.prefecture_code = b.prefecture_code AND traffic_accidents.police_station_code = b.police_station_code AND traffic_accidents.record_number = b.record_number;`)
    }
  }
  await writeFile(path.join(out, 'apply-chunks.txt'), chunks.join('\n') + '\n', 'utf8')
  await writeFile(path.join(out, 'cleanup.sql'),
    'DROP TABLE IF EXISTS traffic_backfill;\nDROP INDEX IF EXISTS idx_traffic_accidents_record_key;\n', 'utf8')
  console.log(JSON.stringify({ out, years, stats, chunks: chunks.length }, null, 2))
}

main().catch((error: unknown) => {
  console.error('[backfill-traffic-from-honhyo]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
