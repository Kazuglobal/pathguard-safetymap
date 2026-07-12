import { redirect } from "next/navigation"
import UserDashboard from "@/components/dashboard/user-dashboard"
import { getCurrentUserAdminStatus } from "@/lib/admin-auth"

export default async function DashboardPage() {
  const { isAuthenticated } = await getCurrentUserAdminStatus()
  if (!isAuthenticated) {
    redirect("/login")
  }

  return <UserDashboard />
}
