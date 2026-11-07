// =============================================
// きけんハンター 当たり枠 (純粋ロジック)
// 表示用の枠(region)とは別に、採点だけに使う小さい当たり枠(hitRegion)を作る。
//  - AI が示した「いちばん見るべき 1 点」(focus)を中心に、region の内側へ置く。
//  - 1 辺は指の太さ(MIN_HIT_SIDE)以上、面積は MAX_HIT_AREA 以下。
//  - 全部の当たり枠に指先補正を足した和集合を、写真の MAX_HIT_COVERAGE 以下に収める
//    (= 適当なタップ 1 回が当たる確率の上限)。超えたら focus へ向けて縮める。
// React/IO/副作用なし。イミュータブル。
// =============================================

import type { HunterHazard, HunterPoint, HunterRegion } from "@/lib/hunter/types"
import { SPATIAL_TAP_MARGIN } from "@/lib/hunter/spatial-hit"

/** 当たり枠の最小辺(低学年の指先 1 本ぶん)。 */
export const MIN_HIT_SIDE = 0.12
/** 当たり枠 1 つの面積上限(指先補正を足す前)。 */
export const MAX_HIT_AREA = 0.05
/** 指先補正込みの当たり枠の和集合が、写真に占める割合の上限。 */
export const MAX_HIT_COVERAGE = 0.25
/** 上限を超えたときに 1 回で縮める倍率。 */
const SHRINK_STEP = 0.9
/** 縮める回数の上限(最小サイズの 5 個でも上限内なので、実際はこれより早く収まる)。 */
const MAX_FIT_PASSES = 30

/**
 * 当たり枠の作り方。
 * - 危険(たんけん)は「状況のある場所」なので、focus のまわりの小さい枠だけを当たりにする。
 * - 安全の工夫(あんぜん さがし)は「物」なので、細長い物(ガードレール・横断歩道)は
 *   長い辺を残した帯にする(物のどこを押しても当たる)。四角に近い物は面積の上限で縮める。
 * どちらも、和集合の上限(MAX_HIT_COVERAGE)は同じ。
 */
export interface HitZoneProfile {
  readonly maxArea: number
  /** 細長い物を帯にする条件と帯の太さ。null なら帯にしない。 */
  readonly band: { readonly minAspect: number; readonly maxThickness: number } | null
}

export const DANGER_HIT_PROFILE: HitZoneProfile = { maxArea: MAX_HIT_AREA, band: null }
export const SAFE_HIT_PROFILE: HitZoneProfile = {
  maxArea: 0.08,
  band: { minAspect: 2.5, maxThickness: 0.16 },
}

export interface HitZoneInput {
  /** 表示用の枠(単位矩形の内側)。 */
  readonly region: HunterRegion
  /** AI の focus。無い・枠の外のときは枠の中へ寄せる。 */
  readonly focus?: HunterPoint | null
}

export interface HitZone {
  readonly hitRegion: HunterRegion
  readonly focusPoint: HunterPoint
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.min(Math.max(v, min), max)
}

function centerOf(region: HunterRegion): HunterPoint {
  return { x: region.x + region.w / 2, y: region.y + region.h / 2 }
}

/** focus を枠の中へ寄せる。無ければ枠の中心。 */
export function clampFocus(region: HunterRegion, focus?: HunterPoint | null): HunterPoint {
  if (!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.y)) return centerOf(region)
  return {
    x: clamp(focus.x, region.x, region.x + region.w),
    y: clamp(focus.y, region.y, region.y + region.h),
  }
}

/** 幅 w・高さ h の枠を anchor 中心に置き、bounds の内側へ収める。 */
function placeWithin(bounds: HunterRegion, anchor: HunterPoint, w: number, h: number): HunterRegion {
  const width = Math.min(w, bounds.w)
  const height = Math.min(h, bounds.h)
  // 余りを先に引く(同じ大きさのとき上限がちょうど bounds.x になり、浮動小数の誤差で外へ出ない)。
  return {
    x: clamp(anchor.x - width / 2, bounds.x, bounds.x + (bounds.w - width)),
    y: clamp(anchor.y - height / 2, bounds.y, bounds.y + (bounds.h - height)),
    w: width,
    h: height,
  }
}

/** 縦横比を保って面積を maxArea 以下へ。ただし各辺は minSide(枠より大きくはしない)を下回らない。 */
function fitSize(region: HunterRegion, maxArea: number, minSide: number): { w: number; h: number } {
  const minW = Math.min(minSide, region.w)
  const minH = Math.min(minSide, region.h)
  const area = region.w * region.h
  if (area <= maxArea) return { w: region.w, h: region.h }
  const scale = Math.sqrt(maxArea / area)
  let w = Math.max(minW, region.w * scale)
  let h = Math.max(minH, region.h * scale)
  // 片方の辺が最小で止まったぶん、もう片方を縮めて面積を合わせる。
  if (w * h > maxArea) {
    if (w <= minW) h = Math.max(minH, maxArea / w)
    else w = Math.max(minW, maxArea / h)
  }
  return { w, h }
}

