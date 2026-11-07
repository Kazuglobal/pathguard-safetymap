"use client"

// =============================================
// こたえあわせ: おうちの人むけ(大人の文章・ルビなし)
//  - スイッチ(role="switch")で くわしい説明を出し入れする。
//  - AI が写真から読みとった根拠・危険の度合い・近くの事故を出す。AI の見立ては目安と明記する。
// =============================================

import {
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  accidentYearWindow,
  formatAccidentYearWindow,
} from "@/lib/accident-stats-year-window"
import type { RevealItem } from "@/lib/hunter/reveal"
import type { HunterAccidentSummary } from "@/lib/hunter/types"

import { RubyText } from "../ruby-text"
import { tokens } from "../theme"
import { SEVERITY_PARENT_LABEL } from "./reveal-status"

const C = tokens.color

export function ParentToggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-full border bg-white px-3.5 py-2 text-[13px] font-black ${tokens.cls.focus}`}
      style={{ borderColor: "rgba(67,57,43,.16)", color: C.ink, boxShadow: tokens.shadow.soft }}
    >
      <span
        aria-hidden="true"
        className="relative inline-block h-[22px] w-[40px] rounded-full transition-colors"
        style={{ background: on ? C.primary : C.paperDeep }}
      >
        <span
          className="absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left]"
          style={{ left: on ? 21 : 3, boxShadow: tokens.shadow.soft }}
        />
      </span>
      <RubyText text="おうちの人むけ くわしく" />
    </button>
  )
}

/**
 * 近くの事故の件数。範囲(半径)と期間を必ず添え、写真の道そのものの件数のように見せない。
 * 0 件は「安全」と読まれないよう、保証ではないと書く。
 */
export function accidentLine(accident: HunterAccidentSummary | null): string | null {
  if (!accident || !accident.hasData) return null
  const { radiusMeters, years } = ACCIDENT_IMAGE_CONTEXT_PARAMS
  const scope = `ピンから半径${radiusMeters}m以内・${formatAccidentYearWindow(accidentYearWindow(years))}の${years}年間`
  if (accident.totalAccidents <= 0) {
    return `${scope}に記録された事故はありませんでした。事故が起きないという保証ではありません。`
  }
  const child = accident.childInvolved > 0 ? `(うち子どもが関わる事故 ${accident.childInvolved}件)` : ""
  const top = accident.topAccidentType ? `。多いのは「${accident.topAccidentType}」` : ""
  return `${scope}に記録された事故 ${accident.totalAccidents}件${child}${top}。この写真の道で起きたとは限りません。`
}

export function ParentDetail({ item, accident }: { item: RevealItem; accident: HunterAccidentSummary | null }) {
  const nearby = accidentLine(accident)
  return (
    <dl
      className="mt-3 space-y-2 rounded-[14px] border px-3.5 py-3 text-[13px] leading-relaxed"
      style={{ borderColor: "rgba(67,57,43,.12)", background: C.paper, color: C.ink }}
    >
      {item.evidence ? (
        <div>
          <dt className="font-black" style={{ color: C.inkSoft }}>AIが写真から読みとったこと</dt>
          <dd className="font-bold">{item.evidence}</dd>
        </div>
      ) : null}
      {item.severity ? (
        <div>
          <dt className="font-black" style={{ color: C.inkSoft }}>危険の度合い(AIの判定)</dt>
          <dd className="font-bold">{SEVERITY_PARENT_LABEL[item.severity]}</dd>
        </div>
      ) : null}
      {item.accidentLink ? (
        <div>
          <dt className="font-black" style={{ color: C.inkSoft }}>関係しそうな事故の型</dt>
          <dd className="font-bold">{item.accidentLink}</dd>
        </div>
      ) : null}
      {nearby ? (
        <div>
          <dt className="font-black" style={{ color: C.inkSoft }}>近くの事故(警察庁の交通事故データ)</dt>
          <dd className="font-bold">{nearby}</dd>
        </div>
      ) : null}
    </dl>
  )
}

export function ParentDisclaimer() {
  return (
    <p className="text-[12px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
      AIの見立ては目安です。見落としや見まちがいもあります。実際の道で、お子さんと一緒に確かめてください。
    </p>
  )
}
