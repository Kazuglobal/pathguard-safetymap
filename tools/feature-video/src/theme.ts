import { loadFont as loadZenMaru } from "@remotion/google-fonts/ZenMaruGothic"
import { loadFont as loadZenKaku } from "@remotion/google-fonts/ZenKakuGothicNew"
import { Easing } from "remotion"

/** signature easing: cubic-bezier(0.16, 1, 0.3, 1)。主要な動きはすべてこれ */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1)
export const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1)

const zenMaru = loadZenMaru("normal", {
  weights: ["700", "900"],
  subsets: ["japanese", "latin"],
})
const zenKaku = loadZenKaku("normal", {
  weights: ["500", "700"],
  subsets: ["japanese", "latin"],
})

// HP(/lp)と共通の「親子チック」トークン: 暖かいクリーム×チャコール、丸ゴシック極太、
// ステッカー風のオフセット影。AI的な発光・ホログラム表現は使わない
export const theme = {
  paper: "#F3EFE4",
  ink: "#2B2723",
  inkSoft: "rgba(43, 39, 35, 0.72)",
  charcoal: "#26221E",
  amber: "#E8A33D",
  amberDark: "#C77E1B",
  green: "#2FA36B",
  coral: "#E96D4F",
  water: "#5AA9E6",
  white: "#FFFDF8",
  stickerShadow: "8px 8px 0 rgba(43, 39, 35, 0.9)",
  fontBody: zenKaku.fontFamily,
  fontDisplay: zenMaru.fontFamily,
} as const

export const FPS = 30
export const WIDTH = 1280
export const HEIGHT = 720

// 仕様: タイトル3秒・機能5秒×11・エンド4秒 = 約62秒
export const TITLE_FRAMES = 90
export const FEATURE_FRAMES = 150
export const END_FRAMES = 120
/** 次の場面の紙パネルが前の場面に重なって入る長さ(signature transition) */
export const PANEL_IN_FRAMES = 12
