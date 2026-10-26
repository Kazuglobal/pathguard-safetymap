/**
 * Danger Type Presentation
 *
 * 危険の種類(danger_type)の表示定義を一元化するモジュール。
 * 地図ピン・凡例・サイドバー・投稿ウィザード・ヘルプのすべてがここを参照する。
 * 「投稿で選んだ絵」と「地図に立つ絵」がずれると種類が読み取れなくなるため、
 * 各画面でローカルの switch / if 連鎖を作らないこと。
 *
 * 色は持たせない: 地図上の色は危険度(danger-level-presentation.ts)が正で、
 * 種類は絵とラベルで見分ける。
 */

import { Car, CircleAlert, CloudRainWind, Siren, UserX, type LucideIcon } from "lucide-react"

export type DangerTypeId = "traffic" | "crime" | "disaster" | "suspicious" | "other"

export interface DangerTypePresentation {
  id: DangerTypeId
  /** 短いラベル(例: 交通) */
  label: string
  /** 凡例・ヘルプ用の補足(例: くるま・じてんしゃ) */
  hint: string
  icon: LucideIcon
}

const PRESENTATIONS: Record<DangerTypeId, DangerTypePresentation> = {
  traffic: { id: "traffic", label: "交通", hint: "くるま・じてんしゃ", icon: Car },
  crime: { id: "crime", label: "犯罪", hint: "こわい ひと・ばしょ", icon: Siren },
  disaster: { id: "disaster", label: "災害", hint: "みず・じしん・くずれ", icon: CloudRainWind },
  suspicious: { id: "suspicious", label: "不審者", hint: "ふしんしゃの もくげき", icon: UserX },
  other: { id: "other", label: "その他", hint: "きになる こと", icon: CircleAlert },
}

/** 凡例などで並べる順 */
export const DANGER_TYPE_ORDER: readonly DangerTypeId[] = [
  "traffic",
  "crime",
  "disaster",
  "suspicious",
  "other",
]

function isDangerTypeId(type: string): type is DangerTypeId {
  return Object.prototype.hasOwnProperty.call(PRESENTATIONS, type)
}

/** 未知の種類は「その他」として表示する */
export function getDangerTypePresentation(type: string | null | undefined): DangerTypePresentation {
  return type && isDangerTypeId(type) ? PRESENTATIONS[type] : PRESENTATIONS.other
}
