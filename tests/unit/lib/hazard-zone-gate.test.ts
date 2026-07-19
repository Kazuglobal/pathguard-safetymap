import { describe, expect, it, vi } from "vitest"

import {
  getHazardGateMessage,
  getHazardGateMode,
  getHazardGateReason,
  logHazardGateVerdict,
  parseHazardPoint,
  queryAndLogHazardGate,
  queryHazardGate,
  resolveHazardGate,
  shouldRejectHazardGate,
  type HazardGateClient,
  type HazardGateLogClient,
  type HazardGateRpcClient,
  type HazardZoneRpcRow,
} from "@/lib/hazard-zone-gate"

const point = { longitude: 140.74, latitude: 40.82 }

function zone(overrides: Partial<HazardZoneRpcRow> = {}): HazardZoneRpcRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    hazard_type: "flood",
    source_layer: "A31",
    risk_level: 2,
    depth_min_m: 0.5,
    depth_max_m: 3,
    area_context: "riverside",
    ...overrides,
  }
}

describe("resolveHazardGate", () => {
  it("returns the highest-risk matching zone from server rows", () => {
    const verdict = resolveHazardGate(
      [
        zone({ risk_level: 2, depth_max_m: 5 }),
        zone({
          id: "00000000-0000-0000-0000-000000000002",
          risk_level: 4,
          depth_min_m: 5,
          depth_max_m: 10,
        }),
      ],
      true,
      point,
      "flood",
    )

    expect(verdict).toEqual({
      kind: "inside",
      zone: {
        zoneId: "00000000-0000-0000-0000-000000000002",
        hazardType: "flood",
        riskLevel: 4,
        depthMinMeters: 5,
        depthMaxMeters: 10,
        areaContext: "riverside",
        sourceLayer: "A31",
      },
    })
  })

  it("uses depth and then id as deterministic tie breakers", () => {
    const verdict = resolveHazardGate(
      [
        zone({ id: "b", risk_level: 3, depth_max_m: 3 }),
        zone({ id: "c", risk_level: 3, depth_max_m: 5 }),
        zone({ id: "a", risk_level: 3, depth_max_m: 5 }),
      ],
      true,
      point,
      "flood",
    )

    expect(verdict.kind).toBe("inside")
    if (verdict.kind === "inside") {
      expect(verdict.zone.zoneId).toBe("a")
    }
  })

  it("returns outside only when coverage exists without a zone hit", () => {
    expect(resolveHazardGate([], true, point, "flood")).toEqual({
      kind: "outside",
    })
  })

  it("returns no_coverage when the point is not covered or is outside Japan", () => {
    expect(resolveHazardGate([], false, point, "flood")).toEqual({
      kind: "no_coverage",
    })
    expect(
      resolveHazardGate(
        [zone()],
        true,
        { longitude: 0, latitude: 0 },
        "flood",
      ),
    ).toEqual({ kind: "no_coverage" })
  })

  it("fails closed when either RPC result is unavailable or malformed", () => {
    expect(resolveHazardGate(null, true, point, "flood")).toEqual({
      kind: "unavailable",
    })
    expect(resolveHazardGate([], null, point, "flood")).toEqual({
      kind: "unavailable",
    })
    expect(
      resolveHazardGate([zone({ risk_level: 9 })], true, point, "flood"),
    ).toEqual({ kind: "unavailable" })
  })
})

describe("queryHazardGate", () => {
  it("queries zone and coverage RPCs with server-owned parameters", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_hazard_zones_at_point") {
        return { data: [zone()], error: null }
      }
      return { data: true, error: null }
    })
    const client: HazardGateRpcClient = { rpc }

    const verdict = await queryHazardGate(client, point, "flood", {
      toleranceMeters: 30,
    })

    expect(verdict.kind).toBe("inside")
    expect(rpc).toHaveBeenNthCalledWith(1, "get_hazard_zones_at_point", {
      p_longitude: point.longitude,
      p_latitude: point.latitude,
      p_hazard_type: "flood",
      p_tolerance_m: 30,
    })
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "has_hazard_zone_coverage_at_point",
      {
        p_longitude: point.longitude,
        p_latitude: point.latitude,
        p_hazard_type: "flood",
      },
    )
  })

  it("returns unavailable on an RPC error or timeout", async () => {
    const failingClient: HazardGateRpcClient = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "db down" } })),
    }
    await expect(queryHazardGate(failingClient, point, "flood")).resolves.toEqual({
      kind: "unavailable",
    })

    const never = new Promise<never>(() => undefined)
    const stalledClient: HazardGateRpcClient = {
      rpc: vi.fn(() => never),
    }
    await expect(
      queryHazardGate(stalledClient, point, "flood", { timeoutMs: 5 }),
    ).resolves.toEqual({ kind: "unavailable" })
  })
})

describe("parseHazardPoint", () => {
  it("parses finite form values without turning missing fields into zero", () => {
    expect(parseHazardPoint("140.74", "40.82")).toEqual(point)
    expect(parseHazardPoint(null, null)).toBeNull()
    expect(parseHazardPoint("", "")).toBeNull()
    expect(parseHazardPoint("Infinity", "40.82")).toBeNull()
  })
})

