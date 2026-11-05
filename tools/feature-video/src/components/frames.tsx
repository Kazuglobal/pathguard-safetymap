import { Img, interpolate, staticFile, useCurrentFrame } from "remotion"
import { EASE_IN_OUT, FEATURE_FRAMES, theme } from "../theme"

/** 画面画像だけを 1.00→1.04 にゆっくり寄せる(仕様: CAMERA) */
function usePush(): number {
  const frame = useCurrentFrame()
  return interpolate(frame, [0, FEATURE_FRAMES], [1, 1.04], { easing: EASE_IN_OUT, extrapolateRight: "clamp" })
}

const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }

/** スマホの枠。内側は 390:844 を保つ(padding 方式。border 方式は左右が見切れる) */
export const PhoneFrame: React.FC<{ tilt: number; width?: number; children: React.ReactNode }> = ({ tilt, width = 270, children }) => (
  <div style={{ width, padding: 9, borderRadius: 40, backgroundColor: theme.ink, boxShadow: theme.stickerShadow, transform: `rotate(${tilt}deg)` }}>
    <div style={{ position: "relative", width: "100%", aspectRatio: "390 / 844", borderRadius: 32, overflow: "hidden", backgroundColor: theme.paper }}>
      {children}
    </div>
  </div>
)

export const PhoneShot: React.FC<{ src: string; tilt: number }> = ({ src, tilt }) => {
  const push = usePush()
  return (
    <PhoneFrame tilt={tilt}>
      <Img src={staticFile(src)} style={{ ...fill, transform: `scale(${push})`, transformOrigin: "50% 20%" }} />
    </PhoneFrame>
  )
}

export const BrowserShot: React.FC<{ src: string; tilt: number }> = ({ src, tilt }) => {
  const push = usePush()
  return (
    <div style={{ width: 640, borderRadius: 22, overflow: "hidden", backgroundColor: theme.white, border: `3px solid ${theme.ink}`, boxShadow: theme.stickerShadow, transform: `rotate(${tilt}deg)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c }} />
        ))}
      </div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1600 / 1000", overflow: "hidden" }}>
        <Img src={staticFile(src)} style={{ ...fill, transform: `scale(${push})`, transformOrigin: "50% 40%" }} />
      </div>
    </div>
  )
}

/** 2枚を縦ワイプで見比べる(f40→f80、ease-in-out)。ラベルは画面の外に置く */
export const PhoneCompare: React.FC<{ before: string; after: string; beforeLabel: string; afterLabel: string; tilt: number }> = ({ before, after, beforeLabel, afterLabel, tilt }) => {
  const frame = useCurrentFrame()
  const wipe = interpolate(frame, [40, 80], [0, 100], { easing: EASE_IN_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const label = (text: string, on: boolean) => (
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 22, padding: "6px 18px", borderRadius: 999, border: `3px solid ${theme.ink}`, backgroundColor: on ? theme.amber : theme.white, color: theme.ink, opacity: on ? 1 : 0.55 }}>
      {text}
    </div>
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {label(beforeLabel, wipe < 50)}
        {label(afterLabel, wipe >= 50)}
      </div>
      <PhoneFrame tilt={tilt} width={250}>
        <Img src={staticFile(before)} style={fill} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - wipe}% 0 0)` }}>
          <Img src={staticFile(after)} style={fill} />
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe}%`, width: 3, marginLeft: -1.5, backgroundColor: theme.ink, opacity: wipe > 0 && wipe < 100 ? 1 : 0 }} />
      </PhoneFrame>
    </div>
  )
}

/** 2枚を順に見せる(f80 から 10 フレームで重ねて切り替え) */
export const PhoneSequence: React.FC<{ first: string; second: string; tilt: number }> = ({ first, second, tilt }) => {
  const frame = useCurrentFrame()
  const cross = interpolate(frame, [80, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <PhoneFrame tilt={tilt}>
      <Img src={staticFile(first)} style={fill} />
      <Img src={staticFile(second)} style={{ ...fill, opacity: cross }} />
    </PhoneFrame>
  )
}
