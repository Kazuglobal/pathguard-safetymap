#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const srcBase = path.join(__dirname, '..', 'node_modules', 'cesium', 'Build', 'Cesium')
const destBase = path.join(__dirname, '..', 'public', 'cesium')

// 既にコピー済みならスキップ（毎回30秒待ちを防ぐ）
if (fs.existsSync(path.join(destBase, 'Workers'))) {
  console.log('[copy-cesium] Already exists, skipping.')
  process.exit(0)
}

fs.mkdirSync(destBase, { recursive: true })

for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
  console.log(`[copy-cesium] Copying ${dir}...`)
  fs.cpSync(path.join(srcBase, dir), path.join(destBase, dir), { recursive: true })
}
console.log('[copy-cesium] Done.')
