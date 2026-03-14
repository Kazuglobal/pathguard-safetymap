"use client"

import * as React from "react"
import { Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { UserRoute } from "@/lib/types"

interface RouteShareActionsProps {
  route: UserRoute
  onShare: (route: UserRoute) => void
}

export function RouteShareActions({ route, onShare }: RouteShareActionsProps) {
  const handleShareClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    onShare(route)
  }

  return (
    <Button
      data-testid="share-route-button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleShareClick}
      aria-label="家族に共有"
    >
      <Share2 className="w-4 h-4" />
    </Button>
  )
}
