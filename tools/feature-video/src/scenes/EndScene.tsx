import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { Sticker } from "../components/sticker"
import { EASE, PANEL_IN_FRAMES, theme } from "../theme"

const ease = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" })

/** エンド: ロゴとピン(accent 3)。最後の1秒以上は完全に止める */
export const EndScene: React.FC<{ note: string }> = ({ note }) => {
  const frame = useCurrentFrame()
  const panel = ease(frame, 0, PANEL_IN_FRAMES)
  const logo = ease(frame, 14, 9)
  const cta = ease(frame, 26, 9)
  return (
    <AbsoluteFill style={{ transform: `translateX(${(1 - panel) * 100}%)`, backgroundColor: theme.charcoal, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: logo, transform: `translateY(${(1 - logo) * 20}px)` }}>
        <Sticker kind="pins" from={12} size={120} />
        <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 72, color: theme.white }}>
          Path<span style={{ color: theme.amber }}>Guardian</span>
        </div>
      </div>
      <div style={{ marginTop: 18, fontFamily: theme.fontBody, fontWeight: 700, fontSize: 28, color: "rgba(255,253,248,0.86)", opacity: cta }}>{note}</div>
      <div
        style={{
          marginTop: 30,
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 28,
          color: theme.ink,
          backgroundColor: theme.amber,
          padding: "14px 44px",
          borderRadius: 999,
          border: `3px solid ${theme.ink}`,
          boxShadow: "8px 8px 0 rgba(0,0,0,0.5)",
          opacity: cta,
          transform: `rotate(-2deg) translateY(${(1 - cta) * 16}px)`,
        }}
      >
        無料ではじめる
      </div>
    </AbsoluteFill>
  )
}