describe("queryAndLogHazardGate", () => {
  it("does not touch RPC or logging clients in off mode", async () => {
    const rpc = vi.fn()
    const from = vi.fn()
    const client = { rpc, from } as unknown as HazardGateClient

    await expect(queryAndLogHazardGate(client, {
      route: "generate-image",
      mode: "off",
      situation: "flood",
      point,
      userId: "user-1",
      hazardType: "flood",
    })).resolves.toEqual({ kind: "unavailable" })
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it("logs missing coordinates as unavailable without calling RPC", async () => {
    const rpc = vi.fn()
    const insert = vi.fn(async () => ({ error: null }))
    const client: HazardGateClient = {
      rpc,
      from: vi.fn(() => ({ insert })),
    }

    await expect(queryAndLogHazardGate(client, {
      route: "generate-prompts",
      mode: "enforce",
      situation: "flood",
      point: null,
      userId: "user-1",
      hazardType: "flood",
    })).resolves.toEqual({ kind: "unavailable" })
    expect(rpc).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      verdict: "unavailable",
      lat_rounded: null,
      lng_rounded: null,
    }))
  })

  it("queries and writes one audit verdict through the shared helper", async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const client: HazardGateClient = {
      rpc: vi.fn(async (name: string) => name === "get_hazard_zones_at_point"
        ? { data: [zone()], error: null }
        : { data: true, error: null }),
      from: vi.fn(() => ({ insert })),
    }

    const verdict = await queryAndLogHazardGate(client, {
      route: "generate-prompts",
      mode: "log",
      situation: "flood",
      point,
      userId: "user-1",
      hazardType: "flood",
      toleranceMeters: 0,
    })

    expect(verdict.kind).toBe("inside")
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      route: "generate-prompts",
      mode: "log",
      verdict: "inside",
    }))
  })
})

describe("getHazardGateMessage", () => {
  it("keeps outside distinct from a safety guarantee", () => {
    expect(getHazardGateMessage({ kind: "outside" }, "flood")).toContain(
      "区域外であることは安全を保証するものではありません",
    )
  })

  it("provides distinct coverage and availability messages", () => {
    expect(getHazardGateMessage({ kind: "no_coverage" }, "flood")).toContain(
      "ハザードマップデータは準備中",
    )
    expect(getHazardGateMessage({ kind: "unavailable" }, "flood")).toContain(
      "浸水想定の確認ができない",
    )
  })

  it("formats the inside depth range without claiming image depth", () => {
    expect(
      getHazardGateMessage(
        resolveHazardGate([zone()], true, point, "flood"),
        "flood",
      ),
    ).toBe("洪水浸水想定区域内（想定浸水深 0.5〜3.0m）")
  })
})

describe("hazard gate rollout mode", () => {
  it("defaults invalid or missing values to off", () => {
    expect(getHazardGateMode(undefined)).toBe("off")
    expect(getHazardGateMode("unexpected")).toBe("off")
    expect(getHazardGateMode("log")).toBe("log")
    expect(getHazardGateMode("enforce")).toBe("enforce")
  })

  it("rejects non-inside verdicts only in enforce mode", () => {
    expect(shouldRejectHazardGate("log", { kind: "outside" })).toBe(false)
    expect(shouldRejectHazardGate("enforce", { kind: "inside", zone: {
      zoneId: "zone-1",
      hazardType: "flood",
      riskLevel: 2,
      depthMinMeters: 0.5,
      depthMaxMeters: 3,
      areaContext: "riverside",
      sourceLayer: "A31",
    } })).toBe(false)
    expect(shouldRejectHazardGate("enforce", { kind: "outside" })).toBe(true)
    expect(getHazardGateReason({ kind: "no_coverage" })).toBe("no_coverage")
  })
})

describe("logHazardGateVerdict", () => {
  it("rounds coordinates and records the server-selected zone", async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const client: HazardGateLogClient = {
      from: vi.fn(() => ({ insert })),
    }
    const verdict = resolveHazardGate([zone()], true, point, "flood")

    await logHazardGateVerdict(client, {
      route: "hazard-image",
      mode: "log",
      situation: "flood",
      verdict,
      point: { longitude: 140.74149, latitude: 40.82151 },
      userId: "user-1",
      latencyMs: 12.8,
    })

    expect(insert).toHaveBeenCalledWith({
      route: "hazard-image",
      mode: "log",
      situation: "flood",
      verdict: "inside",
      zone_id: "00000000-0000-0000-0000-000000000001",
      lat_rounded: 40.822,
      lng_rounded: 140.741,
      user_id: "user-1",
      latency_ms: 13,
    })
  })

  it("does nothing in off mode and swallows logging failures", async () => {
    const insert = vi.fn(async () => ({ error: new Error("log unavailable") }))
    const client: HazardGateLogClient = {
      from: vi.fn(() => ({ insert })),
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await logHazardGateVerdict(client, {
      route: "generate-image",
      mode: "off",
      situation: "flood",
      verdict: { kind: "outside" },
      point,
      userId: "user-1",
      latencyMs: 1,
    })
    expect(insert).not.toHaveBeenCalled()

    await logHazardGateVerdict(client, {
      route: "generate-image",
      mode: "enforce",
      situation: "flood",
      verdict: { kind: "outside" },
      point,
      userId: "user-1",
      latencyMs: 1,
    })
    expect(insert).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("does not block the request when audit logging stalls", async () => {
    const insert = vi.fn(() => new Promise<{ error: unknown }>(() => undefined))
    const client: HazardGateLogClient = {
      from: vi.fn(() => ({ insert })),
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(logHazardGateVerdict(client, {
      route: "generate-image",
      mode: "log",
      situation: "flood",
      verdict: { kind: "unavailable" },
      point,
      userId: "user-1",
      latencyMs: 1,
      timeoutMs: 5,
    })).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
