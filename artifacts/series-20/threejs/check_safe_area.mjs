// Reels の UI に隠れる範囲（上220px・下380px・右120px）に、見えている文字が入っていないかを測る。
//   node artifacts/series-20/threejs/check_safe_area.mjs --eps 21,22
//   node artifacts/series-20/threejs/check_safe_area.mjs --all
// 文字の範囲は Range で測る（中央ぞろえの箱の幅ではなく、文字そのものの幅）。不透明度 0.3 以上のものだけを見る。
// 柱の数字・名前（3Dに合わせて動く）は別に数え、終了コードには入れない。
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, createReadStream, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAFE = { top: 220, bottom: 1920 - 380, right: 1080 - 120, left: 0 }
const TIMES = [3, 6, 12, 17, 21.5, 23, 23.8, 24.2, 27, 32, 35]
const TITLES = ['#hud', '#badge', '#panelTitle']
const MAIN = ['#hud', '#badge', '#panelTitle', '#hook .l1', '#hook .hi', '#hook .l2', '#ratio .pre', '#ratio .num', '#cardL', '#cardR', '#cta', '#source', '#aiNote']
const BAR = ['.bar-label', '.bar-name']

const here = dirname(fileURLToPath(import.meta.url))
const seriesDir = resolve(here, '..')
const repoRoot = resolve(seriesDir, '..', '..')
const argv = process.argv.slice(2)
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def }
const episodes = JSON.parse(readFileSync(join(seriesDir, 'episodes.json'), 'utf8'))
const ids = argv.includes('--all') ? episodes.map((e) => e.id) : String(opt('eps', '21')).split(',').map((s) => s.trim().padStart(2, '0'))

const req = createRequire(join(repoRoot, 'package.json'))
const threeDir = process.env.THREE_DIR ? join(resolve(process.env.THREE_DIR), 'build') : dirname(req.resolve('three'))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg' }
const server = createServer((r, res) => {
  const url = decodeURIComponent(new URL(r.url, 'http://x').pathname)
  const [root, rel] = url.startsWith('/three/') ? [threeDir, url.slice('/three/'.length)] : [seriesDir, url.slice(1)]
  const file = resolve(root, rel)
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const { chromium } = createRequire(import.meta.url)('playwright')
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }))

// ページの中で動かす: 見えている文字の範囲を集める
function measure([selectors, safe]) {
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o }
  const stage = document.querySelector('#stage').getBoundingClientRect()
  const out = []
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.textContent.trim() || opacityOf(el) < 0.3) continue
      const isBox = el.classList.contains('card')
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = isBox ? el.getBoundingClientRect() : range.getBoundingClientRect()
      const box = { left: r.left - stage.left, right: r.right - stage.left, top: r.top - stage.top, bottom: r.bottom - stage.top }
      if (box.right <= 0 || box.left >= 1080 || box.bottom <= 0 || box.top >= 1920) continue // 画面の外（見えていない）
      const bad = []
      if (box.top < safe.top) bad.push(`上 ${Math.round(box.top)}px`)
      if (box.bottom > safe.bottom) bad.push(`下 ${Math.round(box.bottom)}px`)
      if (box.right > safe.right) bad.push(`右 ${Math.round(box.right)}px`)
      if (box.left < safe.left) bad.push(`左 ${Math.round(box.left)}px`)
      if (bad.length) out.push({ sel, text: el.textContent.trim().slice(0, 24), bad: bad.join(' ') })
    }
  }
  return out
}

// ページの中で動かす: 見えている柱の数字が、見えている見出し類（HUD・バッジ・パネル見出し）と重なっていないか
function overlaps(titles) {
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o }
  const textRect = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
  const visible = (el) => el.textContent.trim() && opacityOf(el) >= 0.3
  const heads = titles.flatMap((s) => [...document.querySelectorAll(s)]).filter(visible).map((el) => ({ el, r: textRect(el) }))
  const out = []
  const hit = (a, r) => a.left < r.right && r.left < a.right && a.top < r.bottom && r.top < a.bottom
  for (const label of document.querySelectorAll('.bar-label')) {
    if (!visible(label)) continue
    const a = label.getBoundingClientRect()
    for (const { el, r } of heads) {
      if (hit(a, r)) out.push({ text: label.textContent.trim().slice(0, 12), head: `#${el.id || el.className}` })
    }
  }
  // 柱の名前どうし（文字そのものの範囲）
  const names = [...document.querySelectorAll('.bar-name')].filter(visible).map((el) => ({ el, r: textRect(el) }))
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (hit(names[i].r, names[j].r)) out.push({ text: names[i].el.textContent.trim().slice(0, 12), head: `柱の名前「${names[j].el.textContent.trim().slice(0, 12)}」` })
    }
  }
  return out
}

let mainViolations = 0
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.error(`[EP${id}] page error:`, e.message))
    await page.goto(`${base}/threejs/index.html?ep=${id}&duration=36&static=1`)
    await page.evaluate(() => window.ready)
    const lines = []
    for (const t of TIMES) {
      await page.evaluate((tt) => window.renderAt(tt), t)
      for (const v of await page.evaluate(measure, [MAIN, SAFE])) { mainViolations++; lines.push(`  t=${t} ${v.sel}「${v.text}」 ${v.bad}`) }
      for (const v of await page.evaluate(measure, [BAR, SAFE])) lines.push(`  t=${t} （柱）${v.sel}「${v.text}」 ${v.bad}`)
      for (const v of await page.evaluate(overlaps, TITLES)) { mainViolations++; lines.push(`  t=${t} 柱の文字「${v.text}」が ${v.head} と重なる`) }
    }
    console.log(`EP${id}: ${lines.length ? `\n${lines.join('\n')}` : 'OK'}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.close()
}
console.log(`主要な文字のはみ出し: ${mainViolations}件`)
process.exitCode = mainViolations ? 1 : 0
