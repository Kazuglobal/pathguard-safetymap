// series-20 Three.js 縦動画テンプレート
// episodes.json の1件で1本を描く。renderAt(t) に秒を渡すと、その時刻の1フレームが決まる（乱数は種を固定）。
// 数字はすべて episodes.json から読む。ここに統計の数字を書かない。
import * as THREE from 'three'
import { assignPhoto, createPhotoLayer, loadPhotos, updatePhoto } from './photo.js'
import { BASE_TOTAL, HOOK_END, IMPACT, T, makeTimeMap, rateDigits } from './timeline.mjs'

export { rateDigits }

const W = 1080
const H = 1920
const H_MAX = 6.2 // barMax に当たる柱の高さ（ワールド単位）
const BAR_X = [-1.95, -0.65, 0.65, 1.95] // 左から 参考・第3位・第2位・第1位
const COLORS = { blue: 0x3d9bff, gold: 0xffc21a, red: 0xff3b3b, extreme: 0xff1f4f }

// ---------- 小道具 ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (b, start, dur) => clamp((b - start) / dur)
const mix = (a, b, p) => a + (b - a) * p
const easeOutCubic = (p) => 1 - (1 - p) ** 3
const easeInCubic = (p) => p ** 3
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)
const easeOutBack = (p) => { const c = 1.9; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2 }
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 倍率の表示。既存EPの note（例: 21.3倍・28倍）と同じく切り捨て。 */
export function formatRatio(rate, refRate) {
  if (!(refRate > 0)) return null
  const r = rate / refRate
  if (r >= 100) return String(Math.floor(r))
  const v = Math.floor(r * 10) / 10
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

const $ = (sel) => document.querySelector(sel)
const params = new URLSearchParams(location.search)
const epId = (params.get('ep') || '01').padStart(2, '0')
const total = Math.max(HOOK_END + 10, Number(params.get('duration')) || BASE_TOTAL)
// 声の区切り（render.mjs が声の無音から決めて ?marks= で渡す）。無ければフック3.5秒固定・残りを比例で伸ばす
const marks = (() => { try { return JSON.parse(params.get('marks') || 'null') } catch { return null } })()
const { toBase, fromBase } = makeTimeMap(total, marks)

// ---------- three.js の土台 ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H, false)
renderer.setClearColor(0x04060c)
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x04060c, 0.045)
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200)
scene.add(new THREE.AmbientLight(0x6070a0, 0.7))
const key = new THREE.DirectionalLight(0xffffff, 1.1)
key.position.set(3, 8, 6)
scene.add(key)

