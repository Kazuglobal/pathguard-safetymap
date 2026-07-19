import crypto from "node:crypto"
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

  it("matches the pg_get_functiondef snapshot exported on 2026-07-19", () => {
    const captured = sql.match(/(CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$);/)?.[1]
    expect(captured).toBeDefined()

    const normalizedDefinition = `${captured!.replace(/\r\n/g, "\n")}\n`
    expect(normalizedDefinition).toHaveLength(15_547)
    expect(crypto.createHash("md5").update(normalizedDefinition).digest("hex")).toBe(
      "2678dd4eef67d6ca671f753a6a789d5d",
    )
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

  it("preserves the deployed execute privileges", () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_nearby_accident_stats\([^)]+\) TO PUBLIC, anon, authenticated, service_role;/,
    )
  })
})
