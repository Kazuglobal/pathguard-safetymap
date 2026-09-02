import {
  isHazardAreaContext,
  type HazardAreaContext,
  type HazardType,
} from "@/lib/types"
import type { Actor } from '@/lib/db/authz'
import {
  hasCoverageAtPoint,
  logGateVerdict as logGateVerdictToD1,
  zonesAtPoint,
} from '@/lib/db/repos/hazard.repo'

export type HazardGateVerdict =
  | { kind: "inside"; zone: HazardZoneHit }
  | { kind: "outside" }
  | { kind: "no_coverage" }
  | { kind: "unavailable" }

export type HazardGateMode = "off" | "log" | "enforce"
export type HazardGateRoute =
  | "hazard-image"
  | "generate-image"
  | "generate-prompts"

export interface HazardZoneHit {
  zoneId: string
  hazardType: HazardType
  riskLevel: number
  depthMinMeters: number | null
  depthMaxMeters: number | null
  areaContext: HazardAreaContext
  sourceLayer: string
}

export interface HazardPoint {
  longitude: number
  latitude: number
}

export interface HazardZoneRpcRow {
  id: string
  hazard_type: string
  source_layer: string
  risk_level: number
  depth_min_m: number | string | null
  depth_max_m: number | string | null
  area_context: string
}

type QueryHazardGateOptions = {
  toleranceMeters?: number
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 3_000
const JAPAN_BOUNDS = {
  minLongitude: 122,
  maxLongitude: 154,
  minLatitude: 20,
  maxLatitude: 46,
} as const

function isPointInJapan(point: HazardPoint): boolean {
  return (
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.latitude) &&
    point.longitude >= JAPAN_BOUNDS.minLongitude &&
    point.longitude <= JAPAN_BOUNDS.maxLongitude &&
    point.latitude >= JAPAN_BOUNDS.minLatitude &&
    point.latitude <= JAPAN_BOUNDS.maxLatitude
  )
}

function parseNullableNumber(value: number | string | null): number | null | undefined {
  if (value === null) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseZoneRow(
  row: HazardZoneRpcRow,
  hazardType: HazardType,
): HazardZoneHit | null {
  const depthMinMeters = parseNullableNumber(row.depth_min_m)
  const depthMaxMeters = parseNullableNumber(row.depth_max_m)

  if (
    row.hazard_type !== hazardType ||
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.source_layer !== "string" ||
    row.source_layer.length === 0 ||
    !Number.isInteger(row.risk_level) ||
    row.risk_level < 1 ||
    row.risk_level > 5 ||
    depthMinMeters === undefined ||
    depthMaxMeters === undefined ||
    !isHazardAreaContext(row.area_context)
  ) {
    return null
  }

  return {
    zoneId: row.id,
    hazardType,
    riskLevel: row.risk_level,
    depthMinMeters,
    depthMaxMeters,
    areaContext: row.area_context,
    sourceLayer: row.source_layer,
  }
}

function compareZones(left: HazardZoneHit, right: HazardZoneHit): number {
  if (left.riskLevel !== right.riskLevel) {
    return right.riskLevel - left.riskLevel
  }

  const leftDepth = left.depthMaxMeters ?? Number.NEGATIVE_INFINITY
  const rightDepth = right.depthMaxMeters ?? Number.NEGATIVE_INFINITY
  if (leftDepth !== rightDepth) return rightDepth - leftDepth
  return left.zoneId.localeCompare(right.zoneId)
}

export function resolveHazardGate(
  zones: readonly HazardZoneRpcRow[] | null,
  hasCoverage: boolean | null,
  point: HazardPoint,
  hazardType: HazardType,
): HazardGateVerdict {
  if (!isPointInJapan(point)) return { kind: "no_coverage" }
  if (zones === null || hasCoverage === null) return { kind: "unavailable" }

  const matchingRows = zones.filter((row) => row.hazard_type === hazardType)
  const parsedZones = matchingRows.map((row) => parseZoneRow(row, hazardType))
  if (parsedZones.some((zone) => zone === null)) return { kind: "unavailable" }

  const validZones = parsedZones.filter((zone): zone is HazardZoneHit => zone !== null)
  if (validZones.length > 0) {
    return { kind: "inside", zone: [...validZones].sort(compareZones)[0] }
  }

  return hasCoverage ? { kind: "outside" } : { kind: "no_coverage" }
}

function clampTolerance(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(50, Math.max(0, value ?? 0))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error("hazard gate operation timed out")),
      timeoutMs,
    )
    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

