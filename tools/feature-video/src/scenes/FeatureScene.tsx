import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { BrowserShot, PhoneCompare, PhoneSequence, PhoneShot } from "../components/frames"
import { ReportPdfIllustration } from "../components/report-pdf-illustration"
import { Sticker } from "../components/sticker"
import { EASE, PANEL_IN_FRAMES, theme } from "../theme"
import type { TourMedia } from "../tour-media"

export interface FeatureSceneProps {
  index: number
  title: string
  kicker: string
  tourLine: string
  media: TourMedia
}

const ease = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" })

/** 見出しは文節ごとに下からのマスクで出す(日本語は1文字ずつ動かさない) */
const MaskLine: React.FC<{ text: string; start: number; style: React.CSSProperties }> = ({ text, start, style }) => {
  const frame = useCurrentFrame()
  const phrases = text.split(/(?<=[、。」）)])/).filter(Boolean)
  return (
    <div style={{ ...style, display: "flex", flexWrap: "wrap" }}>
      {phrases.map((phrase, i) => {
        const p = ease(frame, start + i * 3, 9)
        return (
          <span key={`${phrase}-${i}`} style={{ display: "inline-block", overflow: "hidden" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)` }}>{phrase}</span>
          </span>
        )
      })}
    </div>
  )
}

/** 長い見出しは1行に収まる大きさにする(途中で折り返さない) */
const titleSize = (title: string) => (title.length > 12 ? 36 : title.length > 8 ? 44 : 52)

const TextBlock: React.FC<{ props: FeatureSceneProps }> = ({ props }) => {
  const frame = useCurrentFrame()
  const num = ease(frame, 8, 9)
  const kicker = ease(frame, 12, 9)
  const line = ease(frame, 24, 9)
  return (
    <div style={{ maxWidth: 470 }}>
      <div
        style={{
          display: "inline-block",
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 30,
          color: theme.ink,
          backgroundColor: theme.amber,
          border: `3px solid ${theme.ink}`,
          borderRadius: 999,
          padding: "4px 20px",
          boxShadow: "5px 5px 0 rgba(43,39,35,0.9)",
          opacity: num,
          transform: `rotate(-3deg) translateY(${(1 - num) * -24}px)`,
        }}
      >
        {String(props.index).padStart(2, "0")}
      </div>
      <div style={{ fontFamily: theme.fontBody, fontWeight: 700, fontSize: 21, color: theme.green, marginTop: 16, opacity: kicker }}>
        {props.kicker}
      </div>
      <MaskLine text={props.title} start={12} style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: titleSize(props.title), lineHeight: 1.25, color: theme.ink, marginTop: 6 }} />
      <div
        style={{
          fontFamily: theme.fontBody,
          fontWeight: 700,
          fontSize: 28,
          lineHeight: 1.6,
          color: theme.ink,
          marginTop: 20,
          paddingLeft: 16,
          textWrap: "pretty",
          borderLeft: `6px solid ${theme.amber}`,
          opacity: line,
          transform: `translateY(${(1 - line) * 8}px)`,
        }}
      >
        {props.tourLine}
      </div>
    </div>
  )
}

const Media: React.FC<{ media: TourMedia; tilt: number }> = ({ media, tilt }) => {
  switch (media.kind) {
    case "phone":
      return <PhoneShot src={media.src} tilt={tilt} />
    case "browser":
      return <BrowserShot src={media.src} tilt={tilt / 1.4} />
    case "phoneCompare":
      return <PhoneCompare {...media} tilt={tilt} />
    case "phoneSequence":
      return <PhoneSequence first={media.first} second={media.second} tilt={tilt} />
    case "illustration":
      return <ReportPdfIllustration />
  }
}

export const FeatureScene: React.FC<FeatureSceneProps> = (props) => {
  const frame = useCurrentFrame()
  // 紙のパネルが右から入って、前の場面に重なる(フェードしない)
  const panel = ease(frame, 0, PANEL_IN_FRAMES)
  const mediaIn = ease(frame, 10, 14)
  const tilt = props.index % 2 === 0 ? 2 : -2
  const overlay = "overlay" in props.media ? props.media.overlay : undefined
  const isBrowser = props.media.kind === "browser"

  return (
    <AbsoluteFill style={{ transform: `translateX(${(1 - panel) * 100}%)` }}>
      <AbsoluteFill style={{ backgroundColor: theme.paper, borderLeft: `3px solid ${theme.ink}`, boxShadow: "-10px 0 0 rgba(43,39,35,0.18)" }} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 84, paddingRight: isBrowser ? 60 : 120 }}>
        <TextBlock props={props} />
        <div style={{ position: "relative", opacity: mediaIn, transform: `translateY(${(1 - mediaIn) * 40}px)` }}>
          <Media media={props.media} tilt={tilt} />
          {overlay && (
            <div style={{ position: "absolute", left: isBrowser ? -90 : -170, bottom: -20 }}>
              <Sticker kind={overlay} from={40} size={isBrowser ? 130 : 150} />
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
