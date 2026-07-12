import React from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BarChart3, ClipboardList, Map, ShieldCheck, WalletCards } from "lucide-react"
import { getCurrentUserAdminStatus } from "@/lib/admin-auth"
import { tankenTokens } from "@/lib/design/tanken"

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
    redirect("/access-denied")
  }

  const t = tankenTokens
  return (
    <div className="min-h-screen" style={{ background: t.color.paper, color: t.color.ink }}>
      <header
        className="sticky top-0 z-30 border-b px-4 py-3"
        style={{ background: t.color.card, borderColor: t.border.faint, boxShadow: t.shadow.soft }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2 font-black">
            <ShieldCheck className="h-6 w-6" style={{ color: t.color.primary }} aria-hidden="true" />
            管理センター
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="管理画面">
            {[
              ["/admin/dashboard", "概要", BarChart3],
              ["/admin/reports", "報告審査", ClipboardList],
              ["/admin/costs", "コスト", WalletCards],
              ["/map", "地図へ", Map],
            ].map(([href, label, Icon]) => (
              <Link
                key={String(href)}
                href={String(href)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold ${t.cls.focus}`}
                style={{ background: t.color.card, borderColor: t.border.soft }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {String(label)}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <section>{children}</section>
    </div>
  )
}
