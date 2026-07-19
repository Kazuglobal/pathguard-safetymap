import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import {
  depthRangeToRiskLevel,
  parseHazardImportArgs,
  runHazardZoneImport,
  streamHazardFeatures,
  type GeoJsonFeature,
  type HazardZoneImportClient,
} from "@/lib/hazard-zone-import"

function polygon(minX: number, minY: number, maxX: number, maxY: number) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
  }
}

function feature(index: number): GeoJsonFeature {
  return {
    type: "Feature",
    properties: {
      depth_min_m: index,
      depth_max_m: index + 0.5,
    },
    geometry: polygon(140 + index, 40 + index, 140.5 + index, 40.5 + index),
  }
}

describe("parseHazardImportArgs", () => {
  it("requires region and source provenance for coverage", () => {
    expect(() =>
      parseHazardImportArgs([
        "--file",
        "a.ndjson",
        "--hazardType",
        "flood",
        "--sourceLayer",
        "A31",
        "--defaultAreaContext",
        "riverside",
      ]),
    ).toThrow("--region")
  })

  it("parses the nationwide batch metadata", () => {
    expect(
      parseHazardImportArgs([
        "--file",
        "a.ndjson",
        "--hazardType",
        "flood",
        "--sourceLayer",
        "A31",
        "--defaultAreaContext",
        "riverside",
        "--region",
        "青森県",
        "--source",
        "国土数値情報 A31-12",
        "--batchSize",
        "2",
      ]),
    ).toMatchObject({
      regionLabel: "青森県",
      source: "国土数値情報 A31-12",
      batchSize: 2,
      inputFormat: "ndjson",
    })
  })
})

describe("streamHazardFeatures", () => {
  it("streams line-delimited features and accepts a FeatureCollection header", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hazard-import-"))
    const ndjsonPath = join(directory, "zones.ndjson")
    writeFileSync(
      ndjsonPath,
      [JSON.stringify(feature(0)), JSON.stringify(feature(1))].join("\n"),
      "utf8",
    )

    const streamed: GeoJsonFeature[] = []
    for await (const item of streamHazardFeatures(ndjsonPath, "ndjson")) {
      streamed.push(item)
    }
    expect(streamed).toHaveLength(2)

    const geoJsonPath = join(directory, "zones.geojson")
    writeFileSync(
      geoJsonPath,
      JSON.stringify({ type: "FeatureCollection", features: [feature(2)] }),
      "utf8",
    )
    const compatible: GeoJsonFeature[] = []
    for await (const item of streamHazardFeatures(geoJsonPath, "geojson")) {
      compatible.push(item)
    }
    expect(compatible).toHaveLength(1)
  })
})

describe("depthRangeToRiskLevel", () => {
  it.each([
    [0, 0.5, 1],
    [0.5, 3, 2],
    [3, 5, 3],
    [5, 10, 4],
    [10, null, 5],
  ])("maps %s..%s metres to level %s", (min, max, expected) => {
    expect(depthRangeToRiskLevel(min, max)).toBe(expected)
  })
})

describe("runHazardZoneImport", () => {
  it("replaces one region in batches and upserts its coverage envelope last", async () => {
    const deleteEq = vi.fn()
    const deleteContains = vi.fn(async () => ({ error: null }))
    const deleteBuilder = {
      eq: deleteEq,
      contains: deleteContains,
    }
    deleteEq.mockReturnValue(deleteBuilder)

    const insert = vi.fn(async () => ({ error: null }))
    const remove = vi.fn(() => deleteBuilder)
    const upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn((table: string) => {
      if (table === "hazard_zones") return { delete: remove, insert }
      if (table === "hazard_zone_coverage") return { upsert }
      throw new Error(`unexpected table ${table}`)
    })
    const client: HazardZoneImportClient = { from }

    async function* features() {
      yield feature(0)
      yield feature(1)
      yield feature(2)
    }

    const result = await runHazardZoneImport(client, {
      args: {
        filePath: "zones.ndjson",
        hazardType: "flood",
        sourceLayer: "A31",
        defaultAreaContext: "riverside",
        regionLabel: "青森県",
        source: "国土数値情報 A31-12",
        batchSize: 2,
        inputFormat: "ndjson",
      },
      features: features(),
    })

    expect(result).toEqual({ importedFeatures: 3 })
    expect(remove).toHaveBeenCalledOnce()
    expect(deleteEq).toHaveBeenCalledWith("hazard_type", "flood")
    expect(deleteEq).toHaveBeenCalledWith("source_layer", "A31")
    expect(deleteContains).toHaveBeenCalledWith("properties", {
      region_label: "青森県",
    })
    expect(insert).toHaveBeenCalledTimes(2)
    expect(insert.mock.calls[0][0]).toHaveLength(2)
    expect(insert.mock.calls[0][0][0].properties).toMatchObject({
      region_label: "青森県",
      source: "国土数値情報 A31-12",
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        hazard_type: "flood",
        region_label: "青森県",
        source_layer: "A31",
        imported_features: 3,
        coverage_geom: {
          type: "MultiPolygon",
          coordinates: [polygon(140, 40, 142.5, 42.5).coordinates],
        },
      }),
      { onConflict: "hazard_type,region_label,source_layer" },
    )
  })
})
