import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { FEATURE_FRAMES, theme } from "../theme"

export interface FeatureSceneProps {
  index: number
  title: string
  kicker: string
  description: string
  media:
    | { kind: "phone"; src: string }
    | { kind: "browser"; src: string }
    | { kind: "broll"; src: string; playbackRate: number }
}

const sceneFade = (frame: number) =>
  interpolate(frame, [0, 10, FEATURE_FRAMES - 10, FEATURE_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

/** 見出しブロック(番号・タイトル・説明)。broll時は白文字 */
const TextBlock: React.FC<{ props: FeatureSceneProps; light: boolean }> = ({ props, light }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const numIn = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 26 })
  const titleIn = spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 26 })
  const descIn = spring({ frame: frame - 18, fps, config: { damping: 200 }, durationInFrames: 26 })

  const inkColor = light ? theme.white : theme.ink
  const softColor = light ? "rgba(255,255,255,0.82)" : theme.inkSoft

  return (
    <div style={{ maxWidth: 480 }}>
      <div
        style={{
          display: "inline-block",
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 34,
          color: theme.ink,
          backgroundColor: theme.amber,
          border: `3px solid ${theme.ink}`,
          borderRadius: 999,
          padding: "6px 22px",
          boxShadow: "5px 5px 0 rgba(43,39,35,0.9)",
          opacity: numIn,
          transform: `rotate(-3deg) translateY(${(1 - numIn) * 24}px)`,
        }}
      >
        {String(props.index).padStart(2, "0")}
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontWeight: 700,
          fontSize: 20,
          color: theme.green,
          marginTop: 14,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 20}px)`,
        }}
      >
        {props.kicker}
      </div>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 50,
          color: inkColor,
          marginTop: 6,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 20}px)`,
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1.75,
          color: softColor,
          marginTop: 18,
          opacity: descIn,
          transform: `translateY(${(1 - descIn) * 18}px)`,
        }}
      >
        {props.description}
      </div>
    </div>
  )
}

export const FeatureScene: React.FC<FeatureSceneProps> = (props) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = sceneFade(frame)
  const mediaIn = spring({ frame: frame - 8, fps, config: { damping: 100, stiffness: 90 }, durationInFrames: 34 })
  const drift = interpolate(frame, [0, FEATURE_FRAMES], [1, 1.05])

  if (props.media.kind === "broll") {
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: theme.charcoal }}>
        <OffthreadVideo
          src={staticFile(props.media.src)}
          muted
          playbackRate={props.media.playbackRate}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(90deg, rgba(38,34,30,0.88) 0%, rgba(38,34,30,0.55) 45%, rgba(38,34,30,0.08) 75%)",
          }}
        />
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 88 }}>
          <TextBlock props={props} light />
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  const isPhone = props.media.kind === "phone"

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: theme.paper }}>
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 88,
          paddingRight: isPhone ? 130 : 72,
        }}
      >
        <TextBlock props={props} light={false} />

        <div
          style={{
            opacity: mediaIn,
            transform: `translateY(${(1 - mediaIn) * 60}px)`,
          }}
        >
          {isPhone ? (
            <div
              style={{
                width: 265,
                padding: 9,
                borderRadius: 40,
                backgroundColor: theme.ink,
                boxShadow: theme.stickerShadow,
                transform: `rotate(${props.index % 2 === 0 ? 2 : -2}deg)`,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "390 / 844",
                  borderRadius: 32,
                  overflow: "hidden",
                }}
              >
                <Img
                  src={staticFile(props.media.src)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                    transform: `scale(${drift})`,
                    transformOrigin: "50% 20%",
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 620,
                borderRadius: 22,
                overflow: "hidden",
                backgroundColor: theme.white,
                border: `3px solid ${theme.ink}`,
                boxShadow: theme.stickerShadow,
                transform: `rotate(${props.index % 2 === 0 ? 1.5 : -1.5}deg)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "12px 16px",
                  backgroundColor: "#f8fafc",
                  borderBottom: "1px solid #eef2f7",
                }}
              >
                <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#ff5f57" }} />
                <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#febc2e" }} />
                <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#28c840" }} />
              </div>
              <div style={{ position: "relative", width: "100%", aspectRatio: "1600 / 1000", overflow: "hidden" }}>
                <Img
                  src={staticFile(props.media.src)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                    transform: `scale(${drift})`,
                    transformOrigin: "50% 30%",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
