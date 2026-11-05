// 機能ツアーと紹介HPで使うステッカーの Lottie(After Effects と同じ形式)を作る。
// node scripts/make-lottie.mjs  →  public/lottie/*.json と ../../public/lottie/lp/*.json
// 見た目: 紙のステッカー(ink 3px 線・塗りはブランド色)。512x512・30fps・最後のフレームで止まる。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIRS = [join(HERE, '..', 'public', 'lottie'), join(HERE, '..', '..', '..', 'public', 'lottie', 'lp')]

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1)
const C = { ink: hex('#2B2723'), amber: hex('#E8A33D'), coral: hex('#E96D4F'), green: hex('#2FA36B'), water: hex('#5AA9E6'), paper: hex('#FFFDF8') }
// signature easing cubic-bezier(0.16, 1, 0.3, 1)
const EASE_OUT = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } }
const EASE_IO = { o: { x: [0.45], y: [0] }, i: { x: [0.55], y: [1] } }

const st = (v) => ({ a: 0, k: v })
const anim = (frames) => ({
  a: 1,
  k: frames.map(([t, s, ease = EASE_OUT], i) => (i === frames.length - 1 ? { t, s } : { t, s, o: ease.o, i: ease.i })),
})
const tr = (extra = {}) => ({ ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), ...extra })
const fill = (c) => ({ ty: 'fl', c: st(c), o: st(100), r: 1 })
const stroke = (w = 6) => ({ ty: 'st', c: st(C.ink), o: st(100), w: st(w), lc: 2, lj: 2 })
const group = (nm, it) => ({ ty: 'gr', nm, it: [...it, tr()] })
const path = (v, i, o, c = true) => ({ ty: 'sh', ks: st({ v, i, o, c }) })
const layer = (nm, op, ks, shapes) => ({
  ty: 4, nm, ip: 0, op, st: 0, ddd: 0, sr: 1,
  ks: { o: st(100), r: st(0), a: st([0, 0, 0]), s: st([100, 100, 100]), p: st([256, 256, 0]), ...ks },
  shapes,
})
const doc = (nm, op, layers) => ({ v: '5.7.0', fr: 30, ip: 0, op, w: 512, h: 512, nm, ddd: 0, assets: [], layers })

// 地図ピン(しずく形)。先端が (0, 0)、高さ 220
function pinShape(color) {
  const v = [[0, 0], [-78, -128], [0, -220], [78, -128]]
  const i = [[0, 0], [0, 40], [-50, 0], [0, -50]]
  const o = [[0, 0], [0, -50], [50, 0], [0, 40]]
  return [
    group('body', [path(v, i, o), fill(color), stroke(7)]),
    group('dot', [{ ty: 'el', p: st([0, -138]), s: st([62, 62]) }, fill(C.paper), stroke(6)]),
  ]
}

// 1) ピン: 上から落ちて 8% つぶれて戻る。影は落ちるほど小さく濃くなる
function pin() {
  const op = 45
  const shadow = layer('shadow', op, {
    p: st([256, 420, 0]),
    s: anim([[0, [40, 40, 100]], [14, [100, 100, 100]], [18, [112, 112, 100]], [24, [100, 100, 100]]]),
    o: anim([[0, 20], [14, 55]]),
  }, [group('ellipse', [{ ty: 'el', p: st([0, 0]), s: st([150, 34]) }, fill(C.ink)])])
  const body = layer('pin', op, {
    p: anim([[0, [256, -60, 0]], [14, [256, 420, 0]]]),
    // 着地で 8% つぶれ、3 フレームで戻す(主役だけ overshoot)
    s: anim([[0, [100, 100, 100]], [14, [100, 100, 100]], [17, [108, 92, 100]], [20, [97, 103, 100]], [23, [100, 100, 100]]]),
  }, pinShape(C.coral))
  return doc('pin-drop', op, [body, shadow])
}

// 2) 水面: 波線の水が下から想定の高さまで上がる(ease-in-out・30 フレーム)
function water() {
  const op = 50
  const W = 360
  const waveTop = (phase) => {
    const pts = []
    const n = 6
    for (let k = 0; k <= n; k++) pts.push([-W / 2 + (W / n) * k, (k % 2 === 0 ? -1 : 1) * 10 * phase])
    return pts
  }
  const mk = (phase) => {
    const top = waveTop(phase)
    const v = [...top, [W / 2, 170], [-W / 2, 170]]
    const i = v.map((_, k) => (k > 0 && k < top.length ? [-(W / 12), 0] : [0, 0]))
    const o = v.map((_, k) => (k < top.length - 1 ? [W / 12, 0] : [0, 0]))
    return { v, i, o, c: true }
  }
  const wave = { ty: 'sh', ks: { a: 1, k: [{ t: 0, s: [mk(1)], ...EASE_IO }, { t: 25, s: [mk(-1)], ...EASE_IO }, { t: 49, s: [mk(1)] }] } }
  const frame = layer('frame', op, {}, [group('box', [{ ty: 'rc', p: st([0, 0]), s: st([W + 24, 300]), r: st(36) }, fill(C.paper), stroke(7)])])
  const level = layer('water', op, {
    p: anim([[0, [256, 420, 0]], [30, [256, 300, 0], EASE_IO]]),
  }, [group('surface', [wave, fill(C.water), stroke(6)])])
  // 水は箱の中だけに見せる(マット)
  const matte = { ...layer('matte', op, {}, [group('box', [{ ty: 'rc', p: st([0, 0]), s: st([W + 10, 286]), r: st(30) }, fill(C.paper)])]), td: 1 }
  return doc('water-rise', op, [matte, { ...level, tt: 1 }, frame])
}

// 3) 星: 3 つが 3 フレームずつ遅れて出る(overshoot は使わない=主役を食わない)
function stars() {
  const op = 36
  const starPath = () => {
    const v = []
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 78 : 34
      const a = -Math.PI / 2 + (Math.PI / 5) * k
      v.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    return path(v, v.map(() => [0, 0]), v.map(() => [0, 0]))
  }
  const one = (x, delay, color) => layer(`star-${x}`, op, {
    p: st([256 + x, 256, 0]),
    s: anim([[delay, [0, 0, 100]], [delay + 9, [100, 100, 100]]]),
    r: anim([[delay, -25], [delay + 9, 0]]),
  }, [group('star', [starPath(), fill(color), stroke(7)])])
  return doc('stars-pop', op, [one(-150, 2, C.amber), one(0, 5, C.amber), one(150, 8, C.amber)])
}

const files = { 'pin-drop': pin(), 'water-rise': water(), 'stars-pop': stars() }
for (const dir of OUT_DIRS) {
  mkdirSync(dir, { recursive: true })
  for (const [name, json] of Object.entries(files)) {
    const text = JSON.stringify(json)
    writeFileSync(join(dir, `${name}.json`), text)
    console.log(join(dir, `${name}.json`), `${(text.length / 1024).toFixed(1)}KB`)
  }
}
