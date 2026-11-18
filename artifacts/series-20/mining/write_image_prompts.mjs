// ep21-30_images.mjs から、Codex に渡すプロンプトと映像用の fx を images/prompts.json に書き出す。
// fx.glow が 'auto' なら、find_glows.py が写真から見つけた位置（images/glows.json）を入れる（まだ無ければ空）。
// 使い方: node write_image_prompts.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EPISODES } from './ep21-30_content.mjs'
import { IMAGES, ORIENT, composePrompt } from './ep21-30_images.mjs'

// 問いの写真（hook）は第1位を明かす前に全面に出るので、その回の伏せる語（spoilers）を含めない（2026-11-18 のレビュー・ユーザーの決定）
const problems = []
for (const content of EPISODES) {
  const hook = IMAGES[content.id]?.hook?.prompt ?? ''
  for (const word of content.spoilers ?? []) {
    if (hook.toUpperCase().includes(word.toUpperCase())) problems.push(`EP${content.id} の hook のプロンプトに伏せる語「${word}」がある`)
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const dir = fileURLToPath(new URL('../images/', import.meta.url))
mkdirSync(dir, { recursive: true })
const glowsFile = `${dir}glows.json`
const detected = existsSync(glowsFile) ? JSON.parse(readFileSync(glowsFile, 'utf8')) : {}

const episodes = {}
for (const [ep, items] of Object.entries(IMAGES)) {
  episodes[ep] = {}
  for (const key of Object.keys(items)) {
    let fx = items[key].fx ?? null
    if (fx && fx.glow === 'auto') fx = { ...fx, glow: detected[ep]?.[key] ?? [] }
    episodes[ep][key] = { orient: ORIENT[key], prompt: composePrompt(ep, key), fx }
  }
}
writeFileSync(`${dir}prompts.json`, `${JSON.stringify({ note: 'mining/ep21-30_images.mjs から生成。手で直さない', episodes }, null, 2)}\n`, 'utf8')
console.log(`書き出し: ${dir}prompts.json（${Object.keys(episodes).length}本・光の位置を見つけた回 ${Object.keys(detected).length}）`)
