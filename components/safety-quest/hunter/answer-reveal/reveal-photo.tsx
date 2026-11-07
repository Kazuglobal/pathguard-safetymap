"use client"

// =============================================
// こたえあわせ: 写真の上で危険を見せる
//  - 全体: 全部の危険の範囲をうすく ふちどり、番号マーカーを置く。
//  - 選択中: その危険だけを明るく残し(スポットライト)、まわりを暗くして、その場所へズームする。
//  ズームは写真の層(実際に絵が描かれた矩形)の中だけで行い、写真の外は見せない。
// =============================================

import { useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

import { containRect, type Size } from "@/lib/hunter/image-geometry"
import { photoAspectRatio } from "@/lib/hunter/photo-aspect"
import { focusTransform, type RevealItem } from "@/lib/hunter/reveal"
import type { HunterRegion } from "@/lib/hunter/types"

import { PhotoFrame, tokens } from "../theme"
import { useContainerBox } from "../use-container-box"
import { STATUS_STYLE } from "./reveal-status"

const C = tokens.color
/** 写真の層のズームと、それを打ち消すマーカー・枠線を同じ速さで動かす。 */
const ZOOM_EASE = "480ms cubic-bezier(.22,1,.36,1)"
const ZOOM_TRANSITION = `transform ${ZOOM_EASE}`

function pct(region: HunterRegion) {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.w * 100}%`,
    height: `${region.h * 100}%`,
  }
}

export function RevealPhoto({
  imageUrl,
  items,
  selected,
  onSelect,
}: {
  imageUrl: string
  items: readonly RevealItem[]
  /** 選んでいる危険の index。null なら全体。 */
  selected: number | null
  onSelect: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const box = useContainerBox(frameRef)
  const [natural, setNatural] = useState<Size | null>(null)
  const contain = useMemo(() => (natural && box ? containRect(natural, box) : null), [natural, box])
  const current = selected === null ? null : items[selected] ?? null
  const zoom = focusTransform(current ? current.region : null)

  // 写真の層 = 実際に絵が描かれた矩形(測れないうちは枠いっぱい)
  const layerStyle = contain && contain.drawW > 0
    ? { left: contain.offsetX, top: contain.offsetY, width: contain.drawW, height: contain.drawH }
    : { left: 0, top: 0, width: "100%", height: "100%" }

  return (
    <PhotoFrame tape={false}>
      <div
        ref={frameRef}
        aria-label="こたえあわせの しゃしん"
        role="group"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: photoAspectRatio(natural),
          maxHeight: "min(50dvh, 460px)",
          overflow: "hidden",
          background: C.night,
        }}
      >
        <div style={{ position: "absolute", overflow: "hidden", ...layerStyle }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "0 0",
              transform: `translate(${zoom.tx * 100}%, ${zoom.ty * 100}%) scale(${zoom.scale})`,
              transition: reduce ? "none" : ZOOM_TRANSITION,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="つうがくろの しゃしん"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth > 0 && img.naturalHeight > 0) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
              }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }}
            />

            {/* 全体のときは全部の範囲をうすく、選択中はその範囲だけをスポットライト */}
            {items.map((item, i) => {
              const isCurrent = selected === i
              if (selected !== null && !isCurrent) return null
              const line = STATUS_STYLE[item.status].line
              return (
                <div
                  key={`area-${item.id}`}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    ...pct(item.region),
                    borderRadius: 12,
                    border: `${(isCurrent ? 3 : 2) / zoom.scale}px ${item.status === "missed" ? "dashed" : "solid"} ${line}`,
                    boxShadow: isCurrent ? "0 0 0 9999px rgba(20,32,29,.58)" : undefined,
                    background: isCurrent ? "transparent" : `${line}1f`,
                    transition: reduce ? "none" : `box-shadow 300ms ease, border-width ${ZOOM_EASE}`,
                    pointerEvents: "none",
                  }}
                />
              )
            })}

            {items.map((item, i) => (
              <RevealMarker
                key={`marker-${item.id}`}
                item={item}
                active={selected === i}
                dimmed={selected !== null && selected !== i}
                scale={zoom.scale}
                reduce={Boolean(reduce)}
                onClick={() => onSelect(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </PhotoFrame>
  )
}

function RevealMarker({
  item,
  active,
  dimmed,
  scale,
  reduce,
  onClick,
}: {
  item: RevealItem
  active: boolean
  dimmed: boolean
  scale: number
  reduce: boolean
  onClick: () => void
}) {
  const style = STATUS_STYLE[item.status]
  const anchor = item.anchor
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.number}ばん ${item.title}（${style.label}）`}
      aria-pressed={active}
      className={tokens.cls.focus}
      style={{
        position: "absolute",
        left: `${anchor.x * 100}%`,
        top: `${anchor.y * 100}%`,
        // ズームしてもマーカーの大きさは変えない(拡大を打ち消す)。親と同じ速さで動かし、途中で跳ねないようにする
        transform: `translate(-50%, -50%) scale(${(active ? 1.15 : 1) / scale})`,
        transition: reduce ? "none" : ZOOM_TRANSITION,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: style.bg,
        color: style.fg,
        border: `3px solid ${style.border}`,
        boxShadow: active ? `0 0 0 4px ${C.sun}, ${tokens.shadow.card}` : tokens.shadow.card,
        fontSize: 18,
        fontWeight: 900,
        opacity: dimmed ? 0.55 : 1,
        zIndex: active ? 3 : 2,
        cursor: "pointer",
        touchAction: "manipulation",
      }}
    >
      {item.number}
    </button>
  )
}
