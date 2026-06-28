import {
  Car,
  Shield,
  AlertTriangle,
  HelpCircle,
  UserX,
  type LucideIcon,
} from "lucide-react"
import type { DangerReport } from "@/lib/types"

/** Danger type label mapping */
export function getDangerTypeLabel(type: string): string {
  switch (type) {
    case "traffic":
      return "交通危険"
    case "crime":
      return "犯罪危険"
    case "disaster":
      return "災害危険"
    case "suspicious":
      return "不審者情報"
    case "other":
      return "その他"
    default:
      return type
  }
}

/** Danger type icon mapping */
export function getDangerTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "traffic":
      return Car
    case "crime":
      return Shield
    case "disaster":
      return AlertTriangle
    case "suspicious":
      return UserX
    case "other":
      return HelpCircle
    default:
      return HelpCircle
  }
}

/** Danger level color configuration */
export function getDangerLevelColor(level: number): {
  bg: string
  text: string
  border: string
  band: string
  badgeClass: string
} {
  switch (level) {
    case 1:
      return {
        bg: "bg-green-50",
        text: "text-green-800",
        border: "border-green-200",
        band: "bg-green-400",
        badgeClass: "bg-green-100 text-green-800 border-green-200",
      }
    case 2:
      return {
        bg: "bg-lime-50",
        text: "text-lime-800",
        border: "border-lime-200",
        band: "bg-lime-400",
        badgeClass: "bg-lime-100 text-lime-800 border-lime-200",
      }
    case 3:
      return {
        bg: "bg-yellow-50",
        text: "text-yellow-800",
        border: "border-yellow-200",
        band: "bg-yellow-400",
        badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
      }
    case 4:
      return {
        bg: "bg-orange-50",
        text: "text-orange-800",
        border: "border-orange-200",
        band: "bg-orange-400",
        badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
      }
    case 5:
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
        band: "bg-red-500",
        badgeClass: "bg-red-100 text-red-800 border-red-200",
      }
    default:
      return {
        bg: "bg-gray-50",
        text: "text-gray-800",
        border: "border-gray-200",
        band: "bg-gray-400",
        badgeClass: "bg-gray-100 text-gray-800 border-gray-200",
      }
  }
}

/** Danger level label */
export function getDangerLevelLabel(level: number): string {
  return `レベル ${level}`
}

/** Parse unknown value to coordinate number */
export function toCoordinateNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Add cache-busting parameter to image URL */
export function addCacheBuster(url: string | null, token: number = Date.now()): string | null {
  if (!url) return null
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}t=${token}`
}

/** Format address from report fields */
export function formatAddress(report: DangerReport): string | null {
  const parts = [report.prefecture, report.city, report.town].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join("")
}

/** Format postal code for display */
export function formatPostalCode(code: string | null): string | null {
  if (!code) return null
  const cleaned = code.replace(/[^0-9]/g, "")
  if (cleaned.length === 7) {
    return `〒${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  }
  return `〒${code}`
}

/** Format coordinates for human-readable display */
export function formatCoordinates(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`
}

/** Status label mapping */
export function getStatusLabel(status: string): string {
  return status === "approved" ? "承認済み" : "審査中"
}

/** Status badge class */
export function getStatusBadgeClass(status: string): string {
  return status === "approved"
    ? "bg-green-100 text-green-800 border-green-200"
    : "bg-yellow-100 text-yellow-800 border-yellow-200"
}
