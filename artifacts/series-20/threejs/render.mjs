// Three.js 版の書き出し
//   node artifacts/series-20/threejs/render.mjs --eps 01,04          # mp4 を書き出す
//   node artifacts/series-20/threejs/render.mjs --eps 01 --stills    # 確認用の静止画だけ
//   node artifacts/series-20/threejs/render.mjs --all
// audio/epXX.wav があれば、その長さに合わせて伸び縮みさせ、音声を重ねる。なければ36秒・無音。
// フレームごとに renderAt(t) で時刻を指定して撮る（リアルタイム録画ではないので、PCが遅くてもコマ落ちしない）。
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, createReadStream, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const seriesDir = resolve(here, '..')
const repoRoot = resolve(seriesDir, '..', '..')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def }
const fps = Number(opt('fps', 30))
const outDir = resolve(opt('out', join(here, 'out')))
const STILL_TIMES = [0, 0.5, 3, 6, 12, 17, 21.5, 23, 27, 32, 35]

const episodes = JSON.parse(readFileSync(join(seriesDir, 'episodes.json'), 'utf8'))
const ids = flag('all') ? episodes.map((e) => e.id) : String(opt('eps', '01')).split(',').map((s) => s.trim().padStart(2, '0'))

// three の場所: リポジトリの node_modules、なければ THREE_DIR（three/build を含むフォルダ）
function threeBuildDir() {
  if (process.env.THREE_DIR) return join(resolve(process.env.THREE_DIR), 'build')
  const req = createRequire(join(repoRoot, 'package.json'))
  return dirname(req.resolve('three'))
}
const threeDir = threeBuildDir()

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav' }
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const [root, rel] = url.startsWith('/three/') ? [threeDir, url.slice('/three/'.length)] : [seriesDir, url.slice(1)]
  const file = resolve(root, rel)
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

// require を使う（グローバルに入れた playwright も NODE_PATH で見つけられるように）
const { chromium } = createRequire(import.meta.url)('playwright')
async function launch() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  if (!flag('bundled')) {
    try { return await chromium.launch({ channel: 'chrome', args }) } catch { /* システムの Chrome がなければ Playwright の Chromium */ }
  }
  return chromium.launch({ args })
}
const browser = await launch()
mkdirSync(outDir, { recursive: true })

function audioDuration(wav) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim()
  return Number(out)
}

try {
  for (const id of ids) {
    const ep = episodes.find((e) => e.id === id)
    if (!ep) { console.error(`skip: EP${id} は episodes.json にない`); continue }
    const wav = join(seriesDir, 'audio', `ep${id}.wav`)
    const hasAudio = existsSync(wav)
    const duration = Number(opt('duration', hasAudio ? audioDuration(wav) : 36))

    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.error(`[EP${id}] page error:`, e.message))
    await page.goto(`${base}/threejs/index.html?ep=${id}&duration=${duration}&static=1`)
    await page.evaluate(() => window.ready)
    const stage = page.locator('#stage')

    if (flag('stills')) {
      const dir = join(outDir, `ep${id}_stills`)
      mkdirSync(dir, { recursive: true })
      for (const t of STILL_TIMES.filter((s) => s <= duration)) {
        await page.evaluate((tt) => window.renderAt(tt), t)
        await stage.screenshot({ path: join(dir, `t${String(t).padStart(4, '0')}.png`) })
      }
      console.log(`EP${id}: stills -> ${dir}`)
      await page.close()
      continue
    }

    const out = join(outDir, `ep${id}_${ep.slug}_threejs${hasAudio ? '_final' : '_preview'}.mp4`)
    const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-']
    if (hasAudio) ffArgs.push('-i', wav, '-c:a', 'aac', '-b:a', '192k', '-shortest')
    ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out)
    const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] })
    const done = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exit ${c}`)))))

    const frames = Math.round(duration * fps)
    const started = Date.now()
    for (let f = 0; f < frames; f++) {
      await page.evaluate((tt) => window.renderAt(tt), f / fps)
      const buf = await stage.screenshot({ type: 'jpeg', quality: 92 })
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
      if (f % (fps * 5) === 0) process.stdout.write(`\rEP${id}: ${f}/${frames} frames`)
    }
    ff.stdin.end()
    await done
    console.log(`\rEP${id}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s -> ${out}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.close()
}
