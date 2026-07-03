import { describe, expect, it, vi } from "vitest"

import { localizeMapLabels } from "@/lib/hunter/map-labels"

describe("localizeMapLabels", () => {
  it("localizes name labels while leaving excluded and non-name layers unchanged", () => {
    const fields = new Map<string, unknown>([
      ["place-label", ["get", "name"]],
      ["road-number-shield", ["get", "name"]],
      ["poi-icon", ["get", "icon"]],
    ])
    const setLayoutProperty = vi.fn((id: string, _name: string, value: unknown) => {
      fields.set(id, value)
    })
    const map = {
      getStyle: () => ({
        layers: [
          { id: "place-label", type: "symbol" },
          { id: "road-number-shield", type: "symbol" },
          { id: "poi-icon", type: "symbol" },
          { id: "background", type: "background" },
        ],
      }),
      getLayoutProperty: (id: string) => fields.get(id),
      setLayoutProperty,
    }

    localizeMapLabels(map)

    expect(setLayoutProperty).toHaveBeenCalledOnce()
    expect(setLayoutProperty).toHaveBeenCalledWith("place-label", "text-field", [
      "coalesce",
      ["get", "name_ja"],
      ["get", "name"],
    ])
  })

  it("does not mutate a style again after labels are localized", () => {
    let textField: unknown = ["get", "name"]
    const setLayoutProperty = vi.fn((_id: string, _name: string, value: unknown) => {
      textField = value
    })
    const map = {
      getStyle: () => ({ layers: [{ id: "place-label", type: "symbol" }] }),
      getLayoutProperty: () => textField,
      setLayoutProperty,
    }

    localizeMapLabels(map)
    localizeMapLabels(map)

    expect(setLayoutProperty).toHaveBeenCalledOnce()
  })
})
