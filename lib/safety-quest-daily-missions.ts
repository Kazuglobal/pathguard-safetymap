import { CircleHelp, Shield, Target } from "lucide-react"

export const HAZARD_TARGET_COUNT = 3

export type DailyProgress = {
  hazardFinds: number
  quizCorrect: number
  clearedStages: number
}

export function getDailyMissions(progress: DailyProgress) {
  const hazardFinds = Math.min(progress.hazardFinds, HAZARD_TARGET_COUNT)
  const quizCorrect = Math.min(progress.quizCorrect, 2)

  return [
    {
      title: "あぶない場所を3つ見つけよう",
      progress: hazardFinds >= HAZARD_TARGET_COUNT ? "クリア!" : `${hazardFinds}/${HAZARD_TARGET_COUNT}`,
      reward: "+100pt",
      icon: Target,
      tint: "blue",
    },
    {
      title: "横断歩道をわたろう",
      progress: progress.clearedStages > 0 ? "クリア!" : "0/1",
      reward: "+80pt",
      icon: Shield,
      tint: "green",
    },
    {
      title: "クイズに2問こたえよう",
      progress: quizCorrect >= 2 ? "クリア!" : `${quizCorrect}/2`,
      reward: "+120pt",
      icon: CircleHelp,
      tint: "orange",
    },
  ]
}