// 地面: 流れるグリッドと道路の中央線
const groundMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uOffset: { value: 0 }, uGlow: { value: 0.5 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    varying vec3 vW; uniform float uOffset; uniform float uGlow;
    float line(float c, float w){ float d = abs(fract(c) - 0.5); return smoothstep(w, 0.0, 0.5 - d); }
    void main(){
      vec2 p = vec2(vW.x, vW.z + uOffset);
      float g = max(line(p.x * 0.8, 0.03), line(p.y * 0.8, 0.03));
      float lane = smoothstep(0.07, 0.0, abs(abs(vW.x) - 3.2));
      float dash = smoothstep(0.06, 0.0, abs(vW.x)) * step(0.5, fract(p.y * 0.25));
      float fade = exp(-0.05 * length(vW.xz - vec2(0.0, 4.0)));
      vec3 col = vec3(0.15, 0.45, 1.0) * g * 0.55 + vec3(1.0, 0.75, 0.2) * (lane * 0.7 + dash * 0.5);
      gl_FragColor = vec4(col * (0.4 + uGlow), (g * 0.55 + lane + dash) * fade);
    }`,
})
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// 漂う光の粒
const rand = mulberry32(20231118)
const DUST = 1400
const dustBase = new Float32Array(DUST * 3)
for (let i = 0; i < DUST; i++) {
  dustBase[i * 3] = (rand() - 0.5) * 24
  dustBase[i * 3 + 1] = rand() * 14
  dustBase[i * 3 + 2] = -30 + rand() * 40
}
const dustGeo = new THREE.BufferGeometry()
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3))
const dustMat = new THREE.PointsMaterial({ color: 0x9cc8ff, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
scene.add(new THREE.Points(dustGeo, dustMat))

// スピードライン
const LINES = 140
const lineSeed = Array.from({ length: LINES }, () => [(rand() - 0.5) * 14, 0.2 + rand() * 9, rand() * 60, 0.6 + rand()])
const lineGeo = new THREE.BufferGeometry()
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINES * 6), 3))
const lineMat = new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
scene.add(new THREE.LineSegments(lineGeo, lineMat))

// 柱
function makePillar(color, x) {
  const geo = new THREE.BoxGeometry(0.85, 1, 0.85)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, transparent: true })
  const mesh = new THREE.Mesh(geo, mat)
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }))
  shell.scale.set(1.35, 1, 1.35)
  const light = new THREE.PointLight(color, 0, 6)
  const group = new THREE.Group()
  group.add(mesh, shell, light)
  group.position.x = x
  group.scale.y = 0.0001
  scene.add(group)
  return { group, mesh, shell, light, mat }
}

// 問いの段階で伸びかけて止まる半透明の柱
const ghost = new THREE.Mesh(
  (() => { const g = new THREE.BoxGeometry(0.85, 1, 0.85); g.translate(0, 0.5, 0); return g })(),
  new THREE.MeshBasicMaterial({ color: 0xff3b3b, wireframe: true, transparent: true, opacity: 0 }),
)
ghost.position.x = 0
ghost.position.z = -1.5
scene.add(ghost)

// 第1位の衝撃波の輪
const rings = [0, 0.16].map((delay) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0xff4060, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
  m.rotation.x = -Math.PI / 2
  m.position.set(BAR_X[3], 0.02, 0)
  scene.add(m)
  return { m, delay }
})

// 第1位の破裂の粒
const BURST = 420
const burstVel = Array.from({ length: BURST }, () => {
  const a = rand() * Math.PI * 2; const s = 1.5 + rand() * 4.5; const up = rand() * 5
  return [Math.cos(a) * s, up, Math.sin(a) * s * 0.6]
})
const burstGeo = new THREE.BufferGeometry()
burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST * 3), 3))
const burstMat = new THREE.PointsMaterial({ color: 0xff7a3d, size: 0.1, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
scene.add(new THREE.Points(burstGeo, burstMat))

// 締めで中央に集まる粒
const CTA_N = 700
const ctaStart = Array.from({ length: CTA_N }, () => {
  const u = rand() * 2 - 1; const a = rand() * Math.PI * 2; const r = 6 + rand() * 6
  return [Math.sqrt(1 - u * u) * Math.cos(a) * r, Math.sqrt(1 - u * u) * Math.sin(a) * r, u * r]
})
const ctaGeo = new THREE.BufferGeometry()
ctaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CTA_N * 3), 3))
const ctaMat = new THREE.PointsMaterial({ color: 0xffd36b, size: 0.08, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
// 締めの粒は、締めの写真の上に描くので別の場面に置く（霧は同じ）
const overlayScene = new THREE.Scene()
overlayScene.fog = scene.fog
overlayScene.add(new THREE.Points(ctaGeo, ctaMat))

// 写真の層（問い・締め）。写真が無い回（EP01〜20）は何も描かない
const hookPhoto = createPhotoLayer()
const ctaPhoto = createPhotoLayer()

// ---------- エピソードの読み込みと DOM ----------
let ep, bars, labelEls, refShort
function colorFor(w) {
  if (w.isExtreme) return COLORS.extreme
  if (w.isDanger) return COLORS.red
  if (w.isGold) return COLORS.gold
  return COLORS.red
}
function cssColor(hex) { return '#' + hex.toString(16).padStart(6, '0') }

function splitChars(el, text) {
  el.textContent = ''
  for (const ch of text) {
    const s = document.createElement('span')
    s.className = 'ch'
    s.textContent = ch
    el.appendChild(s)
  }
  return [...el.children]
}

async function load() {
  const res = await fetch('../episodes.json')
  const list = await res.json()
  ep = list.find((e) => e.id === epId)
  if (!ep) throw new Error(`episode ${epId} not found`)
  if (!Array.isArray(ep.worst) || ep.worst.length !== 3) throw new Error(`episode ${epId}: worst must have 3 entries`)

  refShort = ep.ref.label.replace(/^参考[:：]\s*/, '')
  // 左から 参考・第3位・第2位・第1位
  const order = [
    { rank: '参考', label: refShort, rate: ep.ref.rate, note: '', color: COLORS.blue, isRef: true },
    { ...ep.worst[2], color: colorFor(ep.worst[2]) },
    { ...ep.worst[1], color: colorFor(ep.worst[1]) },
    { ...ep.worst[0], color: colorFor(ep.worst[0]) },
  ]
  const start = [T.refStart, T.r3Start, T.r2Start, T.r1Start]
  const dur = [T.refGrow, T.grow, T.grow, T.r1Grow]
  bars = order.map((d, i) => ({
    ...d,
    start: start[i],
    dur: dur[i],
    height: Math.max(0.06, (d.rate / ep.barMax) * H_MAX),
    ratio: d.isRef ? null : formatRatio(d.rate, ep.ref.rate),
    ...makePillar(d.color, BAR_X[i]),
  }))

  $('#hud .file').textContent = `FILE #${ep.id} // ${ep.caseTitle}`
  $('#badge').textContent = ep.badge
  $('#panelTitle').textContent = ep.panelTitle
  $('#hook .l1').textContent = ep.hookLine1
  $('#hook .l2').textContent = ep.hookLine2
  hookChars = splitChars($('#hook .hi'), ep.hookHighlight)
  $('#cardL .t').textContent = ep.reasonLeft.title
  $('#cardL .b').textContent = ep.reasonLeft.body
  $('#cardR .t').textContent = ep.reasonRight.title
  $('#cardR .b').textContent = ep.reasonRight.body
  $('#cta').textContent = ep.ctaTitle
  const focus = focusRatio()
  ratioBar = focus
  const pre = $('#ratio .pre')
  pre.textContent = `${focus.bar.label}は${focus.base.isRef ? ' 参考の' : ''}`
  if (!focus.base.isRef) pre.append(document.createElement('br'), `${focus.base.label}の`) // 順位どうしの比は2行に
  $('#ratio .num').textContent = focus.ratio ? `約${focus.ratio}倍` : ''

  const layer = $('#labels')
  labelEls = bars.map((b) => {
    const rate = document.createElement('div')
    rate.className = 'bar-label'
    rate.innerHTML = `<div class="rate"></div>${b.ratio ? `<div class="mult">×${b.ratio}</div>` : ''}`
    rate.querySelector('.rate').style.color = cssColor(b.color)
    const name = document.createElement('div')
    name.className = 'bar-name'
    name.innerHTML = `<span class="rank"></span><span class="nm"></span><span class="note"></span>`
    name.querySelector('.rank').textContent = b.rank
    name.querySelector('.rank').style.color = cssColor(b.color)
    name.querySelector('.nm').textContent = b.label
    name.querySelector('.note').textContent = b.note || ''
    layer.append(rate, name)
    return { rate, name }
  })
  const q = document.createElement('div')
  q.className = 'bar-label'
  q.id = 'qmark'
  q.innerHTML = '<div class="rate" style="color:#ff5a6a;font-size:96px">？倍</div>'
  layer.append(q)

  // 写真（Codex で作ったイメージ）。理由カードの写真は2枚そろったときだけ出す
  const photos = await loadPhotos(epId)
  assignPhoto(hookPhoto, photos.hook, photos.fx.hook)
  assignPhoto(ctaPhoto, photos.cta, photos.fx.cta)
  if (photos.safe && photos.danger) {
    $('#cardL .ph img').src = photos.safe
    $('#cardR .ph img').src = photos.danger
    $('#reasons').classList.add('with-img')
  }

  await document.fonts.ready
  // 1行で出す文字は、Reels の右120px（と左右対称の余白）に入らない幅まで小さくする
  for (const sel of ['#panelTitle', '#ratio .pre', '#ratio .num']) fitWidth($(sel), SAFE_TEXT_WIDTH)
}