/** D1-backed replacement for the two PostGIS point RPCs. */
export async function queryHazardGateD1(
  actor: Actor,
  point: HazardPoint,
  hazardType: HazardType,
  options: QueryHazardGateOptions = {},
): Promise<HazardGateVerdict> {
  if (!isPointInJapan(point)) return { kind: 'no_coverage' }
  try {
    const [zones, coverage] = await withTimeout(Promise.all([
      zonesAtPoint(actor, {
        longitude: point.longitude,
        latitude: point.latitude,
        hazardType,
        toleranceMeters: clampTolerance(options.toleranceMeters),
      }),
      hasCoverageAtPoint(actor, {
        longitude: point.longitude,
        latitude: point.latitude,
        hazardType,
      }),
    ]), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    return resolveHazardGate(zones, coverage, point, hazardType)
  } catch {
    return { kind: 'unavailable' }
  }
}

function parseCoordinate(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value !== "string" || value.trim().length === 0) return Number.NaN
  return Number(value)
}

export function parseHazardPoint(
  longitudeValue: unknown,
  latitudeValue: unknown,
): HazardPoint | null {
  const longitude = parseCoordinate(longitudeValue)
  const latitude = parseCoordinate(latitudeValue)
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? { longitude, latitude }
    : null
}

function formatDepth(value: number): string {
  return value.toFixed(1)
}

export function formatHazardDepthLabel(zone: HazardZoneHit): string {
  if (zone.depthMinMeters !== null && zone.depthMaxMeters !== null) {
    return `${formatDepth(zone.depthMinMeters)}〜${formatDepth(zone.depthMaxMeters)}m`
  }
  if (zone.depthMinMeters !== null) {
    return `${formatDepth(zone.depthMinMeters)}m以上`
  }
  if (zone.depthMaxMeters !== null) {
    return `${formatDepth(zone.depthMaxMeters)}m以下`
  }
  return "深さ情報なし"
}

export function getHazardGateMessage(
  verdict: HazardGateVerdict,
  hazardType: HazardType,
): string {
  switch (verdict.kind) {
    case "inside": {
      const label = hazardType === "tsunami" ? "津波" : "洪水"
      return `${label}浸水想定区域内（想定浸水深 ${formatHazardDepthLabel(verdict.zone)}）`
    }
    case "outside":
      return "この地点は洪水・津波の浸水想定区域外のため、浸水シミュレーション画像は生成できません。※区域外であることは安全を保証するものではありません"
    case "no_coverage":
      return "この地域のハザードマップデータは準備中のため、浸水シミュレーションはまだ利用できません"
    case "unavailable":
      return "浸水想定の確認ができないため、いまは生成できません。時間をおいてお試しください"
  }
}

export function getHazardGateMode(
  value = process.env.HAZARD_ZONE_GATE_MODE,
): HazardGateMode {
  return value === "log" || value === "enforce" ? value : "off"
}

export function shouldRejectHazardGate(
  mode: HazardGateMode,
  verdict: HazardGateVerdict,
): boolean {
  return mode === "enforce" && verdict.kind !== "inside"
}

export function getHazardGateReason(
  verdict: HazardGateVerdict,
): HazardGateVerdict["kind"] {
  return verdict.kind
}

type LogHazardGateInput = {
  route: HazardGateRoute
  mode: HazardGateMode
  situation: string | null
  verdict: HazardGateVerdict
  point: HazardPoint | null
  userId: string | null
  latencyMs: number
  timeoutMs?: number
}

type QueryAndLogHazardGateInput = Omit<
  LogHazardGateInput,
  "verdict" | "latencyMs"
> & {
  hazardType: HazardType
  toleranceMeters?: number
}

/** D1-backed gate evaluation with an append-only service-authorized audit row. */
export async function queryAndLogHazardGateD1(
  actor: Actor,
  serviceActor: Actor,
  input: QueryAndLogHazardGateInput,
): Promise<HazardGateVerdict> {
  if (input.mode === 'off') return { kind: 'unavailable' }

  const startedAt = Date.now()
  const verdict = input.point
    ? await queryHazardGateD1(actor, input.point, input.hazardType, {
        toleranceMeters: input.toleranceMeters,
        timeoutMs: input.timeoutMs,
      })
    : { kind: 'unavailable' } as const
  try {
    await logGateVerdictToD1(serviceActor, {
      route: input.route,
      mode: input.mode,
      situation: input.situation,
      verdict: verdict.kind,
      zoneId: verdict.kind === 'inside' ? verdict.zone.zoneId : null,
      latitude: input.point?.latitude ?? null,
      longitude: input.point?.longitude ?? null,
      userId: input.userId,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[hazard-zone-gate] Failed to write D1 gate audit log', error)
  }
  return verdict
}
