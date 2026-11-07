// =============================================
// きけんハンター AI 評価: 生の応答 → 指標 + HTML レポート (純粋ロジック)
// run.ts が保存した Gemini の生の応答を、アプリと同じ後処理(validate → sanitize)に通して測る。
//  - 旧ルールの当たり面積(表示枠 + 指先補正の和集合)= 適当なタップが当たる確率
//  - 新ルールの当たり面積(当たり枠 + 指先補正の和集合)
//  - focus が返ってきた割合・枠の中にあった割合
// =============================================

import { extractHunterJson } from "@/lib/hunter/ai-json"
import { validateHunterResponse } from "@/lib/hunter/ai-schema"
import { effectiveCoverage } from "@/lib/hunter/hit-zone"
import { sanitizeDangerPoints } from "@/lib/hunter/sanitize"
import type { HunterHazard } from "@/lib/hunter/types"

export interface PhotoMetrics {
  readonly parsed: boolean
  readonly imageUsable: boolean
  readonly rawPoints: number
  readonly hazards: number
  /** 旧ルール: 表示枠そのままで採点したときの当たり面積(0..1)。 */
  readonly legacyCoverage: number
  /** 新ルール: 当たり枠での当たり面積(0..1)。 */
  readonly hitCoverage: number
  readonly focusProvided: number
  readonly focusInsideBox: number
  readonly hazardList: readonly HunterHazard[]
}

export function evaluateRaw(text: string | null): PhotoMetrics {
  const empty = { rawPoints: 0, hazards: 0, legacyCoverage: 0, hitCoverage: 0, focusProvided: 0, focusInsideBox: 0, hazardList: [] }
  if (!text) return { parsed: false, imageUsable: false, ...empty }
  const extracted = extractHunterJson(text)
  if (!extracted.ok) return { parsed: false, imageUsable: false, ...empty }
  const validated = validateHunterResponse(extracted.value)
  const { hazards } = sanitizeDangerPoints(validated.dangerPoints, { sessionId: "eval" })
  const withFocus = validated.dangerPoints.filter((p) => p.focus)
  const inside = withFocus.filter((p) => {
    const r = p.region
    const f = p.focus!
    return f.x >= r.x && f.x <= r.x + r.w && f.y >= r.y && f.y <= r.y + r.h
  })
  return {
    parsed: true,
    imageUsable: validated.imageUsable,
    rawPoints: validated.dangerPoints.length,
    hazards: hazards.length,
    legacyCoverage: effectiveCoverage(hazards.map((h) => h.region)),
    hitCoverage: effectiveCoverage(hazards.map((h) => h.hitRegion ?? h.region)),
    focusProvided: withFocus.length,
    focusInsideBox: inside.length,
    hazardList: hazards,
  }
}

export interface VariantSummary {
  readonly photos: number
  readonly parseFailures: number
  readonly guideEmpty: number
  readonly meanHazards: number
  readonly meanLegacyCoverage: number
  readonly meanHitCoverage: number
  readonly focusInsideRate: number | null
}

export function summarize(rows: readonly PhotoMetrics[]): VariantSummary {
  const n = rows.length || 1
  const mean = (f: (r: PhotoMetrics) => number) => rows.reduce((s, r) => s + f(r), 0) / n
  const focus = rows.reduce((s, r) => s + r.focusProvided, 0)
  return {
    photos: rows.length,
    parseFailures: rows.filter((r) => !r.parsed).length,
    guideEmpty: rows.filter((r) => r.parsed && r.hazards === 0).length,
    meanHazards: mean((r) => r.hazards),
    meanLegacyCoverage: mean((r) => r.legacyCoverage),
    meanHitCoverage: mean((r) => r.hitCoverage),
    focusInsideRate: focus > 0 ? rows.reduce((s, r) => s + r.focusInsideBox, 0) / focus : null,
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)
}

function overlay(hazards: readonly HunterHazard[]): string {
  return hazards
    .map((h, i) => {
      const r = h.region
      const hit = h.hitRegion ?? h.region
      const f = h.focusPoint
      return [
        `<rect x="${r.x * 100}" y="${r.y * 100}" width="${r.w * 100}" height="${r.h * 100}" fill="none" stroke="#2f6fdf" stroke-width="0.6"/>`,
        `<rect x="${hit.x * 100}" y="${hit.y * 100}" width="${hit.w * 100}" height="${hit.h * 100}" fill="rgba(21,158,114,.25)" stroke="#159E72" stroke-width="0.6"/>`,
        f ? `<circle cx="${f.x * 100}" cy="${f.y * 100}" r="1.4" fill="#e0342f"/>` : "",
        `<text x="${r.x * 100 + 1}" y="${r.y * 100 + 4}" font-size="4" fill="#fff" stroke="#000" stroke-width="0.2">${i + 1} ${esc(h.kind ?? "")}</text>`,
      ].join("")
    })
    .join("")
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function renderReport(
  photos: readonly { name: string; fileUrl: string; byVariant: Record<string, PhotoMetrics> }[],
  summaries: Record<string, VariantSummary>,
): string {
  const variants = Object.keys(summaries)
  const head = variants
    .map((v) => {
      const s = summaries[v]
      return `<tr><td>${v}</td><td>${s.photos}</td><td>${s.parseFailures}</td><td>${s.guideEmpty}</td><td>${s.meanHazards.toFixed(2)}</td><td>${pct(s.meanLegacyCoverage)}</td><td>${pct(s.meanHitCoverage)}</td><td>${s.focusInsideRate === null ? "-" : pct(s.focusInsideRate)}</td></tr>`
    })
    .join("")
  const cards = photos
    .map((p) => {
      const cells = variants
        .map((v) => {
          const m = p.byVariant[v]
          if (!m) return `<td>未実行</td>`
          return `<td><div class="ph"><img src="${p.fileUrl}"/><svg viewBox="0 0 100 100" preserveAspectRatio="none">${overlay(m.hazardList)}</svg></div>
<p>危険 ${m.hazards} / 旧の当たり ${pct(m.legacyCoverage)} / 新の当たり ${pct(m.hitCoverage)}${m.parsed ? "" : " / 読めない応答"}</p></td>`
        })
        .join("")
      return `<tr><th>${esc(p.name)}</th>${cells}</tr>`
    })
    .join("")
  return `<!doctype html><meta charset="utf-8"><title>Hunter eval</title>
<style>body{font-family:system-ui;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;vertical-align:top}
.ph{position:relative;width:360px}.ph img{width:100%;display:block}.ph svg{position:absolute;inset:0;width:100%;height:100%}</style>
<h1>きけんハンター AI 評価</h1><p>青=表示枠 / 緑=当たり枠 / 赤=focus。当たり=適当なタップ 1 回が当たる確率(指先補正込み)。</p>
<table><tr><th>形式</th><th>写真</th><th>読めない</th><th>危険なし</th><th>危険の数(平均)</th><th>旧の当たり</th><th>新の当たり</th><th>focus が枠内</th></tr>${head}</table>
<h2>写真ごと</h2><table><tr><th>写真</th>${variants.map((v) => `<th>${v}</th>`).join("")}</tr>${cards}</table>`
}
