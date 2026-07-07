import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { theme, TITLE_FRAMES } from "../theme"

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const brandIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 })
  const badgeIn = spring({ frame: frame - 14, fps, config: { damping: 11, stiffness: 140 }, durationInFrames: 36 })
  const fadeOut = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.charcoal,
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 76,
          color: theme.white,
          opacity: brandIn,
          transform: `translateY(${(1 - brandIn) * 30}px)`,
        }}
      >
        Path<span style={{ color: theme.amber }}>Guardian</span>
      </div>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 30,
          color: theme.ink,
          backgroundColor: theme.amber,
          padding: "12px 34px",
          borderRadius: 999,
          border: `3px solid ${theme.ink}`,
          boxShadow: theme.stickerShadow,
          marginTop: 34,
          transform: `rotate(-3deg) scale(${badgeIn})`,
        }}
      >
        60秒でわかる 機能ツアー
      </div>
    </AbsoluteFill>
  )
}
