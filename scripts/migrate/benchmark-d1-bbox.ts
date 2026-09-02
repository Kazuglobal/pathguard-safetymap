import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

type D1QueryResult = {
  success?: boolean
  results?: unknown[]
  meta?: { duration?: number; timings?: { sql_duration_ms?: number }; rows_read?: number }
  error?: string
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function numericArgument(name: string, fallback: number): number {
  const value = Number(argument(name) ?? fallback)
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a finite number`)
  return value
}

function integerArgument(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = numericArgument(name, fallback)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

function percentile(values: readonly number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)]
}

async function main() {
  const accountId = requiredEnvironment('CLOUDFLARE_ACCOUNT_ID')
  const databaseId = requiredEnvironment('D1_DATABASE_ID')
  const token = requiredEnvironment('D1_REST_API_TOKEN')
  const samples = integerArgument('samples', 20, 5, 100)
  const warmups = integerArgument('warmups', 3, 0, 20)
  const expectedRows = integerArgument('expected-rows', 10_000, 1, 10_000)
  const maximumP95Ms = numericArgument('max-p95-ms', 300)
  const minLng = numericArgument('min-lng', 139.55)
  const minLat = numericArgument('min-lat', 35.50)
  const maxLng = numericArgument('max-lng', 139.93)
  const maxLat = numericArgument('max-lat', 35.90)
  const minYear = integerArgument('min-year', 1900, 1900, 2200)
  const maxYear = integerArgument('max-year', 2200, 1900, 2200)
  if (minLng >= maxLng || minLat >= maxLat || minYear > maxYear) throw new Error('Invalid bbox or year range')
  if (maximumP95Ms <= 0) throw new Error('--max-p95-ms must be positive')

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`
  const sql = `SELECT id, source_year, lat, lng, severity_code, fatalities, injuries,
    accident_type_label, involves_child, involves_pedestrian, party_a_age, party_b_age,
    occurred_at, weather_label, road_shape_label, day_night_code
    FROM traffic_accidents
    WHERE lng >= ? AND lng <= ? AND lat >= ? AND lat <= ?
      AND source_year >= ? AND source_year <= ?
    LIMIT 10000`
  const params = [minLng, maxLng, minLat, maxLat, minYear, maxYear]

  const run = async (): Promise<{ durationMs: number; rows: number; rowsRead: number | null }> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(60_000),
    })
    const payload = await response.json() as {
      success?: boolean
      errors?: Array<{ message?: string }>
      result?: D1QueryResult[]
    }
    const result = payload.result?.[0]
    if (!response.ok || payload.success === false || result?.success === false) {
      const detail = payload.errors?.map((entry) => entry.message).filter(Boolean).join('; ') || result?.error
      throw new Error(`D1 benchmark query failed (${response.status})${detail ? `: ${detail}` : ''}`)
    }
    const durationMs = result?.meta?.timings?.sql_duration_ms ?? result?.meta?.duration
    if (!Number.isFinite(durationMs)) throw new Error('D1 response did not include SQL duration metadata')
    return {
      durationMs: Number(durationMs),
      rows: result?.results?.length ?? 0,
      rowsRead: result?.meta?.rows_read ?? null,
    }
  }

  for (let index = 0; index < warmups; index += 1) await run()
  const measurements = []
  for (let index = 0; index < samples; index += 1) measurements.push(await run())

  const durations = measurements.map((entry) => entry.durationMs)
  const minimumRows = Math.min(...measurements.map((entry) => entry.rows))
  const p95Ms = percentile(durations, 0.95)
  const receipt = {
    bbox: { minLng, minLat, maxLng, maxLat },
    years: { minYear, maxYear },
    warmups,
    samples,
    expectedRows,
    minimumRows,
    maximumP95Ms,
    p50Ms: percentile(durations, 0.5),
    p95Ms,
    maximumMs: Math.max(...durations),
    rowsRead: measurements.map((entry) => entry.rowsRead),
    measuredAt: new Date().toISOString(),
  }
  const receiptDirectory = path.resolve('artifacts/migration')
  await mkdir(receiptDirectory, { recursive: true })
  const receiptPath = path.join(receiptDirectory, 'd1-bbox-benchmark.json')
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2))

  if (minimumRows !== expectedRows) {
    throw new Error(`D1 bbox benchmark returned ${minimumRows} rows; expected ${expectedRows}. Adjust the bbox only if the production dataset cannot supply 10,000 rows.`)
  }
  if (p95Ms >= maximumP95Ms) {
    throw new Error(`D1 bbox SQL p95 ${p95Ms.toFixed(2)}ms does not meet the <${maximumP95Ms}ms cutover gate`)
  }
}

void main().catch((error) => {
  console.error('[benchmark-d1-bbox]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
