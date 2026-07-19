import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719120000_add_hazard_zone_image_gate.sql",
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

describe("20260719120000_add_hazard_zone_image_gate migration", () => {
  it("creates indexed coverage with authenticated read-only RLS", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.hazard_zone_coverage")
    expect(sql).toContain("coverage_geom geometry(MultiPolygon, 4326) NOT NULL")
    expect(sql).toContain(
      "UNIQUE (hazard_type, region_label, source_layer)",
    )
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS hazard_zone_coverage_geom_gist[\s\S]*?USING gist \(coverage_geom\)/,
    )
    expect(sql).toContain(
      "ALTER TABLE public.hazard_zone_coverage ENABLE ROW LEVEL SECURITY;",
    )
    expect(sql).toMatch(
      /CREATE POLICY "hazard_zone_coverage_select_authenticated"[\s\S]*?TO authenticated[\s\S]*?USING \(true\)/,
    )
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*?ON public\.hazard_zone_coverage[\s\S]*?FOR (?:INSERT|UPDATE|DELETE|ALL)/,
    )
  })

  it("creates an append-only service-role gate log without client policies", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.image_generation_gate_log")
    expect(sql).toContain("lat_rounded numeric(6,3)")
    expect(sql).toContain("lng_rounded numeric(6,3)")
    expect(sql).toContain(
      "ALTER TABLE public.image_generation_gate_log ENABLE ROW LEVEL SECURITY;",
    )
    const logSecurityClause = sql.match(
      /ALTER TABLE public\.image_generation_gate_log ENABLE ROW LEVEL SECURITY;[\s\S]*?CREATE INDEX IF NOT EXISTS hazard_zones_geography_gist/,
    )
    expect(logSecurityClause).not.toBeNull()
    expect(logSecurityClause?.[0]).not.toContain("CREATE POLICY")
  })

  it("creates a deterministic point lookup with Japan bounds and a 50 metre cap", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_hazard_zones_at_point(")
    expect(sql).toContain("SECURITY INVOKER")
    expect(sql).toContain("SET search_path = public")
    expect(sql).toContain("p_longitude BETWEEN 122 AND 154")
    expect(sql).toContain("p_latitude BETWEEN 20 AND 46")
    expect(sql).toContain("LEAST(GREATEST(COALESCE(p_tolerance_m, 0), 0), 50)")
    expect(sql).toContain("ST_Intersects(hz.geom, point_input.geom)")
    expect(sql).toContain("ST_DWithin(")
    expect(sql).toMatch(
      /ORDER BY hz\.risk_level DESC, hz\.depth_max_m DESC NULLS LAST, hz\.id/,
    )
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS hazard_zones_geography_gist[\s\S]*?USING gist \(\(geom::geography\)\)/,
    )
  })

  it("exposes the two read RPCs to authenticated clients and server routes", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_hazard_zones_at_point\(\s*double precision,\s*double precision,\s*text,\s*double precision\s*\) FROM PUBLIC;/,
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_hazard_zones_at_point\(\s*double precision,\s*double precision,\s*text,\s*double precision\s*\) TO authenticated, service_role;/,
    )
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.has_hazard_zone_coverage_at_point(",
    )
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.has_hazard_zone_coverage_at_point\(\s*double precision,\s*double precision,\s*text\s*\) FROM PUBLIC;/,
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.has_hazard_zone_coverage_at_point\(\s*double precision,\s*double precision,\s*text\s*\) TO authenticated, service_role;/,
    )
  })
})
