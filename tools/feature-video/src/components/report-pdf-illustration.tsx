import { interpolate, useCurrentFrame } from "remotion"
import { EASE, theme } from "../theme"

/**
 * 危険箇所レポート(PDF)の図。実画面ではない(見本の通学路には公開済みの危険がなく、実データで撮れないため)。
 * 画面に「図」と書き、実際の画面に見えないよう線画だけで描く。中身の数字や写真は描かない。
 */
export const ReportPdfIllustration: React.FC = () => {
  const frame = useCurrentFrame()
  const page = (i: number) => interpolate(frame, [10 + i * 4, 24 + i * 4], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const sheet = (i: number, label: string, rows: number, withMap: boolean) => (
    <div
      key={label}
      style={{
        width: 230,
        height: 310,
        backgroundColor: theme.white,
        border: `3px solid ${theme.ink}`,
        borderRadius: 14,
        boxShadow: theme.stickerShadow,
        padding: 18,
        transform: `translateY(${(1 - page(i)) * 40}px) rotate(${i === 0 ? -3 : 3}deg)`,
        opacity: page(i),
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 18, color: theme.ink }}>{label}</div>
      {withMap && (
        <div style={{ height: 110, borderRadius: 10, border: `2px dashed ${theme.inkSoft}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.fontBody, fontSize: 15, color: theme.inkSoft }}>
          地図
        </div>
      )}
      {Array.from({ length: rows }).map((_, k) => (
        <div key={k} style={{ height: 10, borderRadius: 5, backgroundColor: "rgba(43,39,35,0.14)", width: `${92 - k * 9}%` }} />
      ))}
    </div>
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 22 }}>
        {sheet(0, "家庭向け(写真つき)", 4, true)}
        {sheet(1, "学校・地域向け", 6, true)}
      </div>
      <div style={{ fontFamily: theme.fontBody, fontWeight: 700, fontSize: 16, color: theme.inkSoft }}>※ 図です(実際の画面ではありません)</div>
    </div>
  )
}
