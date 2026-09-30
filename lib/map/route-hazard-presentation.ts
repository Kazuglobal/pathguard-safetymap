/**
 * 通学路ハザード(洪水・津波)の表示定義。
 * 地図マーカーとハザードパネルのトグルが同じ絵・色を使うための一元定義。
 *
 * 色は危険度ピン(黄〜赤)と報告地点ピン(みどり)を避け、洪水=水色・津波=紫にする。
 * 同系色(青と藍)にすると、ラベルの出ない広域表示で見分けにくい。
 * 色だけに頼らないよう、絵(しずく / 波)とラベルでも見分けられるようにしている。
 */

import { Droplets, Waves, type LucideIcon } from "lucide-react"

import type { HazardType } from "@/lib/types"

export interface RouteHazardPresentation {
  label: string
  colorHex: string
  icon: LucideIcon
}

const PRESENTATIONS: Record<HazardType, RouteHazardPresentation> = {
  flood: { label: "洪水", colorHex: "#0891b2", icon: Droplets }, // cyan-600
  tsunami: { label: "津波", colorHex: "#7e22ce", icon: Waves }, // purple-700
}

export function getRouteHazardPresentation(hazardType: HazardType): RouteHazardPresentation {
  return PRESENTATIONS[hazardType] ?? PRESENTATIONS.flood
}
