interface MapStyleLayer {
  id: string
  type?: string
}

interface MapStyleLike {
  getStyle(): { layers?: MapStyleLayer[] } | undefined
  getLayoutProperty(layerId: string, name: string): unknown
  setLayoutProperty(layerId: string, name: string, value: unknown): void
}

const JAPANESE_NAME_EXPRESSION = [
  "coalesce",
  ["get", "name_ja"],
  ["get", "name"],
] as const

const EXCLUDED_LABEL_LAYERS = /shield|road-number|road-exit|oneway/
const JAPANESE_NAME_SERIALIZED = JSON.stringify(JAPANESE_NAME_EXPRESSION)

/** Prefer Japanese map labels without repeatedly mutating an already-localized style. */
export function localizeMapLabels(map: MapStyleLike): void {
  const layers = map.getStyle()?.layers ?? []

  for (const layer of layers) {
    if (layer.type !== "symbol" || EXCLUDED_LABEL_LAYERS.test(layer.id)) continue

    const textField = map.getLayoutProperty(layer.id, "text-field")
    if (!textField) continue

    const serialized = JSON.stringify(textField)
    if (!serialized.includes("name") || serialized === JAPANESE_NAME_SERIALIZED) continue

    map.setLayoutProperty(layer.id, "text-field", JAPANESE_NAME_EXPRESSION)
  }
}
