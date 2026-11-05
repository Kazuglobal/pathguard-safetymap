import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { Sticker } from "../components/sticker"
import { EASE, theme } from "../theme"

const ease = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" })

/** タイトル: 紙の上にピンが「ぽん」と押され(accent 1)、見出しが文節ごとに出る */
export const TitleScene: React.FC<{ featureCount: number }> = ({ featureCount }) => {
  const frame = useCurrentFrame()
  const phrases = ["通学路の「ヒヤリ」に、", "印をつける。"]
  const badge = ease(frame, 40, 9)
  return (
    <AbsoluteFill style={{ backgroundColor: theme.paper, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Sticker kind="pins" from={0} size={170} />
        <div>
          {phrases.map((phrase, i) => {
            const p = ease(frame, 14 + i * 6, 9)
            return (
              <div key={phrase} style={{ overflow: "hidden" }}>
                <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 64, lineHeight: 1.3, color: theme.ink, transform: `translateY(${(1 - p) * 105}%)` }}>
                  {phrase}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 28,
          color: theme.ink,
          backgroundColor: theme.amber,
          padding: "10px 30px",
          borderRadius: 999,
          border: `3px solid ${theme.ink}`,
          boxShadow: theme.stickerShadow,
          opacity: badge,
          transform: `rotate(-3deg) translateY(${(1 - badge) * 16}px)`,
        }}
      >
        PathGuardian ・ 約1分でわかる {featureCount}の機能
      </div>
    </AbsoluteFill>
  )
}
