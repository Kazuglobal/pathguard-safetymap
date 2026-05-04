import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260224000000_fix_report_comments_profiles_fk.sql"
)
const profileRoleHardeningMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260505000000_harden_profiles_role_insert.sql"
)

function readMigration(): string {
  return readFileSync(migrationPath, "utf8")
}

function readProfileRoleHardeningMigration(): string {
  return readFileSync(profileRoleHardeningMigrationPath, "utf8")
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

describe("20260505000000_harden_profiles_role_insert migration", () => {
  it("prevents authenticated users from inserting profiles.role", () => {
    const sql = readProfileRoleHardeningMigration()

    expect(sql).toContain("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;")
    expect(sql).toContain("ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';")
    expect(sql).toContain("REVOKE INSERT ON TABLE public.profiles FROM authenticated;")
    expect(sql).toContain("REVOKE INSERT ON TABLE public.profiles FROM anon;")
    expect(sql).toContain(
      "GRANT INSERT (id, email, display_name, full_name, avatar_url, updated_at)"
    )
    expect(sql).not.toContain("GRANT INSERT (role")
  })

  it("keeps profile self-create but forbids admin role self-promotion", () => {
    const sql = readProfileRoleHardeningMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;')
    expect(sql).toContain('DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;')
    expect(sql).toContain('CREATE POLICY "profiles_insert_own_safe"')
    expect(sql).toContain("id = (SELECT auth.uid())")
    expect(sql).toContain("email = (SELECT auth.email())")
    expect(sql).toContain("COALESCE(role, 'user') <> 'admin'")
  })
})
