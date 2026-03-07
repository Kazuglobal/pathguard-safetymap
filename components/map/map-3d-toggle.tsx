"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Map3DToggleProps {
  is3DEnabled: boolean
  onToggle: () => void
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
}

export default function Map3DToggle({
  is3DEnabled,
  onToggle,
  className,
  size = "sm",
}: Map3DToggleProps) {
  const isActive = is3DEnabled

  return (
    <Button
      type="button"
      variant={isActive ? "default" : "outline"}
      size={size}
      onClick={onToggle}
      aria-pressed={is3DEnabled}
      aria-label="3D表示切替"
      className={cn(
        "backdrop-blur-sm shadow-sm transition-colors font-semibold",
        isActive
          ? "bg-sky-600 text-white hover:bg-sky-700 border-sky-600"
          : "bg-white/90 text-blue-600 hover:bg-white",
        className,
      )}
    >
      {is3DEnabled ? "2D" : "3D"}
    </Button>
  )
}
