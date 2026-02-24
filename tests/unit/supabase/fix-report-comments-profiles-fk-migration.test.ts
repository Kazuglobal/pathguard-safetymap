import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260224000000_fix_report_comments_profiles_fk.sql"
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

describe("20260224000000_fix_report_comments_profiles_fk migration", () => {
  it("keeps comments when profile is deleted and enables profile RLS explicitly", () => {
    const sql = readMigration()

    expect(sql).toContain("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;")
    expect(sql).toContain("ALTER TABLE public.report_comments")
    expect(sql).toContain("ALTER COLUMN user_id DROP NOT NULL;")
    expect(sql).toContain("FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;")
    expect(sql).not.toContain("FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;")
  })

  it("does not expose profiles.email to authenticated clients", () => {
    const sql = readMigration()

    expect(sql).toContain("REVOKE SELECT (email) ON TABLE public.profiles FROM authenticated;")
    expect(sql).toContain("REVOKE SELECT (email) ON TABLE public.profiles FROM anon;")
  })
})
