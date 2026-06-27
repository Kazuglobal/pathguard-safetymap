#!/usr/bin/env node
// MediaPipe Tasks Vision の WASM 資産を public/ へ self-host する。
// きけんハンターのオンデバイス顔検出 (mask-confirm.tsx) が外部 CDN に依存せず
// CSP('self') 内で完結するために必要 (設計書 §6.6)。
// モデル(.tflite)は node_modules に含まれないため public/mediapipe/models へ
// コミット済み (このスクリプトは WASM のみを node_modules から再生成する)。
const fs = require('fs')
const path = require('path')

const wasmSrc = path.join(
  __dirname,
  '..',
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
)
const wasmDest = path.join(__dirname, '..', 'public', 'mediapipe', 'wasm')

const requiredFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

if (!fs.existsSync(wasmSrc)) {
  console.error('[copy-mediapipe] @mediapipe/tasks-vision/wasm not found.')
  process.exit(1)
}

for (const file of requiredFiles) {
  const src = path.join(wasmSrc, file)
  if (!fs.existsSync(src)) {
    console.error(`[copy-mediapipe] Required WASM asset missing: ${file}`)
    process.exit(1)
  }
}

fs.rmSync(wasmDest, { recursive: true, force: true })
fs.mkdirSync(wasmDest, { recursive: true })

for (const file of requiredFiles) {
  fs.copyFileSync(path.join(wasmSrc, file), path.join(wasmDest, file))
}

for (const file of requiredFiles) {
  const dest = path.join(wasmDest, file)
  if (!fs.existsSync(dest)) {
    console.error(`[copy-mediapipe] Failed to copy required WASM asset: ${file}`)
    process.exit(1)
  }
}

console.log('[copy-mediapipe] Copied WASM assets to public/mediapipe/wasm.')
