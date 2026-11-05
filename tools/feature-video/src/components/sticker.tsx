import { Lottie, type LottieAnimationData } from "@remotion/lottie"
import { useEffect, useState } from "react"
import { cancelRender, continueRender, delayRender, Sequence, staticFile } from "remotion"
import type { TourOverlay } from "../tour-media"

const FILES: Record<TourOverlay, string> = {
  pins: "lottie/pin-drop.json",
  water: "lottie/water-rise.json",
  stars: "lottie/stars-pop.json",
}

/** 画面の外に貼る Lottie のステッカー(実画面の上には重ねない)。from フレームから再生し、最後で止まる */
export const Sticker: React.FC<{ kind: TourOverlay; from: number; size?: number }> = ({ kind, from, size = 150 }) => {
  const [data, setData] = useState<LottieAnimationData | null>(null)
  const [handle] = useState(() => delayRender(`lottie ${kind}`))

  useEffect(() => {
    fetch(staticFile(FILES[kind]))
      .then((res) => res.json())
      .then((json: LottieAnimationData) => {
        setData(json)
        continueRender(handle)
      })
      .catch((err) => cancelRender(err))
  }, [handle, kind])

  if (!data) return null
  return (
    <Sequence from={from} layout="none">
      <div style={{ width: size, height: size }}>
        <Lottie animationData={data} loop={false} />
      </div>
    </Sequence>
  )
}
