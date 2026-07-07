import { Composition } from "remotion"
import { FeatureTour, TOTAL_FRAMES } from "./FeatureTour"
import { FPS, HEIGHT, WIDTH } from "./theme"

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FeatureTour"
      component={FeatureTour}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  )
}
