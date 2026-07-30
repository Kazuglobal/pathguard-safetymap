// 地図マーカーの当たり判定が「見えている形」に限定されているかを実ブラウザで検証する。
//
// 使い方:
//   node scripts/verify-marker-hit-area.mjs
//
// 背景: マーカーの箱(76x68 / クラスタは最大58x58)は可視ピンより大きく、
// 透明な余白が当たり判定を持つと、隣接ピンのタップを横取りして別のレポートが開く
// (誤ったユーザーへのポイント付与も起きる)。
//
// jsdom はヒットテストを再現できないためユニットテストでは検出できない。
// また **SVGルート要素は透明部分も含めて箱全体で当たり判定を取る**(Chrome実測)ため、
// ルートに pointer-events:auto を戻すと限定が無効化される。visiblePainted でも変わらない。
// 正しいのは「ルート=none / 内側の図形=auto」。この不変条件をここで実測確認する。
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSS = readFileSync(resolve(ROOT, "app/globals.css"), "utf-8")

// 対象クラスの規則だけを抜き出す(Tailwind の @layer 等は評価しない)。
// コメントの途中で切ると壊れた断片が残り、直後の規則ごとパーサに捨てられるため、
// 最初のセレクタの位置から末尾までを取る
const MARKER_CSS_START = CSS.indexOf(".danger-marker {")
if (MARKER_CSS_START < 0) {
  throw new Error("app/globals.css に .danger-marker の規則が見つかりません")
}
const MARKER_CSS = CSS.slice(MARKER_CSS_START)

const PAGE = `<!doctype html><html><head><style>
body { margin: 0; background: #fff; }
.stage { position: relative; width: 400px; height: 400px; }
.mapboxgl-marker { position: absolute; }
${MARKER_CSS}
</style></head><body>
<div class="stage">
  <!-- 実装(hooks/use-danger-markers.tsx)と同じDOM構造 -->
  <div class="mapboxgl-marker" style="left:100px; top:100px">
    <div class="danger-marker danger-level-3" id="pin">
      <span class="danger-pin-visual">
        <span class="danger-severity-halo"></span>
        <svg class="danger-pin-shape" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2.6">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <svg class="danger-pin-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>
      </span>
    </div>
  </div>
  <div class="mapboxgl-marker" style="left:100px; top:250px">
    <div class="danger-cluster-marker" id="cluster" style="--cluster-size:58px">
      <span class="danger-cluster-visual">
        <svg class="danger-cluster-pin" viewBox="0 0 24 24" fill="#FFFDF7" stroke="#333" stroke-width="2.2">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        </svg>
        <span class="danger-cluster-count">3</span>
      </span>
    </div>
  </div>
</div>
</body></html>`

const failures = []

function check(label, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? "OK  " : "FAIL"} ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage()
  await page.setContent(PAGE)

  // 対象要素の実際の矩形から、可視ピンの内側と、箱の透明な角を求める
  const geometry = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }
    }
    return { pin: rect("#pin"), shape: rect(".danger-pin-shape"), cluster: rect("#cluster") }
  })

  const owner = (x, y) =>
    page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.closest("[id]")?.id ?? "none",
      [x, y]
    )

  // 1. 個別ピン: 箱の左上角(可視ピンの外)は当たり判定を持たないこと
  check(
    "個別ピン: 箱の左上角は透過する",
    await owner(geometry.pin.left + 3, geometry.pin.top + 3),
    "none"
  )

  // 2. 個別ピン: ピン本体の中心付近は反応すること
  check(
    "個別ピン: ピン本体は反応する",
    await owner(
      geometry.shape.left + geometry.shape.w / 2,
      geometry.shape.top + geometry.shape.h * 0.35
    ),
    "pin"
  )

  // 3. 個別ピン: 可視ピンの箱の中でも、ティアドロップの外(左下の角)は透過すること
  check(
    "個別ピン: 可視ピン矩形内でも形状外は透過する",
    await owner(geometry.shape.left + 2, geometry.shape.bottom - 2),
    "none"
  )

  // 4. クラスタ: 箱の左上角は透過すること(ピンSVGが inset:0 で箱全体を覆っている)
  check(
    "クラスタ: 箱の左上角は透過する",
    await owner(geometry.cluster.left + 2, geometry.cluster.top + 2),
    "none"
  )

  // 5. クラスタ: ピン本体は反応すること
  check(
    "クラスタ: ピン本体は反応する",
    await owner(
      geometry.cluster.left + geometry.cluster.w / 2,
      geometry.cluster.top + geometry.cluster.h * 0.4
    ),
    "cluster"
  )
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(`\n${failures.length} 件の不変条件が壊れています`)
  process.exitCode = 1
} else {
  console.log("\nすべての当たり判定の不変条件を満たしています")
}
