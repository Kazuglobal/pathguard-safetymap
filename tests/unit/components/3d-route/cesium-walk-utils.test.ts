import { describe, expect, it } from "vitest";
import { getNextWalkIndex } from "@/components/3d-route/cesium-walk-utils";

describe("getNextWalkIndex", () => {
  it("returns zero when route length is 0", () => {
    expect(getNextWalkIndex(0, 0)).toBe(0);
  });

  it("returns zero when route has one point", () => {
    expect(getNextWalkIndex(0, 1)).toBe(0);
  });

  it("moves to next point and wraps to start", () => {
    expect(getNextWalkIndex(0, 3)).toBe(1);
    expect(getNextWalkIndex(1, 3)).toBe(2);
    expect(getNextWalkIndex(2, 3)).toBe(0);
  });
});

