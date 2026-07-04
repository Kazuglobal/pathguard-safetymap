import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260704090300_restrict_public_read_and_storage.sql"
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

describe("20260704090300_restrict_public_read_and_storage migration", () => {
  it("closes anon SELECT on the danger_reports base table", () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "danger_reports_select" ON public.danger_reports;')
    expect(sql).toContain('CREATE POLICY "danger_reports_select" ON public.danger_reports')
    expect(sql).toMatch(/CREATE POLICY "danger_reports_select"[\s\S]*?TO authenticated/)
  })

  it("still allows owners and admins to read their own rows via the base table", () => {
    const sql = readMigration()

    expect(sql).toContain("user_id = (SELECT auth.uid())")
    expect(sql).toContain("WHERE id = (SELECT auth.uid()) AND role = 'admin'")
  })

  it("creates a preview view (without security_invoker) with grid-rounded coordinates", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE VIEW public.danger_reports_public_preview")
    // security_invoker=true would make the view evaluate against the caller's
    // (anon) privileges, which have no SELECT policy on the base table and
    // would make the view always return zero rows. The CREATE VIEW statement
    // itself must NOT set it, so the view runs with the owner's privileges and
    // only its own WHERE clause gates anonymous access. (Explanatory SQL
    // comments elsewhere in the file are allowed to mention the term, so this
    // checks only the CREATE VIEW ... AS clause, not the whole file.)
    const createViewClause = sql.match(/CREATE VIEW public\.danger_reports_public_preview[\s\S]*?AS\b/)
    expect(createViewClause).not.toBeNull()
    expect(createViewClause?.[0]).not.toContain("security_invoker")
    expect(sql).toContain("ROUND((latitude / 0.01)::numeric) * 0.01 AS latitude")
    expect(sql).toContain("ROUND((longitude / 0.01)::numeric) * 0.01 AS longitude")
    expect(sql).toContain("GRANT SELECT ON public.danger_reports_public_preview TO anon, authenticated;")
  })

  it("does not expose user_id from the preview view", () => {
    const sql = readMigration()
    const viewMatch = sql.match(/CREATE VIEW public\.danger_reports_public_preview[\s\S]*?FROM public\.danger_reports/)
    expect(viewMatch).not.toBeNull()
    expect(viewMatch?.[0]).not.toContain("user_id")
  })

  it("does not expose image columns from the preview view (storage bucket is non-public)", () => {
    const sql = readMigration()
    const viewMatch = sql.match(/CREATE VIEW public\.danger_reports_public_preview[\s\S]*?FROM public\.danger_reports/)
    expect(viewMatch).not.toBeNull()
    expect(viewMatch?.[0]).not.toContain("image_url")
    expect(viewMatch?.[0]).not.toContain("processed_image_url")
    expect(viewMatch?.[0]).not.toContain("processed_image_urls")
  })

  it("restricts danger_spots SELECT to authenticated", () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "danger_spots_select_policy" ON public.danger_spots;')
    expect(sql).toMatch(/CREATE POLICY "danger_spots_select_policy"[\s\S]*?TO authenticated/)
  })

  it("restricts the danger-reports storage bucket read policy to authenticated", () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "danger_reports_select_public" ON storage.objects;')
    expect(sql).toMatch(/CREATE POLICY "danger_reports_select_authenticated"[\s\S]*?TO authenticated/)
    expect(sql).toContain("bucket_id = 'danger-reports'")
  })

  it("flips the danger-reports bucket to non-public", () => {
    const sql = readMigration()

    expect(sql).toContain("UPDATE storage.buckets")
    expect(sql).toMatch(/SET public = false\s*\nWHERE id = 'danger-reports';/)
  })
})
