import type {
  HazardAreaContext,
  HazardScenarioOption,
  HazardType,
} from "@/lib/types"

export const HAZARD_TILE_CONFIG = {
  flood: {
    id: "hazard-flood",
    label: "洪水浸水想定",
    tileUrl:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
  },
  tsunami: {
    id: "hazard-tsunami",
    label: "津波浸水想定",
    tileUrl:
      "https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png",
  },
} as const

const AREA_LABELS: Record<HazardAreaContext, string> = {
  "residential-school-route": "住宅街の通学路",
  riverside: "河川沿い",
  coastal: "海岸近く",
}

const HAZARD_LABELS: Record<HazardType, string> = {
  flood: "洪水",
  tsunami: "津波",
}

const SCENARIOS: HazardScenarioOption[] = [
  {
    key: "standard-base",
    label: "標準シナリオ",
    description: "その地点の代表的な浸水状況を汎用的に表現します。",
    hazardTypes: ["flood", "tsunami"],
    allowedAreaContexts: ["residential-school-route", "riverside", "coastal"],
  },
  {
    key: "standard-residential",
    label: "住宅街シナリオ",
    description: "住宅街の通学路で起こる浸水状況を表現します。",
    hazardTypes: ["flood", "tsunami"],
    allowedAreaContexts: ["residential-school-route"],
  },
  {
    key: "standard-riverside",
    label: "河川沿いシナリオ",
    description: "川沿いの道や堤防付近の氾濫状況を表現します。",
    hazardTypes: ["flood"],
    allowedAreaContexts: ["riverside"],
  },
  {
    key: "standard-coastal",
    label: "海岸近くシナリオ",
    description: "海岸に近い住宅地や道路への津波浸水を表現します。",
    hazardTypes: ["tsunami"],
    allowedAreaContexts: ["coastal"],
  },
]

type HazardPromptParams = {
  hazardType: HazardType
  riskLevel: number
  depthMinMeters: number | null
  depthMaxMeters: number | null
  areaContext: HazardAreaContext
  scenarioKey: string
  locationLabel?: string
}

export function getHazardAreaLabel(areaContext: HazardAreaContext): string {
  return AREA_LABELS[areaContext]
}

export function getHazardTypeLabel(hazardType: HazardType): string {
  return HAZARD_LABELS[hazardType]
}

export function formatDepthLabel(
  depthMinMeters: number | null,
  depthMaxMeters: number | null,
): string {
  if (depthMinMeters == null && depthMaxMeters == null) {
    return "深さ情報なし"
  }

  if (depthMinMeters != null && depthMaxMeters != null) {
    return `${depthMinMeters.toFixed(1)}m〜${depthMaxMeters.toFixed(1)}m`
  }

  if (depthMinMeters != null) {
    return `${depthMinMeters.toFixed(1)}m以上`
  }

  return `${depthMaxMeters!.toFixed(1)}m以下`
}

export function getHazardScenarioOptions(params: {
  hazardType: HazardType
  areaContext: HazardAreaContext
}): HazardScenarioOption[] {
  return SCENARIOS.filter(
    (scenario) =>
      scenario.hazardTypes.includes(params.hazardType) &&
      scenario.allowedAreaContexts.includes(params.areaContext),
  )
}

function getScenarioNarrative(
  hazardType: HazardType,
  areaContext: HazardAreaContext,
  scenarioKey: string,
): string {
  if (scenarioKey === "standard-riverside") {
    return "A Japanese school route running beside a river, with muddy floodwater spreading from the river channel onto the roadway."
  }

  if (scenarioKey === "standard-coastal") {
    return "A Japanese coastal neighborhood school route with tsunami water surging inland across roads near the shoreline."
  }

  if (hazardType === "tsunami") {
    return "A Japanese residential school route affected by tsunami inundation, with water filling the street and covering familiar landmarks."
  }

  if (scenarioKey === "standard-base") {
    return "A Japanese school route during severe inundation, with realistic water coverage affecting the roadway and nearby surroundings."
  }

  if (areaContext === "residential-school-route") {
    return "A Japanese residential school route with homes, guardrails, and road signs partially submerged by floodwater."
  }

  return "A Japanese school route affected by inundation water in an educational disaster-preparedness scene."
}

export function buildHazardImagePrompt({
  hazardType,
  riskLevel,
  depthMinMeters,
  depthMaxMeters,
  areaContext,
  scenarioKey,
  locationLabel,
}: HazardPromptParams): string {
  const hazardLabel = hazardType === "flood" ? "river flooding" : "tsunami inundation"
  const areaLabel = locationLabel ?? getHazardAreaLabel(areaContext)
  const depthLabel =
    depthMinMeters != null && depthMaxMeters != null
      ? `${depthMinMeters.toFixed(1)}m to ${depthMaxMeters.toFixed(1)}m`
      : formatDepthLabel(depthMinMeters, depthMaxMeters)
  const narrative = getScenarioNarrative(hazardType, areaContext, scenarioKey)

  return [
    `${narrative}`,
    `Location context: ${areaLabel}.`,
    `Hazard: ${hazardLabel}.`,
    `Risk level ${riskLevel}, expected water depth ${depthLabel}.`,
    "Create a realistic educational safety illustration for disaster-preparedness learning in Japan.",
    "Show road features, guardrails, signs, and buildings affected by water at the described depth.",
    "Do not show people in immediate danger, injuries, gore, panic, or dead bodies.",
    "No text overlays, no watermark, no brand names.",
  ].join(" ")
}

export function buildHazardExplanation(params: {
  hazardType: HazardType
  depthLabel: string
}): string {
  if (params.hazardType === "tsunami") {
    return `この地点では津波による浸水が想定され、最大${params.depthLabel}の水深になる可能性があります。`
  }

  return `大雨や河川氾濫時、この地点では最大${params.depthLabel}の浸水が想定されます。`
}

export function getHazardEvacuationPoints(hazardType: HazardType): string[] {
  if (hazardType === "tsunami") {
    return [
      "避難場所と高台への経路を家族で確認しておく",
      "津波警報が出たら海や川から離れてすぐに避難する",
      "遠くへ逃げられない場合は高い建物への垂直避難を優先する",
    ]
  }

  return [
    "日頃から避難場所と安全な移動経路を確認しておく",
    "大雨や洪水警報が出たら早めに行動する",
    "周囲より高い場所や丈夫な建物の上階へ避難する",
  ]
}
