import { getSeverityLabel } from '@/lib/traffic-accident-heatmap'

interface PopupDisplayData {
  severity: number | null
  severityLabel: string
  year: number | null
  type: string | null
  weather: string | null
  fatalities: number
  injuries: number
  hasChild: boolean
  hasYoung: boolean
  hasPedestrian: boolean
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function parseNonNegativeNumber(value: unknown): number {
  const parsed = parseNullableNumber(value)
  if (parsed === null) return 0
  return Math.max(0, parsed)
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toPopupDisplayData(properties: Record<string, unknown>): PopupDisplayData {
  const severity = parseNullableNumber(properties.severity)
  return {
    severity,
    severityLabel: getSeverityLabel(severity),
    year: parseNullableNumber(properties.year),
    type: parseText(properties.type),
    weather: parseText(properties.weather),
    fatalities: parseNonNegativeNumber(properties.fatalities),
    injuries: parseNonNegativeNumber(properties.injuries),
    hasChild: parseBoolean(properties.hasChild),
    hasYoung: parseBoolean(properties.hasYoung),
    hasPedestrian: parseBoolean(properties.hasPedestrian),
  }
}
