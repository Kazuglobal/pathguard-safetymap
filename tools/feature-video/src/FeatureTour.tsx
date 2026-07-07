import { AbsoluteFill, Sequence } from "remotion"
import { END_FRAMES, FEATURE_FRAMES, TITLE_FRAMES, theme } from "./theme"
import { TitleScene } from "./scenes/TitleScene"
import { FeatureScene, type FeatureSceneProps } from "./scenes/FeatureScene"
import { EndScene } from "./scenes/EndScene"

const FEATURES: FeatureSceneProps[] = [
  {
    index: 1,
    title: "危険マップ",
    kicker: "地域の目が集めた危険を、地図の上に",
    description: "ヒヤリハット報告が地図のピンになり、通学路の危険をひと目で確認できます。",
    media: { kind: "browser", src: "desktop-map.png" },
  },
  {
    index: 2,
    title: "ヒヤリハット報告",
    kicker: "3ステップで、地域の安全に参加",
    description: "子どもと一緒に使えるやさしい画面。投稿は AI と運営の審査を経て公開されます。",
    media: { kind: "phone", src: "mobile-report-wizard.png" },
  },
  {
    index: 3,
    title: "不審者アラート",
    kicker: "声かけ・不審者情報をプッシュ通知",
    description: "地域で共有された情報を、見守る家族へそっとお知らせします。",
    media: { kind: "broll", src: "cut04.mp4", playbackRate: 0.5 },
  },
  {
    index: 4,
    title: "きけんハンター",
    kicker: "子どもが自分で危険に気づく AI 探検",
    description: "通学路の写真を AI が読み解き、どこが危ないかを一緒に学びます。",
    media: { kind: "broll", src: "hunter_photo.mp4", playbackRate: 0.8 },
  },
  {
    index: 5,
    title: "通学路の安全ニュース",
    kicker: "毎日3分の安全チェック習慣",
    description: "編集部が毎日選ぶ全国の安全ニュース。家族で話すきっかけまで添えて届きます。",
    media: { kind: "phone", src: "mobile-news.png" },
  },
  {
    index: 6,
    title: "危険箇所レポート",
    kicker: "学校・PTA と共有できる PDF",
    description: "集まった気づきをレポートに。家庭の声を、地域の改善につなげます。",
    media: { kind: "broll", src: "cut08.mp4", playbackRate: 0.6 },
  },
]

export const TOTAL_FRAMES = TITLE_FRAMES + FEATURES.length * FEATURE_FRAMES + END_FRAMES

export const FeatureTour: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.charcoal }}>
      <Sequence durationInFrames={TITLE_FRAMES}>
        <TitleScene />
      </Sequence>
      {FEATURES.map((feature, i) => (
        <Sequence
          key={feature.index}
          from={TITLE_FRAMES + i * FEATURE_FRAMES}
          durationInFrames={FEATURE_FRAMES}
        >
          <FeatureScene {...feature} />
        </Sequence>
      ))}
      <Sequence from={TITLE_FRAMES + FEATURES.length * FEATURE_FRAMES} durationInFrames={END_FRAMES}>
        <EndScene />
      </Sequence>
    </AbsoluteFill>
  )
}
