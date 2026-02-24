"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Star, Clock, MapPin, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRoute } from "@/lib/types"

export interface RouteCardProps {
  route: UserRoute
  isSelected: boolean
  onClick: (route: UserRoute) => void
  onEdit: (route: UserRoute) => void
  onDelete: (route: UserRoute) => void
  onSetPrimary: (route: UserRoute) => void
  onGenerateReport?: (route: UserRoute) => void
}

function formatDistance(meters: number | null): string {
  if (meters === null) {
    return "-"
  }
  if (meters < 1000) {
    return `${meters}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

function formatTime(minutes: number | null): string {
  if (minutes === null) {
    return "-"
  }
  return `${minutes}分`
}

export function RouteCard({
  route,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onSetPrimary,
  onGenerateReport,
}: RouteCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(route)
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(route)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(route)
  }

  const handleSetPrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSetPrimary(route)
  }

  const handleGenerateReportClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onGenerateReport?.(route)
  }

  return (
    <Card
      data-testid="route-card"
      role="article"
      tabIndex={0}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && "selected ring-2 ring-primary border-primary"
      )}
      onClick={() => onClick(route)}
      onKeyDown={handleKeyDown}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                data-testid="route-name"
                className="font-semibold text-base truncate"
              >
                {route.name}
              </h3>
              {route.is_favorite && (
                <Badge
                  data-testid="primary-badge"
                  variant="default"
                  className="shrink-0"
                >
                  <Star className="w-3 h-3 mr-1" />
                  お気に入り
                </Badge>
              )}
            </div>

            <p
              data-testid="route-description"
              className="text-sm text-muted-foreground truncate mb-2"
            >
              {route.description || ""}
            </p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span
                data-testid="route-distance"
                className="flex items-center gap-1"
              >
                <MapPin className="w-4 h-4" />
                {formatDistance(route.distance_meters)}
              </span>
              <span
                data-testid="route-time"
                className="flex items-center gap-1"
              >
                <Clock className="w-4 h-4" />
                {formatTime(route.estimated_time_minutes)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!route.is_favorite && (
              <Button
                data-testid="set-primary-button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSetPrimaryClick}
                aria-label="お気に入りに設定"
              >
                <Star className="w-4 h-4" />
              </Button>
            )}
            {onGenerateReport && route.route_geometry && (
              <Button
                data-testid="generate-report-button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleGenerateReportClick}
                aria-label="危険箇所レポートを生成"
              >
                <FileText className="w-4 h-4" />
              </Button>
            )}
            <Button
              data-testid="edit-route-button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEditClick}
              aria-label="ルートを編集"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              data-testid="delete-route-button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
              aria-label="ルートを削除"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
