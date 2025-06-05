import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import DashboardContent from "@/components/dashboard/dashboard-content"

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user profile to check if admin
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    redirect("/map")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardContent />
    </div>
  )
}
