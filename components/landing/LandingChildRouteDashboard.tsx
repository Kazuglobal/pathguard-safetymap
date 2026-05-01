"use client"

import { ChildRouteDashboard } from "@/components/landing/child-route-dashboard"
import { useChildRouteDashboard } from "@/hooks/use-child-route-dashboard"

interface NewsPreviewItem {
  id: string
  title: string
  categoryLabel: string
  categoryColor: string
  slug: string
}

interface LandingChildRouteDashboardProps {
  newsPreview: NewsPreviewItem[]
}

export function LandingChildRouteDashboard({
  newsPreview,
}: LandingChildRouteDashboardProps) {
  const dashboard = useChildRouteDashboard()

  return (
    <ChildRouteDashboard
      state={dashboard.state}
      childName={dashboard.childName}
      errorMessage={dashboard.errorMessage}
      quickChecks={dashboard.quickChecks}
      retryHref={dashboard.retryHref}
      newsPreview={newsPreview}
    />
  )
}
