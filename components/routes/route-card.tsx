"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pencil,
  Trash2,
  Star,
  Clock,
  MapPin,
  FileText,
  GitCompareArrows,
  Share2,
  MoreHorizontal,
  Map as MapIcon,
  PencilLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { tankenTokens } from "@/lib/design/tanken"
import type { UserRoute } from "@/lib/types"

export interface RouteCardProps {
  route: UserRoute
  isSelected: boolean
  onClick: (route: UserRoute) => void
  onEdit: (route: UserRoute) => void
  onDelete: (route: UserRoute) => void
  onSetPrimary: (route: UserRoute) => void
  onGenerateReport?: (route: UserRoute) => void
  onShare?: (route: UserRoute) => void
  showCompareToggle?: boolean
  isComparisonSelected?: boolean
  onToggleCompare?: (route: UserRoute) => void
  /** 通学路の近くにある注意ポイント数。未取得のときは undefined。 */
  dangerCount?: number
}

const { color, border, radius, shadow, cls } = tankenTokens

function formatDistance(meters: number | null): string {
  if (meters === null) {
    return "きょりはこれから"
  }
  if (meters < 1000) {
    return `${meters}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

function formatTime(minutes: number | null): string {
  if (minutes === null) {
    return "じかんはこれから"
  }
  return `約${minutes}分`
}

interface MetricPillProps {
  testId: string
  icon: React.ReactNode
  children: React.ReactNode
  tone?: "ink" | "accent" | "primary"
  muted?: boolean
}

function MetricPill({ testId, icon, children, tone = "ink", muted = false }: MetricPillProps) {
  const toneColor =
    tone === "accent" ? color.accentStrong : tone === "primary" ? color.primaryStrong : color.ink
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
      style={{
        background: muted ? color.paperDeep : color.paper,
        color: muted ? color.inkSoft : toneColor,
        border: `1px solid ${border.faint}`,
      }}
    >
      <span aria-hidden className="inline-flex" style={{ color: muted ? color.inkFaint : toneColor }}>
        {icon}
      </span>
      {children}
    </span>
  )
}

export function RouteCard({
  route,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onSetPrimary,
  onGenerateReport,
  onShare,
  showCompareToggle = false,
  isComparisonSelected = false,
  onToggleCompare,
  dangerCount,
}: RouteCardProps) {
  const hasGeometry = Boolean(route.route_geometry)
  const distanceKnown = route.distance_meters !== null
  const timeKnown = route.estimated_time_minutes !== null
  const showDangerFrame = hasGeometry && typeof dangerCount === "number"

  const stop = (event: React.MouseEvent) => event.stopPropagation()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(route)
    }
  }

  const runAction = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation()
    action()
  }

  return (
    <Card
      data-testid="route-card"
      role="article"
      tabIndex={0}
      className={cn(
        "cursor-pointer border transition-shadow duration-200 hover:shadow-lg",
        cls.focus,
        isSelected && "selected"
      )}
      style={{
        background: color.card,
        borderColor: isSelected ? color.primary : border.soft,
        borderRadius: radius.card,
        boxShadow: isSelected ? `0 0 0 3px ${color.primarySoft}, ${shadow.card}` : shadow.card,
      }}
      onClick={() => onClick(route)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col gap-3 p-4">
        {/* 見出し: 通学路名を主役に、対象の子どもとお気に入りを添える */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                data-testid="route-child-badge"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                style={{ background: color.primarySoft, color: color.primaryStrong }}
              >
                {route.child_name?.trim() || "みんなの通学路"}
              </span>
              {route.is_favorite && (
                <span
                  data-testid="primary-badge"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                  style={{ background: color.sunSoft, color: color.sunDeep }}
                >
                  <Star className="h-3 w-3" aria-hidden />
                  よく使う道
                </span>
              )}
            </div>
            <h3
              data-testid="route-name"
              className="min-w-0 flex-1 text-lg font-black leading-snug"
              style={{ color: color.ink }}
            >
              {route.name}
            </h3>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9 shrink-0 rounded-full", cls.focus)}
                style={{ color: color.inkSoft }}
                onClick={stop}
                aria-label="その他の操作"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel>この通学路の操作</DropdownMenuLabel>
              {!route.is_favorite && (
                <DropdownMenuItem
                  data-testid="set-primary-button"
                  aria-label="よく使う道に設定"
                  onClick={(e) => runAction(e, () => onSetPrimary(route))}
                >
                  <Star className="h-4 w-4" aria-hidden />
                  よく使う道にする
                </DropdownMenuItem>
              )}
              {onGenerateReport && hasGeometry && (
                <DropdownMenuItem
                  data-testid="generate-report-button"
                  aria-label="危険箇所レポートを作成"
                  onClick={(e) => runAction(e, () => onGenerateReport(route))}
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  きけんレポートをつくる
                </DropdownMenuItem>
              )}
              {onShare && (
                <DropdownMenuItem
                  data-testid="share-route-button"
                  aria-label="家族に共有"
                  onClick={(e) => runAction(e, () => onShare(route))}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  家族に共有する
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="edit-route-button"
                aria-label="ルートを編集"
                onClick={(e) => runAction(e, () => onEdit(route))}
              >
                <Pencil className="h-4 w-4" aria-hidden />
                なまえ・メモを編集
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="delete-route-button"
                aria-label="ルートを削除"
                onClick={(e) => runAction(e, () => onDelete(route))}
                style={{ color: color.danger }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                削除する
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {route.description ? (
          <p
            data-testid="route-description"
            className="truncate text-sm"
            style={{ color: color.inkSoft }}
          >
            {route.description}
          </p>
        ) : (
          <p data-testid="route-description" className="sr-only" />
        )}

        {/* みちのり: ダッシュではなく読める言葉で */}
        <div className="flex flex-wrap items-center gap-2">
          <MetricPill
            testId="route-time"
            icon={<Clock className="h-4 w-4" />}
            tone="primary"
            muted={!timeKnown}
          >
            {formatTime(route.estimated_time_minutes)}
          </MetricPill>
          <MetricPill
            testId="route-distance"
            icon={<MapPin className="h-4 w-4" />}
            muted={!distanceKnown}
          >
            {formatDistance(route.distance_meters)}
          </MetricPill>
          {showDangerFrame && (
            <MetricPill
              testId="route-danger-count"
              icon={
                dangerCount && dangerCount > 0 ? (
                  <TriangleAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )
              }
              tone={dangerCount && dangerCount > 0 ? "accent" : "primary"}
            >
              {dangerCount && dangerCount > 0 ? `注意ポイント ${dangerCount}か所` : "注意ポイントなし"}
            </MetricPill>
          )}
        </div>

        {/* 主要操作は明示ボタンで。比較は控えめなチップに */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            className={cn("chunky-press h-10 rounded-full px-4 font-black text-white", cls.focus)}
            style={{
              background: color.primary,
              boxShadow: shadow.pressGreen,
            }}
            onClick={(e) => runAction(e, () => onClick(route))}
          >
            {hasGeometry ? (
              <>
                <MapIcon className="h-4 w-4" aria-hidden />
                地図で見る
              </>
            ) : (
              <>
                <PencilLine className="h-4 w-4" aria-hidden />
                ルートをかいてみる
              </>
            )}
          </Button>

          {showCompareToggle && onToggleCompare && (
            <Button
              data-testid="compare-route-button"
              type="button"
              variant="ghost"
              className={cn("chunky-press h-10 rounded-full border-2 px-3 font-black", cls.focus)}
              style={
                isComparisonSelected
                  ? {
                      background: color.sky,
                      borderColor: color.sky,
                      color: "#ffffff",
                      boxShadow: shadow.pressPaper,
                    }
                  : {
                      background: color.card,
                      borderColor: border.soft,
                      color: color.inkSoft,
                      boxShadow: shadow.pressPaper,
                    }
              }
              onClick={(e) => runAction(e, () => onToggleCompare(route))}
              aria-label={isComparisonSelected ? "比較対象から外す" : "比較対象に追加"}
              aria-pressed={isComparisonSelected}
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              くらべる
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