/** 細長い枠なら、長い辺を残して短い辺だけを帯の太さにする。細長くなければ null。 */
function bandSize(region: HunterRegion, profile: HitZoneProfile): { w: number; h: number } | null {
  const band = profile.band
  if (!band) return null
  const long = Math.max(region.w, region.h)
  const short = Math.min(region.w, region.h)
  if (short <= 0 || long / short < band.minAspect) return null
  const thickness = Math.min(short, Math.max(MIN_HIT_SIDE, Math.min(short, band.maxThickness)))
  return region.w >= region.h ? { w: region.w, h: thickness } : { w: thickness, h: region.h }
}

/** 1 つの当たり枠を作る(和集合の上限はまだ見ない)。 */
export function deriveHitRegion(
  region: HunterRegion,
  focus?: HunterPoint | null,
  profile: HitZoneProfile = DANGER_HIT_PROFILE,
): HitZone {
  const focusPoint = clampFocus(region, focus)
  const size = bandSize(region, profile) ?? fitSize(region, profile.maxArea, MIN_HIT_SIDE)
  return { hitRegion: placeWithin(region, focusPoint, size.w, size.h), focusPoint }
}

/** 枠を margin だけ広げて単位矩形で切る。 */
function expandClip(region: HunterRegion, margin: number): [number, number, number, number] {
  return [
    Math.max(0, region.x - margin),
    Math.max(0, region.y - margin),
    Math.min(1, region.x + region.w + margin),
    Math.min(1, region.y + region.h + margin),
  ]
}

/**
 * 枠に margin を足した和集合の面積(単位矩形の中だけ)。座標圧縮で正確に数える。
 * = 写真の上を一様にタップしたとき、どれかに当たる確率。
 */
export function effectiveCoverage(
  regions: readonly HunterRegion[],
  margin: number = SPATIAL_TAP_MARGIN,
): number {
  const rects = regions.map((r) => expandClip(r, margin)).filter(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0)
  if (rects.length === 0) return 0
  const xs = [...new Set(rects.flatMap(([x0, , x1]) => [x0, x1]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap(([, y0, , y1]) => [y0, y1]))].sort((a, b) => a - b)
  let area = 0
  for (let i = 0; i < xs.length - 1; i += 1) {
    const cx = (xs[i] + xs[i + 1]) / 2
    for (let j = 0; j < ys.length - 1; j += 1) {
      const cy = (ys[j] + ys[j + 1]) / 2
      const covered = rects.some(([x0, y0, x1, y1]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1)
      if (covered) area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
    }
  }
  return area
}

/** 当たり枠を focus へ向けて SHRINK_STEP だけ縮める(最小辺は守る)。 */
function shrinkToward(zone: HitZone, bounds: HunterRegion): HitZone {
  const r = zone.hitRegion
  const w = Math.max(Math.min(MIN_HIT_SIDE, bounds.w), r.w * SHRINK_STEP)
  const h = Math.max(Math.min(MIN_HIT_SIDE, bounds.h), r.h * SHRINK_STEP)
  return { hitRegion: placeWithin(bounds, zone.focusPoint, w, h), focusPoint: zone.focusPoint }
}

/**
 * 写真 1 枚ぶんの当たり枠を作り、和集合が MAX_HIT_COVERAGE 以下になるまで縮める。
 * 入力と同じ順・同じ数で返す(危険は捨てない)。同じ入力なら同じ出力。
 */
export function fitHitZones(
  inputs: readonly HitZoneInput[],
  profile: HitZoneProfile = DANGER_HIT_PROFILE,
): HitZone[] {
  let zones = inputs.map((input) => deriveHitRegion(input.region, input.focus, profile))
  for (let pass = 0; pass < MAX_FIT_PASSES; pass += 1) {
    if (effectiveCoverage(zones.map((z) => z.hitRegion)) <= MAX_HIT_COVERAGE) break
    zones = zones.map((zone, i) => shrinkToward(zone, inputs[i].region))
  }
  return zones
}

/** 採点に使う枠。当たり枠が無い旧データは表示用の枠で採点する(後方互換)。 */
export function hitZoneOf(hazard: Pick<HunterHazard, "region" | "hitRegion">): HunterRegion {
  return hazard.hitRegion ?? hazard.region
}

/** ヒントの向き・スタンプ位置の基準点。focus が無ければ当たり枠の中心。 */
export function anchorOf(hazard: Pick<HunterHazard, "region" | "hitRegion" | "focusPoint">): HunterPoint {
  return hazard.focusPoint ?? centerOf(hitZoneOf(hazard))
}