const SAFE_TEXT_WIDTH = W - 2 * 120
/** 文字の幅が maxWidth を超えるときだけ、文字の大きさを縮めて収める。幅は Range で文字そのものを測る。 */
function fitWidth(el, maxWidth) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const scale = $('#stage').getBoundingClientRect().width / W
  const width = range.getBoundingClientRect().width / scale
  if (width > maxWidth) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * (maxWidth / width)}px`
}
let hookChars = []
let ratioBar = null

/**
 * 大きく見せる倍率 { bar, base, ratio }（bar は base の ratio 倍）。
 * フックの「○倍」が、順位どうしの比（例: 第1位は第2位の2.2倍＝EP26 の「同じ年齢なのに」）とちょうど同じならそれ。
 * そうでなければ参考との比で、フックの倍率に一番近い柱（±20%以内）。フックに倍率がなければ第1位。
 */
function focusRatio(list = bars, hook = ep.hookHighlight + ep.hookLine1 + ep.hookLine2) {
  const ref = list[0]
  const top = { bar: list[3], base: ref, ratio: list[3].ratio }
  const m = /([0-9０-９]+(?:\.[0-9]+)?)倍/.exec(hook)
  if (!m) return top
  const said = m[1].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const n = Number(said)
  if (!list.slice(1).some((bar) => bar.ratio === said)) {
    for (const [i, j] of [[3, 2], [3, 1], [2, 1]]) {
      const ratio = formatRatio(list[i].rate, list[j].rate)
      if (ratio === said) return { bar: list[i], base: list[j], ratio }
    }
  }
  let best = top; let diff = Infinity
  for (const bar of list.slice(1)) {
    const d = Math.abs(bar.rate / ref.rate - n) / n
    if (d < diff) { diff = d; best = { bar, base: ref, ratio: bar.ratio } }
  }
  return diff <= 0.2 ? best : top
}

// ---------- カメラ ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z)
function barTop(i, b) { return bars[i].height * growth(i, b) }

// 第2位・第3位が第1位に近い回は柱が高く、数字のラベルが見出しや上のUIにかかる。
// その場面だけ、ラベルの付け根が画面の上から約540pxより下に来るまでカメラを後ろへ引く（収まる回は元の位置のまま）。
// baseIdxs を渡した場面では、柱の名前の付け根も上から1365pxより上（4行の名前でも下380pxに入らない）に収める。
// barMax を超えて「突き抜ける」演出の柱（EP01 の列車など）は上の条件から外す。
// 引くほど柱の間隔が詰まって名前どうしが重なるので、baseIdxs のある場面では注視点の高さも動かし、引く量が最小の組を選ぶ。
const LABEL_LIMIT_NDC = 0.43
const NAME_LIMIT_NDC = 1 - (2 * 1365) / H
const MAX_PULL = 4
const fitCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 200)
const fitVec = new THREE.Vector3()
const fitCache = new Map()
const pulledBack = (pos, tgt, k) => tgt.clone().add(pos.clone().sub(tgt).multiplyScalar(k))
/** その注視点で、条件を満たす最小の引き量（1 なら元の位置のまま）。満たせなければ MAX_PULL。 */
function minimalPull(pos, tgt, tops, baseIdxs) {
  const fits = (k) => {
    fitCam.position.copy(pulledBack(pos, tgt, k))
    fitCam.lookAt(tgt)
    fitCam.updateMatrixWorld()
    const top = Math.max(-Infinity, ...tops.map((i) => fitVec.set(BAR_X[i], bars[i].height + 0.12, 0).project(fitCam).y))
    const low = Math.min(Infinity, ...baseIdxs.map((i) => fitVec.set(BAR_X[i], 0, 0.9).project(fitCam).y))
    return top <= LABEL_LIMIT_NDC && low >= NAME_LIMIT_NDC
  }
  if (fits(1)) return 1
  if (!fits(MAX_PULL)) return MAX_PULL
  let lo = 1; let hi = MAX_PULL
  for (let n = 0; n < 30; n++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid }
  return hi
}
function framed(key, pos, tgt, idxs, baseIdxs = []) {
  if (fitCache.has(key)) return fitCache.get(key)
  const tops = idxs.filter((i) => bars[i].height <= H_MAX * 1.05)
  let best = { k: minimalPull(pos, tgt, tops, baseIdxs), tgt: tgt.clone() }
  if (baseIdxs.length && best.k > 1) {
    for (let dy = -1.5; dy <= 1.5001; dy += 0.05) {
      const t2 = tgt.clone(); t2.y += dy
      const k = minimalPull(pos, t2, tops, baseIdxs)
      if (k < best.k - 0.005) best = { k, tgt: t2 }
    }
  }
  const out = { pos: pulledBack(pos, best.tgt, best.k), tgt: best.tgt }
  fitCache.set(key, out)
  return out
}
// cameraAt が lerp で書き換えるので、毎回コピーを返す
const framedKey = (key, pos, tgt, idxs, baseIdxs) => ({
  pos: () => framed(key, pos, tgt, idxs, baseIdxs).pos.clone(),
  tgt: () => framed(key, pos, tgt, idxs, baseIdxs).tgt.clone(),
})

const camKeys = [
  { at: 0, dur: 0.01, pos: (b) => V(0, 0.9, 24 - 13 * easeOutCubic(clamp(b / HOOK_END))), tgt: () => V(0, 1.6, 0) },
  { at: T.refStart, dur: 1.0, ...framedKey('ref', V(-2.6, 1.1, 8.0), V(-1.4, 0.9, 0), [0], [0]) },
  { at: T.r3Start, dur: 1.0, ...framedKey('r3', V(-0.6, 1.9, 9.6), V(-0.2, 1.4, 0), [0, 1], [0, 1]) },
  { at: T.r2Start, dur: 1.0, ...framedKey('r2', V(1.0, 2.6, 12.2), V(0.2, 2.2, 0), [0, 1, 2], [0, 1, 2]) },
  { at: T.r1Start, dur: 0.7, pos: () => V(2.9, 0.25, 6.4), tgt: (b) => V(BAR_X[3], Math.max(1.2, barTop(3, b) * 0.9), 0) },
  // 全体の場面: 第1位の数字が見出しにかからず、柱の名前が下380px（Reels の UI）に入らないところまで引く
  { at: IMPACT + 0.15, dur: 1.1, ...framedKey('impact', V(0, 3.4, 13.0), V(0.2, 3.0, 0), [0, 1, 2, 3], [0, 1, 2, 3]) },
  { at: T.reasons, dur: 1.2, pos: (b) => { const a = 0.35 - (b - T.reasons) * 0.08; return V(Math.sin(a) * 12, 4.2, Math.cos(a) * 12) }, tgt: () => V(0, 2.4, 0) },
  { at: T.cta, dur: 1.2, pos: (b) => V(0, 6.5 + (b - T.cta) * 0.2, 9.5 - (b - T.cta) * 0.3), tgt: () => V(0, 2.8, 0) },
]
function cameraAt(b) {
  let i = 0
  while (i + 1 < camKeys.length && camKeys[i + 1].at <= b) i++
  const cur = camKeys[i]
  const prev = camKeys[Math.max(0, i - 1)]
  const p = easeInOutCubic(seg(b, cur.at, cur.dur))
  const pos = prev.pos(b).lerp(cur.pos(b), p)
  const tgt = prev.tgt(b).lerp(cur.tgt(b), p)
  // ゆっくり漂う動き
  pos.x += Math.sin(b * 0.7) * 0.12
  pos.y += Math.sin(b * 0.9 + 1) * 0.06
  // 揺れ（第1位の着地で大きく、第2位・第3位で小さく）
  let shake = 0
  if (b >= IMPACT) shake += 0.32 * Math.exp(-(b - IMPACT) * 3.5)
  for (const s of [T.r2Start + T.grow, T.r3Start + T.grow]) if (b >= s) shake += 0.07 * Math.exp(-(b - s) * 6)
  pos.x += Math.sin(b * 97) * shake
  pos.y += Math.sin(b * 73 + 2) * shake
  camera.position.copy(pos)
  camera.lookAt(tgt)
}

// ---------- 1フレームの計算 ----------
function growth(i, b) {
  const bar = bars[i]
  const p = seg(b, bar.start, bar.dur)
  return i === 3 ? easeOutBack(p) : easeOutCubic(p)
}
const proj = new THREE.Vector3()
function toScreen(x, y, z) {
  proj.set(x, y, z).project(camera)
  return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H, visible: proj.z < 1 }
}
function setOpacity(el, v) { el.style.opacity = String(clamp(v)) }

function renderAt(t) {
  const b = toBase(t)
  cameraAt(b)

  // 地面と背景
  groundMat.uniforms.uOffset.value = b * 1.4 + 26 * easeOutCubic(clamp(b / HOOK_END))
  groundMat.uniforms.uGlow.value = 0.5 + (b >= IMPACT ? 0.9 * Math.exp(-(b - IMPACT) * 2) : 0)
  const dp = dustGeo.attributes.position.array
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = dustBase[i * 3] + Math.sin(b * 0.3 + i) * 0.2
    dp[i * 3 + 1] = ((dustBase[i * 3 + 1] - b * 0.35) % 14 + 14) % 14
    dp[i * 3 + 2] = dustBase[i * 3 + 2]
  }
  dustGeo.attributes.position.needsUpdate = true

  // スピードライン（フック中と第1位の着地直後）
  const speed = b < HOOK_END ? 1 - easeInCubic(seg(b, 2.6, 0.9)) : 0
  const burstLines = b >= IMPACT ? Math.exp(-(b - IMPACT) * 5) : 0
  lineMat.opacity = Math.max(speed * 0.85, burstLines * 0.7)
  const lp = lineGeo.attributes.position.array
  for (let i = 0; i < LINES; i++) {
    const [x, y, z0, v] = lineSeed[i]
    const z = ((z0 + b * 38 * v) % 60) - 48
    lp.set([x, y, z, x, y, z + 2.2 * v], i * 6)
  }
  lineGeo.attributes.position.needsUpdate = true

  // 問いの柱（伸びかけて止まり、脈打つ）
  const gIn = seg(b, 0.55, 1.2)
  const gOut = 1 - seg(b, HOOK_END - 0.3, 0.4)
  ghost.scale.y = Math.max(0.0001, H_MAX * 0.42 * easeOutCubic(gIn))
  ghost.material.opacity = 0.75 * gIn * gOut * (0.7 + 0.3 * Math.sin(b * 12))

  // 柱
  const dim = 1 - 0.65 * seg(b, T.reasons, 0.6)
  bars.forEach((bar, i) => {
    const g = growth(i, b)
    bar.group.scale.y = Math.max(0.0001, bar.height * g)
    const born = b >= bar.start
    bar.mat.opacity = born ? dim : 0
    bar.shell.material.opacity = born ? 0.16 * dim * (1 + 0.5 * Math.sin(b * 6 + i)) : 0
    bar.light.position.y = bar.height * g + 0.3
    bar.light.intensity = born ? 2.2 * dim : 0
    bar.mat.emissiveIntensity = 0.55 + (i === 3 && b >= IMPACT ? 1.2 * Math.exp(-(b - IMPACT) * 2) : 0)
  })

  // 衝撃波と破裂
  for (const { m, delay } of rings) {
    const p = seg(b, IMPACT + delay, 1.0)
    m.scale.setScalar(0.5 + easeOutCubic(p) * 13)
    m.material.opacity = b >= IMPACT + delay && p < 1 ? 0.9 * (1 - p) : 0
  }
  const bt = b - IMPACT
  const bpArr = burstGeo.attributes.position.array
  const topY = bars[3].height
  for (let i = 0; i < BURST; i++) {
    const [vx, vy, vz] = burstVel[i]
    const tt = Math.max(0, bt)
    bpArr.set([BAR_X[3] + vx * tt * 0.6, topY + vy * tt - 3.2 * tt * tt, vz * tt * 0.6], i * 3)
  }
  burstGeo.attributes.position.needsUpdate = true
  burstMat.opacity = bt >= 0 ? 1 - seg(b, IMPACT, 2.0) : 0

  // 締めの粒
  const cp = seg(b, T.cta, 1.2)
  const cpo = ctaGeo.attributes.position.array
  for (let i = 0; i < CTA_N; i++) {
    const [sx, sy, sz] = ctaStart[i]
    const e = easeInCubic(cp)
    const after = Math.max(0, b - T.cta - 1.2)
    const spread = 1 + after * 0.6
    cpo.set([mix(sx, sx * 0.08 * spread, e), 3.2 + mix(sy, sy * 0.05 * spread, e), 2 + mix(sz, sz * 0.08 * spread, e)], i * 3)
  }
  ctaGeo.attributes.position.needsUpdate = true
  ctaMat.opacity = b >= T.cta ? 0.9 * (1 - 0.6 * seg(b, T.cta + 1.4, 2)) : 0

  renderer.render(scene, camera)
  // 写真の層を重ねる（問いは全面で始まり、フックの終わりで3Dへ溶ける。締めは暗く敷く）→ 締めの粒はその上
  renderer.autoClear = false
  // 寄りと光の近づきは、問いの写真が実際に出ている長さ（声に合わせると伸びる）で進める
  const hookOn = updatePhoto(hookPhoto, { opacity: 1 - seg(b, HOOK_END - 0.3, 0.6), local: t, span: fromBase(HOOK_END + 0.3), shade: 0.45, shadeY: 1 - 715 / H })
  if (hookOn) renderer.render(hookPhoto.scene, hookPhoto.camera)
  const ctaAt = fromBase(T.cta)
  const ctaOn = updatePhoto(ctaPhoto, { opacity: seg(b, T.cta, 1.0), local: Math.max(0, t - ctaAt), span: total - ctaAt, dark: 0.35, shade: 0.35, shadeY: 1 - 850 / H })
  if (ctaOn) renderer.render(ctaPhoto.scene, ctaPhoto.camera)
  renderer.render(overlayScene, camera)
  renderer.autoClear = true

  // ---------- DOM ----------
  const m = Math.floor(t / 60); const s = t - m * 60
  $('#hud .timer').textContent = `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
  setOpacity($('#badge'), seg(b, T.refStart, 0.4) * (1 - seg(b, T.reasons, 0.4)))
  setOpacity($('#panelTitle'), seg(b, T.refStart, 0.4) * (1 - seg(b, T.reasons, 0.4)))

  // フック: 1文字ずつ叩きつける
  const hookOut = seg(b, HOOK_END - 0.25, 0.4)
  const hook = $('#hook')
  setOpacity(hook, 1 - hookOut)
  hook.style.transform = `translateY(${-120 * easeInCubic(hookOut)}px)`
  const l1 = 0.6 + 0.4 * seg(b, 0, 0.15) // 1コマ目から文字を見せる
  setOpacity($('#hook .l1'), l1)
  $('#hook .l1').style.transform = `translateY(${30 * (1 - l1)}px)`
  hookChars.forEach((el, i) => {
    const at = i * 0.035
    const p = seg(b, at, 0.18)
    const sc = mix(2.6, 1, easeOutBack(p))
    el.style.opacity = String(b >= at ? 1 : 0)
    el.style.transform = `scale(${sc}) rotate(${(1 - p) * (i % 2 ? 8 : -8)}deg)`
  })
  const l2 = seg(b, 1.25, 0.25)
  setOpacity($('#hook .l2'), l2)
  $('#hook .l2').style.transform = `scale(${mix(1.4, 1, easeOutCubic(l2))})`

  // ？倍
  const q = $('#qmark')
  q.style.left = '540px'; q.style.top = '1260px' // フックの文字に隠れない位置に固定
  q.style.transform = `translate(-50%, -100%) scale(${1 + 0.08 * Math.sin(b * 12)})`
  setOpacity(q, gIn * gOut)

  // 柱のラベル
  const labelDim = (1 - 0.85 * seg(b, T.reasons, 0.5)) * (1 - seg(b, T.cta, 0.5))
  bars.forEach((bar, i) => {
    const { rate, name } = labelEls[i]
    const g = growth(i, b)
    const shown = seg(b, bar.start, 0.25) * labelDim
    const top = toScreen(BAR_X[i], bar.height * g + 0.12, 0)
    rate.style.left = `${top.x}px`; rate.style.top = `${top.y}px`
    rate.querySelector('.rate').textContent = `${(bar.rate * clamp(g)).toFixed(rateDigits(bar.rate))}%`
    const underRatio = 1 - 0.75 * seg(b, IMPACT, 0.3) * (1 - seg(b, T.ratioEnd - 0.4, 0.4))
    setOpacity(rate, top.visible ? shown * underRatio : 0)
    const mult = rate.querySelector('.mult')
    if (mult) setOpacity(mult, seg(b, bar.start + bar.dur, 0.2))
    const base = toScreen(BAR_X[i], 0, 0.9)
    name.style.left = `${base.x}px`; name.style.top = `${Math.min(base.y + 10, 1500)}px`
    setOpacity(name, base.visible ? shown : 0)
  })

  // 倍率の大きな文字
  const rIn = seg(b, IMPACT, 0.3)
  const ratio = $('#ratio')
  setOpacity(ratio, ratioBar.ratio ? rIn * (1 - seg(b, T.ratioEnd - 0.4, 0.4)) : 0)
  ratio.style.transform = `scale(${mix(3, 1, easeOutBack(rIn))})`

  // フラッシュ
  let flash = 0
  if (b >= IMPACT) flash += 0.75 * Math.exp(-(b - IMPACT) * 6)
  const r2End = T.r2Start + T.grow
  if (b >= r2End && bars[2].color !== COLORS.gold) flash += 0.22 * Math.exp(-(b - r2End) * 8)
  setOpacity($('#flash'), flash)

  // 理由カード: 左右から回転しながら飛び込む
  const out = seg(b, T.reasonsEnd - 0.5, 0.5)
  const cards = [[$('#cardL'), T.reasons + 0.2, -1], [$('#cardR'), T.reasons + 1.6, 1]]
  for (const [el, at, dir] of cards) {
    const p = easeOutBack(seg(b, at, 0.7))
    setOpacity(el, seg(b, at, 0.25) * (1 - out))
    el.style.transform = `translateX(${dir * 700 * (1 - p)}px) translateY(${-80 * easeInCubic(out)}px) rotateY(${dir * 80 * (1 - p)}deg)`
  }

  // 理由カードの写真: ゆっくり寄る
  document.querySelectorAll('#reasons .ph img').forEach((img, i) => {
    img.style.transform = `scale(${1.02 + 0.08 * seg(b, T.reasons + (i ? 1.6 : 0.2), T.reasonsEnd - T.reasons)})`
  })
  // 写真が出ている間は「AIで作ったイメージ」と出す
  const cardPhotos = $('#reasons').classList.contains('with-img') ? seg(b, T.reasons + 0.2, 0.25) * (1 - out) : 0
  setOpacity($('#aiNote'), Math.max(hookPhoto.uniforms.uOpacity.value, ctaPhoto.uniforms.uOpacity.value, cardPhotos))

  // 締めと出典
  const c = seg(b, T.cta + 1.0, 0.35)
  const cta = $('#cta')
  setOpacity(cta, c)
  cta.style.transform = `scale(${mix(1.8, 1, easeOutBack(c))})`
  cta.style.letterSpacing = `${mix(0.4, 0.02, easeOutCubic(c))}em`
  setOpacity($('#source'), seg(b, T.source, 0.5))
}

window.renderAt = renderAt
window.ready = load().then(() => { renderAt(0); return { total, id: ep.id, slug: ep.slug } })
// ブラウザで直接開いたときのプレビュー再生（書き出し時は ?static=1 で止める）
if (!params.has('static')) {
  window.ready.then(() => {
    const t0 = performance.now()
    const loop = () => { renderAt(((performance.now() - t0) / 1000) % total); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  })
}
