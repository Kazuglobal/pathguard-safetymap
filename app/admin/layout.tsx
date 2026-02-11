import React from "react"
import { redirect } from "next/navigation"
import { getCurrentUserAdminStatus } from "@/lib/admin-auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isAdmin } = await getCurrentUserAdminStatus()
  if (!isAuthenticated) {
    redirect("/login")
  }

  if (!isAdmin) {
    redirect("/map")
  }

  return (
    <section>
      {children}
    </section>
  )
}
