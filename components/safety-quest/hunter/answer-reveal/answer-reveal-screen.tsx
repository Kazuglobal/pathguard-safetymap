"use client"

// =============================================
// きけんハンター こたえあわせ(遊んだあと)
//  写真の上に番号つきで危険を全部見せ(全体)→ 1 つずつ スポットライト+ズームで確かめる。
//  見つけた/見のがした も写真で分かる。おうちの人むけ スイッチで くわしい説明。
//  遊ぶ前には出さない(答えが先に分かってしまうため)。
// =============================================

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Eye } from "lucide-react"

import { buildRevealItems, countReveal } from "@/lib/hunter/reveal"
import type { HunterAccidentSummary, HunterDiscovery, HunterHazard, HunterParentNote } from "@/lib/hunter/types"

import { RubyText } from "../ruby-text"
import { BottomBar, PaperPanel, PrimaryCTA, SpeechBubble, tokens } from "../theme"
import { ParentDisclaimer, ParentToggle } from "./parent-notes"
import { RevealCard } from "./reveal-card"
import { RevealPhoto } from "./reveal-photo"
import { STATUS_STYLE } from "./reveal-status"

const C = tokens.color

export interface AnswerRevealScreenProps {
  imageUrl: string
  hazards: readonly HunterHazard[]
  discoveries: readonly HunterDiscovery[]
  parentNotes?: readonly HunterParentNote[]
  accident: HunterAccidentSummary | null
  /** 下のボタンのことば(遊んだ直後=「けっかを みる」/ 結果から開いた=「けっかに もどる」)。 */
  doneLabel: string
  onDone: () => void
}

export function AnswerRevealScreen(props: AnswerRevealScreenProps) {
  const { imageUrl, hazards, discoveries, parentNotes = [], accident, doneLabel, onDone } = props
  const items = useMemo(() => buildRevealItems(hazards, discoveries, parentNotes), [hazards, discoveries, parentNotes])
  const counts = countReveal(items)
  const [selected, setSelected] = useState<number | null>(null)
  const [parentMode, setParentMode] = useState(false)
  const cardHeadingRef = useRef<HTMLHeadingElement>(null)
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null)
  // 押したボタンが消える(1ばんから みる / ぜんたいを みる)ので、移った先の見出しへフォーカスを移す
  const userMoved = useRef(false)

  const go = (next: number) => {
    userMoved.current = true
    setSelected(Math.max(0, Math.min(items.length - 1, next)))
  }
  const showOverview = () => {
    userMoved.current = true
    setSelected(null)
  }

  useEffect(() => {
    if (!userMoved.current) return
    const target = selected === null ? overviewHeadingRef.current : cardHeadingRef.current
    target?.focus({ preventScroll: true })
  }, [selected])

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-col px-4 pt-1">
      <div className="flex flex-1 flex-col gap-3">
        <SpeechBubble mood={counts.missed === 0 ? "wow" : "cheer"}>
          {selected === null
            ? "こたえあわせだよ！ ばんごうを じゅんばんに みていこう。"
            : "ひかっている ところを よく みてね。"}
        </SpeechBubble>

        <RevealPhoto imageUrl={imageUrl} items={items} selected={selected} onSelect={go} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Legend counts={counts} />
          <ParentToggle on={parentMode} onChange={setParentMode} />
        </div>

        {selected === null ? (
          <Overview total={items.length} onStart={() => go(0)} headingRef={overviewHeadingRef} />
        ) : (
          <>
            <RevealCard
              item={items[selected]}
              index={selected}
              total={items.length}
              onPrev={() => go(selected - 1)}
              onNext={() => go(selected + 1)}
              parentMode={parentMode}
              accident={accident}
              headingRef={cardHeadingRef}
            />
            <button
              type="button"
              onClick={showOverview}
              className={`mx-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13.5px] font-black ${tokens.cls.focus}`}
              style={{ color: C.primaryStrong }}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              ぜんたいを みる
            </button>
          </>
        )}

        {parentMode ? <ParentDisclaimer /> : null}
      </div>

      <BottomBar className="-mx-4 px-4">
        <PrimaryCTA variant="sun" onClick={onDone}>
          {doneLabel}
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}

function Legend({ counts }: { counts: ReturnType<typeof countReveal> }) {
  const entries = [
    { key: "understood" as const, n: counts.understood },
    { key: "found" as const, n: counts.found },
    { key: "missed" as const, n: counts.missed },
  ].filter((e) => e.n > 0)
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="こたえあわせの まとめ">
      {entries.map(({ key, n }) => (
        <li
          key={key}
          className="rounded-full px-2.5 py-1 text-[12px] font-black"
          style={{
            background: STATUS_STYLE[key].bg,
            color: STATUS_STYLE[key].fg,
            border: `2px solid ${key === "understood" ? STATUS_STYLE[key].bg : STATUS_STYLE[key].border}`,
          }}
        >
          {STATUS_STYLE[key].label} {n}
        </li>
      ))}
    </ul>
  )
}

function Overview({
  total,
  onStart,
  headingRef,
}: {
  total: number
  onStart: () => void
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <PaperPanel tone="sun" className="px-4 py-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-[15px] font-black leading-relaxed outline-none" style={{ color: C.ink }}>
        <RubyText text={`この 写真には 気をつけたい ところが ${total}こ あったよ。`} />
      </h3>
      <p className="mt-1 text-[13px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
        <RubyText text="写真の ばんごうを タップしても 見られるよ。" />
      </p>
      <div className="mt-3">
        <PrimaryCTA size="md" variant="green" onClick={onStart}>
          1ばんから みる
        </PrimaryCTA>
      </div>
    </PaperPanel>
  )
}
