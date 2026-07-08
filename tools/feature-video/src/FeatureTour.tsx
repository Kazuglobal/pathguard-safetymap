import { AbsoluteFill, Sequence } from "remotion"
import { END_FRAMES, FEATURE_FRAMES, TITLE_FRAMES, theme } from "./theme"
import { TitleScene } from "./scenes/TitleScene"
import { FeatureScene, type FeatureSceneProps } from "./scenes/FeatureScene"
import { EndScene } from "./scenes/EndScene"

const FEATURES: FeatureSceneProps[] = [
  {
    index: 1,
    title: "写真でキケンを見える化",
    kicker: "いちばんの目玉。写真をとるだけ",
    description: "AI が写真から危険箇所と安全設備を検出して色分け描画。安全スコアも算出します。",
    media: { kind: "phone", src: "phone-hunter-result.png" },
  },
  {
    index: 2,
    title: "危険マップ",
    kicker: "地域の目が集めた危険を、地図の上に",
    description: "ヒヤリハット報告が地図のピンになり、通学路の危険をひと目で確認できます。",
    media: { kind: "browser", src: "desktop-map-tokyo.png" },
  },
  {
    index: 3,
    title: "事故ヒートマップ",
    kicker: "警察庁オープンデータで事故を見える化",
    description: "事故が多い道をひと目で把握。地点ごとの事故リスクスコアも確認できます。",
    media: { kind: "browser", src: "desktop-heatmap-tokyo.png" },
  },
  {
    index: 4,
    title: "ハザードマップ",
    kicker: "自分の地域の災害リスクを手軽にデジタルで",
    description: "洪水・津波の浸水想定をいつもの地図に重ねて、通学路とあわせて確認できます。",
    media: { kind: "browser", src: "desktop-hazard-tokyo.png" },
  },
  {
    index: 5,
    title: "みんなのヒヤリハット報告",
    kicker: "地域の気づきを、一覧でみんなと共有",
    description: "地域から寄せられた報告をリストで確認。AI と運営の審査済みの情報だけが並びます。",
    media: { kind: "phone", src: "phone-report-list.png" },
  },
  {
    index: 6,
    title: "かんたん3ステップ報告",
    kicker: "子どもと一緒に使えるやさしい画面",
    description: "場所を選んで3ステップで報告。あなたの気づきが、地域のみんなを守ります。",
    media: { kind: "phone", src: "phone-report-wizard.png" },
  },
  {
    index: 7,
    title: "不審者アラート",
    kicker: "声かけ・不審者情報をプッシュ通知",
    description: "地域で共有された情報を、見守る家族へそっとお知らせします。",
    media: { kind: "broll", src: "cut04.mp4", playbackRate: 0.5 },
  },
  {
    index: 8,
    title: "通学路の安全ニュース",
    kicker: "毎日3分の安全チェック習慣",
    description: "編集部が毎日選ぶ全国の安全ニュース。家族で話すきっかけまで添えて届きます。",
    media: { kind: "phone", src: "phone-news.png" },
  },
  {
    index: 9,
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
