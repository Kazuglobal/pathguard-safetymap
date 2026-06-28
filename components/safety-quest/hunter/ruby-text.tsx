"use client"

import { Fragment } from "react"

import { splitFurigana } from "@/lib/hunter/furigana"

/**
 * 漢字本文に辞書からルビ(ふりがな)を自動付与して表示する。
 * 低学年はルビ、高学年は漢字で読める。辞書に無い漢字はルビ無しで素通し。
 */
export function RubyText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const tokens = splitFurigana(text)
  return (
    <span className={className}>
      {tokens.map((tk, i) =>
        tk.r ? (
          <ruby key={i} className="leading-none">
            {tk.t}
            <rt className="text-[0.5em] font-bold leading-none">{tk.r}</rt>
          </ruby>
        ) : (
          <Fragment key={i}>{tk.t}</Fragment>
        ),
      )}
    </span>
  )
}
