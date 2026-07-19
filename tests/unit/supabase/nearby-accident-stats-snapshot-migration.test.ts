import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260719070354_snapshot_get_nearby_accident_stats.sql",
)

describe("get_nearby_accident_stats snapshot migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8")

  it("captures the deployed function signature and security settings", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_nearby_accident_stats(p_latitude double precision, p_longitude double precision, p_radius_meters integer DEFAULT 200, p_years integer DEFAULT 5)",
    )
    expect(sql).toContain("RETURNS jsonb")
    expect(sql).toContain("LANGUAGE plpgsql")
    expect(sql).toContain("SECURITY DEFINER")
    expect(sql).toContain("SET search_path TO 'public'")
  })

  it("bounds caller-controlled parameters before any spatial query", () => {
    const validationEnd = sql.indexOf("v_point    :=")
    expect(validationEnd).toBeGreaterThan(0)
    const validation = sql.slice(0, validationEnd)
    expect(validation).toContain("p_radius_meters NOT BETWEEN 1 AND 1000")
    expect(validation).toContain("p_years NOT BETWEEN 1 AND 10")
    expect(validation).toContain("p_latitude NOT BETWEEN -90 AND 90")
    expect(validation).toContain("p_longitude IS NULL")
  })

  it("captures the deployed spatial, aggregate, and result contracts", () => {
    expect(sql).toContain("ST_DWithin")
    expect(sql).toContain("'total_accidents'")
    expect(sql).toContain("'by_time_of_day'")
    expect(sql).toContain("'by_accident_type'")
    expect(sql).toContain("'nearest_accidents'")
    expect(sql).toContain("'risk_score'")
    expect(sql).toContain("'search_params'")
  })

  it("removes the implicit PUBLIC grant and lists the intended roles", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC;/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]+TO anon, authenticated, service_role;/)
  })
})
