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

// 既にコピー済みならスキップ
if (fs.existsSync(path.join(wasmDest, 'vision_wasm_internal.wasm'))) {
  console.log('[copy-mediapipe] Already exists, skipping.')
  process.exit(0)
}

if (!fs.existsSync(wasmSrc)) {
  console.warn('[copy-mediapipe] @mediapipe/tasks-vision/wasm not found, skipping.')
  process.exit(0)
}

fs.mkdirSync(wasmDest, { recursive: true })
fs.cpSync(wasmSrc, wasmDest, { recursive: true })
console.log('[copy-mediapipe] Copied WASM assets to public/mediapipe/wasm.')
