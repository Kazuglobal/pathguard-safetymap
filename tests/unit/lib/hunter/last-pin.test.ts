import { describe, expect, it } from "vitest"

import { lastPinStorageKey, loadLastPin, saveLastPin } from "@/lib/hunter/last-pin"

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    map,
  }
}

describe("hunter last pin memory (per user, device-local)", () => {
  it("round-trips a valid pin under the user's own key and ignores junk", () => {
    const storage = memoryStorage()
    saveLastPin("user-a", { latitude: 33.59, longitude: 130.4 }, storage)
    expect(loadLastPin("user-a", storage)).toEqual({ latitude: 33.59, longitude: 130.4 })
    expect(storage.map.get(lastPinStorageKey("user-a"))).toContain("33.59")

    expect(loadLastPin("user-a", memoryStorage({ [lastPinStorageKey("user-a")]: "not json" }))).toBeNull()
    expect(loadLastPin("user-a", memoryStorage({ [lastPinStorageKey("user-a")]: JSON.stringify({ latitude: 999, longitude: 1 }) }))).toBeNull()
    expect(loadLastPin("user-a", null)).toBeNull()
  })

  it("never shows another account's pin on a shared device and stores nothing without a user", () => {
    const storage = memoryStorage()
    saveLastPin("user-a", { latitude: 33.59, longitude: 130.4 }, storage)
    expect(loadLastPin("user-b", storage)).toBeNull()
    expect(loadLastPin(null, storage)).toBeNull()

    saveLastPin(null, { latitude: 1, longitude: 1 }, storage)
    saveLastPin("user-a", { latitude: 91, longitude: 0 }, storage)
    expect(storage.map.size).toBe(1)
  })
})
