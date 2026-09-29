"use client"

import { useState } from "react"
import type { HunterHazard } from "@/lib/hunter/types"
import { PaperPanel, tokens } from "./theme"
import { RubyText } from "./ruby-text"

/** Checks mean a conversation happened, never that a location is safe. */
export function ActionReview({ hazards }: { hazards: readonly HunterHazard[] }) {
  const [checked, setChecked] = useState<readonly string[]>([])
  const [copyStatus, setCopyStatus] = useState("")
  const [copying, setCopying] = useState(false)
  const C = tokens.color
  const memo = [
    "キケンハンター ふりかえりメモ",
    "親子・先生と、次に歩くときの行動を話し合うためのメモです。",
    "AIによる気づきの候補です。現地の安全を保証するものではありません。",
    ...hazards.map((hazard, index) =>
      `\n${index + 1}. ${hazard.type}\n気になること: ${hazard.kidExplanation}\n次にすること: ${hazard.safeAction}\n話し合い: ${checked.includes(hazard.id) ? "確認した" : "これから"}`,
    ),
    ...(hazards.length === 0 ? ["\n写真から気づきの候補は得られませんでした。気になった場所をおとなと話してみましょう。"] : []),
    "\n写真・位置情報はこのメモには含まれません。",
  ].join("\n")

  async function copyMemo() {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(memo)
      setCopyStatus("メモを コピーしたよ。おくる前に おとなと たしかめよう。")
    } catch {
      setCopyStatus("コピーできなかったよ。下の メモを えらんで コピーしてね。")
    } finally {
      setCopying(false)
    }
  }

  return (
    <PaperPanel tone="green" className="px-4 py-4">
      <h3 className="text-[15px] font-black" style={{ color: C.primaryStrong }}>
        つぎに あるくときは？
      </h3>
      <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: C.ink }}>
        おうちの人や 先生と、どうするか はなそう。はなせたら チェックしてね。
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
        チェックは この画面だけに のこるよ。「あんぜん」の しるしでは ないよ。
      </p>
      {hazards.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {hazards.map((hazard) => (
            <li key={hazard.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
                <input
                  type="checkbox"
                  aria-label={`${hazard.type}について はなした`}
                  checked={checked.includes(hazard.id)}
                  onChange={(event) => {
                    setChecked(event.target.checked
                      ? [...checked, hazard.id]
                      : checked.filter((id) => id !== hazard.id))
                    setCopyStatus("")
                  }}
                  className="mt-1 h-5 w-5 shrink-0 accent-green-700"
                />
                <span className="text-sm leading-relaxed" style={{ color: C.ink }}>
                  <strong className="block"><RubyText text={hazard.type} /></strong>
                  <RubyText text={hazard.safeAction} />
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm" style={{ color: C.ink }}>
          きょう あるいた みちで、気になった ところを はなしてみよう。
        </p>
      )}
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold" style={{ color: C.primaryStrong }}>
          おうちの人・先生に わたす メモ
        </summary>
        <p className="mb-2 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
          写真や ばしょは ふくまれないよ。内容を たしかめてから わたしてね。
        </p>
        <textarea aria-label="ふりかえりメモ" readOnly value={memo} rows={8}
          className="w-full rounded-xl border border-green-800/20 bg-white p-3 text-sm leading-relaxed"
          style={{ color: C.ink }} />
        <button type="button" onClick={copyMemo} disabled={copying}
          className="mt-2 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: C.primaryStrong }}>
          {copying ? "コピーしているよ…" : "メモを コピーする"}
        </button>
        <p role="status" className="mt-2 text-xs leading-relaxed" style={{ color: C.inkSoft }}>{copyStatus}</p>
      </details>
    </PaperPanel>
  )
}
