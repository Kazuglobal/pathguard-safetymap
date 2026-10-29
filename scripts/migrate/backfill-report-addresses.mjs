#!/usr/bin/env node
// 都道府県が空の危険報告に、国土地理院の逆ジオコーダで住所を補う UPDATE 文を作る。
// 本番DBへは書き込まない。出力した SQL を確認してから wrangler で適用する。
//
// 1. 対象の取得(読み取りのみ):
//    npx wrangler d1 execute pathguardian --remote --json --command
//      "SELECT id, latitude, longitude FROM danger_reports WHERE prefecture IS NULL OR prefecture = ''"
//      > reports.json
// 2. SQL の生成: node scripts/migrate/backfill-report-addresses.mjs reports.json backfill.sql
// 3. 適用(要承認): npx wrangler d1 execute pathguardian --remote --file backfill.sql
//
// status / updated_at は書き換えない(ポイント付与・AI評価の UPDATE トリガーを起こさないため)。
// WHERE に「都道府県が空」を残すので、二度流しても既に入った住所は上書きしない。

import { readFile, writeFile } from 'node:fs/promises'

const GSI_URL = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'
// lib/geocoding/gsi-reverse-geocode.ts と同じく約100mに丸めて送る
const round = (value) => Math.round(value * 1_000) / 1_000
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  throw new Error('使い方: node scripts/migrate/backfill-report-addresses.mjs <reports.json> <out.sql>')
}

const municipalities = JSON.parse(
  await readFile(new URL('../../lib/geocoding/gsi-municipalities.json', import.meta.url), 'utf8'),
)
const parsed = JSON.parse(await readFile(inputPath, 'utf8'))
const rows = Array.isArray(parsed) ? parsed.flatMap((part) => part.results ?? []) : parsed.results ?? []

async function lookup(latitude, longitude) {
  const params = new URLSearchParams({ lat: String(round(latitude)), lon: String(round(longitude)) })
  const response = await fetch(`${GSI_URL}?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`GSI ${response.status}`)
  const code = (await response.json())?.results?.muniCd
  if (typeof code !== 'string') return null
  const municipalityCode = code.padStart(5, '0')
  const entry = municipalities[municipalityCode]
  return entry ? { prefecture: entry[0], city: entry[1], municipalityCode } : null
}

const geocodedAt = new Date().toISOString()
const statements = []
const unresolved = []
for (const row of rows) {
  const address = await lookup(Number(row.latitude), Number(row.longitude))
  if (!address) {
    unresolved.push(row.id)
    continue
  }
  process.stdout.write(`${row.id}  ${address.prefecture} ${address.city} (${address.municipalityCode})\n`)
  statements.push(
    `UPDATE danger_reports SET prefecture = ${sqlString(address.prefecture)}, `
    + `prefecture_code = ${Number(address.municipalityCode.slice(0, 2))}, `
    + `city = ${sqlString(address.city)}, municipality_code = ${sqlString(address.municipalityCode)}, `
    + `geocode_source = 'batch', geocoded_at = ${sqlString(geocodedAt)} `
    + `WHERE id = ${sqlString(row.id)} AND (prefecture IS NULL OR prefecture = '');`,
  )
  // 国土地理院のサービスに負荷をかけないよう間隔を空ける
  await new Promise((resolve) => setTimeout(resolve, 200))
}

await writeFile(outputPath, `${statements.join('\n')}\n`)
process.stdout.write(`\n${rows.length} 件中 ${statements.length} 件の UPDATE を書き出しました: ${outputPath}\n`)
if (unresolved.length) process.stdout.write(`住所を特定できなかった報告: ${unresolved.join(', ')}\n`)
