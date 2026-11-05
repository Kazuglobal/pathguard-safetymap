import { AbsoluteFill, Sequence } from "remotion"
// 機能の名前・1行・数は紹介HPと同じ lib/product-facts.ts から読む(動画に直接書かない)
import { PRODUCT_FACTS, PRODUCT_FEATURES } from "../../../lib/product-facts"
import { EndScene } from "./scenes/EndScene"
import { FeatureScene } from "./scenes/FeatureScene"
import { TitleScene } from "./scenes/TitleScene"
import { END_FRAMES, FEATURE_FRAMES, PANEL_IN_FRAMES, theme, TITLE_FRAMES } from "./theme"
import { TOUR_MEDIA } from "./tour-media"

const SCENES = PRODUCT_FEATURES.map((feature, i) => {
  const media = TOUR_MEDIA[feature.key]
  if (!media) throw new Error(`機能ツアーの画面がありません: ${feature.key}`)
  return { index: i + 1, title: feature.title, kicker: feature.kicker, tourLine: feature.tourLine, media }
})

export const TOTAL_FRAMES = TITLE_FRAMES + SCENES.length * FEATURE_FRAMES + END_FRAMES

export const FeatureTour: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: theme.paper }}>
    <Sequence durationInFrames={TITLE_FRAMES + PANEL_IN_FRAMES}>
      <TitleScene featureCount={SCENES.length} />
    </Sequence>
    {SCENES.map((scene, i) => (
      // 次の場面は PANEL_IN_FRAMES だけ前から入り、紙を重ねるように覆う
      <Sequence key={scene.index} from={TITLE_FRAMES + i * FEATURE_FRAMES} durationInFrames={FEATURE_FRAMES + PANEL_IN_FRAMES}>
        <FeatureScene {...scene} />
      </Sequence>
    ))}
    <Sequence from={TITLE_FRAMES + SCENES.length * FEATURE_FRAMES} durationInFrames={END_FRAMES}>
      <EndScene note={PRODUCT_FACTS.freeNoInstall} />
    </Sequence>
  </AbsoluteFill>
)
