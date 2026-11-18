// Three.js 版の書き出し
//   node artifacts/series-20/threejs/render.mjs --eps 01,04          # mp4 を書き出す
//   node artifacts/series-20/threejs/render.mjs --eps 01 --stills    # 確認用の静止画だけ
//   node artifacts/series-20/threejs/render.mjs --all
// audio/epXX.wav があれば: 声を 1.08 倍速・-14 LUFS にし、文の切れ目（無音）から映像の区切りを決めて（?marks=）
// 柱が数字を言う瞬間に伸びるように合わせ、BGM・効果音を混ぜて _final.mp4 にする。なければ36秒・無音の _preview。
// フレームごとに renderAt(t) で時刻を指定して撮る（リアルタイム録画ではないので、PCが遅くてもコマ落ちしない）。
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, createReadStream, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TAIL, detectSilences, marksFor, mixAudio, prepareNarration, probeDuration, soundEvents } from './audio.mjs'
import { orderMarks } from './timeline.mjs'

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

try {
  for (const id of ids) {
    const ep = episodes.find((e) => e.id === id)
    if (!ep) { console.error(`skip: EP${id} は episodes.json にない`); continue }
    const wav = join(seriesDir, 'audio', `ep${id}.wav`)
    const hasAudio = existsSync(wav) && !flag('no-audio')
    let duration = Number(opt('duration', 36))
    let marks = null
    let mix = null
    if (hasAudio) {
      const tmp = join(outDir, '_audio')
      mkdirSync(tmp, { recursive: true })
      const narr = join(tmp, `ep${id}_narr.wav`)
      prepareNarration(wav, narr)
      const speech = probeDuration(narr)
      duration = speech + TAIL // 声のあとに余白（締めと出典を読めるように）
      const silences = detectSilences(narr)
      const ordered = orderMarks(marksFor(ep, speech, silences)) // 区切りの見込みは声の長さで出す
      marks = ordered.marks
      mix = join(tmp, `ep${id}_mix.wav`)
      mixAudio(narr, duration, soundEvents(duration, marks), mix)
      console.log(`EP${id}: 声 ${speech.toFixed(2)}s＋余白 ${TAIL}s・無音 ${silences.length}か所・区切り ${JSON.stringify(marks)}`)
      if (ordered.dropped.length) console.warn(`EP${id}: 順番が合わず捨てた区切り: ${ordered.dropped.join(', ')}`)
    }

    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.error(`[EP${id}] page error:`, e.message))
    const marksParam = marks ? `&marks=${encodeURIComponent(JSON.stringify(marks))}` : ''
    await page.goto(`${base}/threejs/index.html?ep=${id}&duration=${duration}&static=1${marksParam}`)
    await page.evaluate(() => window.ready)
    const stage = page.locator('#stage')

    if (flag('stills')) {
      const dir = join(outDir, `ep${id}_stills`)
      mkdirSync(dir, { recursive: true })
      for (const t of STILL_TIMES.filter((s) => s <= duration)) {
        await page.evaluate((tt) => window.renderAt(tt), t)
        await stage.screenshot({ path: join(dir, `t${String(t).padStart(4, '0')}.png`) })
      }
      // 声に合わせたときは、各区切りの少し後も撮る（柱が数字を言う所で伸び始めているかを見る）
      for (const [key, t] of Object.entries(marks ?? {})) {
        await page.evaluate((tt) => window.renderAt(tt), Math.min(duration, t + 0.4))
        await stage.screenshot({ path: join(dir, `m_${key}.png`) })
      }
      console.log(`EP${id}: stills -> ${dir}`)
      await page.close()
      continue
    }

    const out = join(outDir, `ep${id}_${ep.slug}_threejs${hasAudio ? '_final' : '_preview'}.mp4`)
    const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-']
    if (hasAudio) ffArgs.push('-i', mix, '-c:a', 'aac', '-b:a', '192k', '-shortest')
    // 入力の JPEG はフルレンジ。-pix_fmt yuv420p だけだと yuvj420p（フルレンジ）のまま出るので、TV レンジに変換して yuv420p にする
    ffArgs.push('-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(fps), '-movflags', '+faststart', out)
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
