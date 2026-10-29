#!/usr/bin/env node
// 国土地理院の市区町村コード表(https://maps.gsi.go.jp/js/muni.js)から
// lib/geocoding/gsi-municipalities.json を作る。
// 逆ジオコーダ(LonLatToAddress)は muniCd しか返さないため、名前への変換に使う。
//
// 使い方: node scripts/generate-gsi-municipalities.mjs [muni.js のパス]
//   パス省略時は国土地理院から取得する。

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://maps.gsi.go.jp/js/muni.js'
const OUTPUT = fileURLToPath(new URL('../lib/geocoding/gsi-municipalities.json', import.meta.url))
const ENTRY = /GSI\.MUNI_ARRAY\["(\d+)"\]\s*=\s*'(\d+),([^,]+),(\d+),([^']+)'/g

async function loadSource(path) {
  if (path) return readFile(path, 'utf8')
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`muni.js の取得に失敗しました (${response.status})`)
  return response.text()
}

function parse(source) {
  const table = {}
  for (const [, key, , prefecture, , rawCity] of source.matchAll(ENTRY)) {
    // 政令市の区は「札幌市　中央区」と全角空白で区切られているので詰める
    const city = rawCity.replace(/[\s　]+/g, '')
    table[key.padStart(5, '0')] = [prefecture, city]
  }
  return table
}

const table = parse(await loadSource(process.argv[2]))
const count = Object.keys(table).length
if (count < 1_800) throw new Error(`市区町村が少なすぎます (${count} 件)。muni.js の形式が変わった可能性があります`)
const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(OUTPUT, `${JSON.stringify(sorted, null, 0)}\n`)
process.stdout.write(`${count} 件を書き出しました: ${OUTPUT}\n`)
