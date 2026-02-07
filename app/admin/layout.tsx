import React from "react"
import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { isAdminEmail } from "@/lib/admin"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!isAdminEmail(user.email)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      redirect("/map")
    }
  }

  return (
    <section>
      {children}
    </section>
  )
}
