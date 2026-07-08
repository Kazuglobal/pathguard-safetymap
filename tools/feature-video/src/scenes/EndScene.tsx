import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { END_FRAMES, theme } from "../theme"

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" })
  const taglineIn = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 30 })
  const ctaIn = spring({ frame: frame - 22, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 36 })
  const fadeOut = interpolate(frame, [END_FRAMES - 14, END_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.charcoal,
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: "0.08em",
          color: theme.white,
          opacity: taglineIn,
          transform: `translateY(${(1 - taglineIn) * 26}px)`,
        }}
      >
        今日の通学が、もっと安心に。
      </div>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 40,
          color: theme.white,
          marginTop: 30,
          opacity: taglineIn,
        }}
      >
        Path<span style={{ color: theme.amber }}>Guardian</span>
      </div>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 26,
          color: theme.ink,
          backgroundColor: theme.amber,
          padding: "16px 46px",
          borderRadius: 999,
          border: `3px solid ${theme.ink}`,
          boxShadow: theme.stickerShadow,
          marginTop: 36,
          transform: `rotate(-2deg) scale(${ctaIn})`,
        }}
      >
        無料ではじめる
      </div>
    </AbsoluteFill>
  )
}
