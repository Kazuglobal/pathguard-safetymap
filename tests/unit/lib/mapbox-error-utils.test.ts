import { describe, expect, it } from "vitest"

import { classifyMapboxError } from "@/lib/mapbox-error-utils"

describe("classifyMapboxError", () => {
  it("treats MLIT hazard tile fetch failures as non-fatal overlay errors", () => {
    const result = classifyMapboxError({
      error: new Error(
        "Failed to fetch https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/11/1817/806.png",
      ),
      sourceId: "mlit-flood-source",
    })

    expect(result).toEqual({
      severity: "overlay",
      message: "ハザードマップの取得に失敗しました。時間をおいて再試行してください。",
    })
  })

  it("keeps generic Mapbox failures as fatal map errors", () => {
    const result = classifyMapboxError({
      error: new Error("Mapbox token is invalid"),
    })

    expect(result).toEqual({
      severity: "fatal",
      message: "Mapbox token is invalid",
    })
  })
})
