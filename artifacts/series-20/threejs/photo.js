// 写真（Codex で作ったイメージ）の層。
// 全面の写真（問い・締め）を WebGL の板に貼り、時刻だけで決まる光と天気の動きを重ねる:
//   ゆっくり寄る・手持ちの揺れ / 雨の筋 / 光のにじみ（ヘッドライト・街灯）/ 濡れた路面の照り返し / 粒子・周辺減光・色ずれ
// 乱数は座標と時刻から作るので、renderAt(t) で1コマずつ撮っても同じ絵になる（ちらつかない）。
// 写真は images/epXX/{hook,safe,danger,cta}.jpg、効き目（fx）は images/prompts.json。どちらも無ければ何も描かない。
import * as THREE from 'three'

const MAX_GLOW = 4

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uOpacity, uTime, uZoom, uDark, uShade, uShadeY, uRain, uWet, uGrow, uApproach;
uniform vec2 uShift;
uniform vec3 uGlow[${MAX_GLOW}];
uniform int uGlowN;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  // 画像の座標（GL なので下が 0）。寄りと揺れは写真だけに効かせる
  vec2 uv = (vUv - 0.5) / uZoom + 0.5 + uShift;
  vec2 ca = (uv - 0.5) * 0.0022;
  vec3 col = vec3(texture2D(uTex, uv + ca).r, texture2D(uTex, uv).g, texture2D(uTex, uv - ca).b);

  // 濡れた路面: 写真の下側の明るい所（映り込み）を、流れる雑音で少しゆらがせる
  float low = smoothstep(0.55, 0.0, uv.y);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float shimmer = noise(vec2(uv.x * 55.0, uv.y * 8.0 - uTime * 1.1));
  col += col * uWet * low * smoothstep(0.22, 0.7, lum) * (shimmer - 0.35) * 0.7;

  // 光のにじみ: 写真の光の位置に、ゆっくり明滅し、少しずつ近づく（大きくなる）光
  for (int i = 0; i < ${MAX_GLOW}; i++) {
    if (i >= uGlowN) break;
    vec2 gp = vec2(uGlow[i].x, 1.0 - uGlow[i].y);
    vec2 d = (uv - gp) * vec2(1080.0 / 1920.0, 1.0);
    // approach の回は、光が近づいてくるように大きく広がる
    float r = uGlow[i].z * (1.0 + 0.10 * sin(uTime * 1.9 + float(i) * 1.7) + (0.25 + 0.55 * uApproach) * uGrow);
    float dd = dot(d, d);
    float core = exp(-dd / (r * r));
    float halo = exp(-dd / (r * r * 10.0));
    float streak = exp(-abs(d.y) / (r * 0.10)) * exp(-abs(d.x) / (r * 5.0));
    // 写真の光はもともと明るいので、足すのは控えめに（白く飛ばさない）
    col += vec3(1.0, 0.87, 0.64) * (0.20 * core + 0.07 * halo + 0.12 * streak);
  }

  // 雨の筋（大小2層。画面に対して流す）
  for (int L = 0; L < 2; L++) {
    float s = L == 0 ? 1.0 : 1.8;
    vec2 p = vUv * vec2(64.0 * s, 8.0 * s);
    p.y += uTime * (4.5 + 3.5 * float(L));
    p.x += p.y * 0.07;
    vec2 cell = floor(p); vec2 f = fract(p);
    float h = hash(cell + float(L) * 19.0);
    float line = step(0.92, h) * smoothstep(0.09, 0.0, abs(f.x - 0.5)) * smoothstep(0.0, 0.45, f.y) * smoothstep(1.0, 0.55, f.y);
    col += vec3(0.78, 0.82, 0.9) * line * uRain * (L == 0 ? 0.17 : 0.10);
  }

  // 文字が乗る帯を少し暗く（読みやすさ）、周辺減光、粒子、全体の暗さ
  float sy = (vUv.y - uShadeY) / 0.13; // pow(負, 2.0) は GLSL では未定義なので掛け算にする
  col *= 1.0 - uShade * exp(-sy * sy);
  col *= 1.0 - 0.36 * pow(length(vUv - 0.5) * 1.25, 2.0);
  col += (hash(floor(vUv * vec2(540.0, 960.0)) + floor(uTime * 30.0)) - 0.5) * 0.045;
  col *= 1.0 - uDark;
  gl_FragColor = vec4(col, uOpacity);
}
`

/** 全面の写真の層を1つ作る（問い用・締め用で1つずつ）。 */
export function createPhotoLayer() {
  const uniforms = {
    uTex: { value: null }, uOpacity: { value: 0 }, uTime: { value: 0 }, uZoom: { value: 1 }, uDark: { value: 0 },
    uShade: { value: 0 }, uShadeY: { value: 0.6 }, uRain: { value: 0 }, uWet: { value: 0 }, uGrow: { value: 0 },
    uShift: { value: new THREE.Vector2() }, uApproach: { value: 0 },
    uGlow: { value: Array.from({ length: MAX_GLOW }, () => new THREE.Vector3()) }, uGlowN: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false })
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
  return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), uniforms, tex: null }
}

/** 写真と fx を層に入れる。fx: { rain, wet, glow: [{x, y, r}] }（座標は画面の 0〜1、左上が原点）。 */
export function assignPhoto(layer, tex, fx) {
  layer.tex = tex
  const u = layer.uniforms
  u.uTex.value = tex
  u.uRain.value = fx?.rain ? 1 : 0
  u.uWet.value = fx?.wet ? 1 : 0
  u.uApproach.value = fx?.approach ? 1 : 0
  const glow = (fx?.glow ?? []).slice(0, MAX_GLOW)
  glow.forEach((g, i) => u.uGlow.value[i].set(g.x, g.y, g.r))
  u.uGlowN.value = glow.length
}

/**
 * その時刻の見え方を決める。
 * local: この写真が出てからの秒 / span: 写真が出ている長さ（寄りと光の近づきの進み具合に使う）
 */
export function updatePhoto(layer, { opacity, local, span, dark = 0, shade = 0, shadeY = 0.6 }) {
  const u = layer.uniforms
  const p = Math.min(1, Math.max(0, local / Math.max(0.1, span)))
  u.uOpacity.value = layer.tex ? opacity : 0
  u.uTime.value = local
  u.uGrow.value = p
  const near = u.uApproach.value // 迫る回は寄りを強め、手持ちの揺れも少し大きく
  u.uZoom.value = 1.04 + (0.08 + 0.06 * near) * p
  const shake = 1 + 0.6 * near
  u.uShift.value.set(Math.sin(local * 0.9) * 0.0022 * shake, Math.cos(local * 0.73 + 1) * 0.0016 * shake)
  u.uDark.value = dark
  u.uShade.value = shade
  u.uShadeY.value = shadeY
  return u.uOpacity.value > 0.001
}

/** images/prompts.json の fx と写真を読む。見つからない物は null（EP01〜20 は全部 null）。 */
export async function loadPhotos(epId) {
  const base = `../images/ep${epId}`
  const info = await fetch('../images/prompts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  const fx = info?.episodes?.[String(Number(epId))] ?? {}
  const loader = new THREE.TextureLoader()
  const texture = async (key) => {
    const tex = await loader.loadAsync(`${base}/${key}.jpg`).catch(() => null)
    if (tex) { tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter }
    return tex
  }
  const image = async (key) => {
    const img = new Image()
    img.src = `${base}/${key}.jpg`
    return img.decode().then(() => img.src).catch(() => null)
  }
  const [hook, cta, safe, danger] = await Promise.all([texture('hook'), texture('cta'), image('safe'), image('danger')])
  return { hook, cta, safe, danger, fx: { hook: fx.hook?.fx ?? null, cta: fx.cta?.fx ?? null } }
}
