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
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={onToggle}
      aria-pressed={is3DEnabled}
      className={cn(
        "bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white transition-colors text-blue-600 font-semibold",
        className,
      )}
    >
      {is3DEnabled ? "2D" : "3D"}
    </Button>
  )
}
