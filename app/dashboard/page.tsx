import { redirect } from "next/navigation"
import DashboardContent from "@/components/dashboard/dashboard-content"
import { getCurrentUserAdminStatus } from "@/lib/admin-auth"

export default async function DashboardPage() {
  const { isAuthenticated, isAdmin } = await getCurrentUserAdminStatus()
  if (!isAuthenticated) {
    redirect("/login")
  }

  if (!isAdmin) {
    redirect("/map")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardContent />
    </div>
  )
}
