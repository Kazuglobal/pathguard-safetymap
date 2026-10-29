import { redirect } from "next/navigation"
import { loginPathFor } from "@/lib/auth/login-path"
import UserDashboard from "@/components/dashboard/user-dashboard"
import { getCurrentUserAdminStatus } from "@/lib/admin-auth"

export default async function DashboardPage() {
  const { isAuthenticated } = await getCurrentUserAdminStatus()
  if (!isAuthenticated) {
    redirect(loginPathFor("/dashboard"))
  }

  return <UserDashboard />
}
