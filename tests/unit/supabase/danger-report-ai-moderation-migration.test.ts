import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718090000_add_danger_report_ai_moderation.sql",
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

describe("20260718090000_add_danger_report_ai_moderation migration", () => {
  it("rejects legacy or unknown moderation statuses before adding the constraint", () => {
    const sql = readMigration()

    expect(sql).toContain("danger_reports_ai_moderation_status_check")
    expect(sql).toMatch(
      /ai_moderation_status\s+IN\s*\(\s*'pending',\s*'approved',\s*'needs_review',\s*'escalated'\s*\)/i,
    )
    expect(sql).toContain("RAISE EXCEPTION")
  })

  it("restricts non-admin inserts to an unset or pending moderation status", () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "danger_reports_insert" ON public.danger_reports;')
    expect(sql).toContain('CREATE POLICY "danger_reports_insert" ON public.danger_reports')
    expect(sql).toContain("user_id = (SELECT auth.uid())")
    expect(sql).toMatch(
      /status\s*=\s*'pending'[\s\S]*ai_moderation_status\s+IS\s+NULL[\s\S]*ai_moderation_status\s*=\s*'pending'/i,
    )
    expect(sql).toContain("WHERE id = (SELECT auth.uid()) AND role = 'admin'")
  })

  it("creates an RLS-protected append-only moderation log with an indexed foreign key", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE TABLE public.danger_report_moderation_log")
    expect(sql).toContain("REFERENCES public.danger_reports(id) ON DELETE CASCADE")
    expect(sql).toContain("ALTER TABLE public.danger_report_moderation_log ENABLE ROW LEVEL SECURITY")
    expect(sql).toContain("idx_danger_report_moderation_log_report_id")
    expect(sql).not.toMatch(
      /CREATE POLICY\s+\S+\s+ON\s+public\.danger_report_moderation_log/i,
    )
  })

  it("creates partial indexes matching the sweep and escalation predicates", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE INDEX idx_danger_reports_moderation_sweep[\s\S]*WHERE status = 'pending'[\s\S]*ai_moderation_status IS NULL[\s\S]*OR ai_moderation_status = 'pending'/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX idx_danger_reports_escalated[\s\S]*WHERE ai_moderation_status = 'escalated'/i,
    )
  })

  it("updates the moderation status column comment to the constrained value set", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.danger_reports\.ai_moderation_status[\s\S]*pending[\s\S]*approved[\s\S]*needs_review[\s\S]*escalated/i,
    )
  })

  it("provides one atomic image update that reopens an AI-approved report", () => {
    const sql = readMigration()

    expect(sql).toContain("set_danger_report_image")
    expect(sql).toMatch(
      /UPDATE public\.danger_reports[\s\S]*image_url[\s\S]*processed_image_urls/i,
    )
    expect(sql).toMatch(
      /status = CASE[\s\S]*ai_moderation_status = 'approved' THEN 'pending'/i,
    )
    expect(sql).toMatch(
      /ai_moderation_status[\s\S]*CASE[\s\S]*'approved'[\s\S]*'needs_review'/i,
    )
  })
})
