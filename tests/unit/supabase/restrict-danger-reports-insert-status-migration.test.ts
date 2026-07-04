import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260704090000_restrict_danger_reports_insert_status.sql"
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

describe("20260704090000_restrict_danger_reports_insert_status migration", () => {
  it("recreates the danger_reports_insert policy", () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "danger_reports_insert" ON public.danger_reports;')
    expect(sql).toContain('CREATE POLICY "danger_reports_insert" ON public.danger_reports')
  })

  it("still requires the inserted row to belong to the authenticated user", () => {
    const sql = readMigration()

    expect(sql).toContain("user_id = (SELECT auth.uid())")
  })

  it("restricts non-admin inserts to status = 'pending'", () => {
    const sql = readMigration()

    expect(sql).toContain("status = 'pending'")
  })

  it("allows admins to bypass the pending-only restriction using the existing role check pattern", () => {
    const sql = readMigration()

    expect(sql).toContain("SELECT 1 FROM profiles")
    expect(sql).toContain("WHERE id = (SELECT auth.uid()) AND role = 'admin'")
  })
})
