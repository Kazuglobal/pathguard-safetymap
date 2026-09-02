import * as turf from '@turf/turf'
import { and, eq, gte, lte, or, type SQL } from 'drizzle-orm'

import type { AccidentStats, NearbyAccident } from '@/lib/traffic-accident-data'

import { assertCan, type Actor } from '../authz'
import { getTrafficDb, type AppDb } from '../client'
import { trafficAccidents } from '../schema'

const MAX_BBOX_RESULTS = 10_000
const MAX_CHILD_BBOX_RESULTS = 5_000
const MAX_RADIUS_METERS = 1_000
const MAX_NEARBY_CANDIDATES = 10_000

interface TurfPoint {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: number[] }
}

const turfOps = turf as unknown as {
  point(coordinates: [number, number]): TurfPoint
  distance(
    from: TurfPoint,
    to: TurfPoint,
    options: { units: 'kilometers' },
  ): number
}

type AccidentRow = typeof trafficAccidents.$inferSelect

export interface AccidentsInBboxInput {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
  minYear: number
  maxYear: number
  severity?: 'all' | 'fatal'
  child?: boolean | null
  young?: boolean | null
  pedestrian?: boolean | null
  limit?: number
}

export interface NearbyStatsInput {
  latitude: number
  longitude: number
  radiusMeters?: number
  years?: number
  currentYear?: number
}

export interface AccidentFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: {
      id: number
      severity: number | null
      fatalities: number
      injuries: number
      year: number
      type: string | null
      hasChild: boolean
      hasYoung: boolean
      hasPedestrian: boolean
      date: string | null
      weather: string | null
      roadShape: string | null
      dayNight: number | null
    }
  }>
}

function assertFiniteInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`)
  }
}

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`)
  }
}

function increment(target: Record<string, number>, key: string | number | null): void {
  const normalized = key == null || key === '' ? '不明' : String(key)
  target[normalized] = (target[normalized] ?? 0) + 1
}

function incrementIfPresent(target: Record<string, number>, value: string | null): void {
  if (value) increment(target, value)
}

function roundRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)
}

function topEntries(source: Record<string, number>, limit: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(source)
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit),
  )
}

function dateParts(value: string | null): { hour: number; month: number } | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return { hour: date.getUTCHours(), month: date.getUTCMonth() + 1 }
}

function timeBucket(hour: number): string {
  if (hour >= 7 && hour <= 8) return '07-09_morning_commute'
  if (hour >= 14 && hour <= 16) return '14-17_after_school'
  if (hour >= 17 && hour <= 18) return '17-19_evening'
  return 'other'
}

function peakKey(counts: Record<string, number>): number | null {
  const entry = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]
  return entry ? Number(entry[0]) : null
}

function ageGroup(age: number): string {
  if (age === 0 || age === 1) return '24歳以下'
  if (age === 25) return '25-34歳'
  if (age === 35) return '35-44歳'
  if (age === 45) return '45-54歳'
  if (age === 55) return '55-64歳'
  if (age === 65) return '65-74歳'
  if (age === 75) return '75歳以上'
  return '不明'
}

function toTokyoMinute(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}

function nearbyAccident(row: AccidentRow, distanceMeters: number): NearbyAccident {
  return {
    distance_m: Math.round(distanceMeters * 10) / 10,
    year: row.sourceYear,
    occurred_at: toTokyoMinute(row.occurredAt),
    type: row.accidentTypeLabel,
    severity: row.severityCode === 1 ? 'fatal' : 'injury',
    fatalities: row.fatalities ?? 0,
    injuries: row.injuries ?? 0,
    involved_child: row.involvesChild,
    involved_pedestrian: row.involvesPedestrian,
    weather: row.weatherLabel,
    road_shape: row.roadShapeLabel,
    sidewalk: row.sidewalkLabel,
    road_surface: row.roadSurfaceLabel,
    terrain: row.terrainLabel,
    party_a_type: row.partyATypeLabel,
    party_b_type: row.partyBTypeLabel,
    injury_a: row.injuryLevelA,
    injury_b: row.injuryLevelB,
    party_a_age: row.partyAAge,
    party_b_age: row.partyBAge,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

function aggregateNearby(
  rows: Array<{ row: AccidentRow; distanceMeters: number }>,
  input: Required<Pick<NearbyStatsInput, 'latitude' | 'longitude' | 'radiusMeters' | 'years'>>,
): AccidentStats {
  const byYear: Record<string, number> = {}
  const byTimeOfDay: Record<string, number> = {}
  const byWeather: Record<string, number> = {}
  const byAccidentType: Record<string, number> = {}
  const byPartyType: Record<string, number> = {}
  const byRoadSurface: Record<string, number> = {}
  const byTerrain: Record<string, number> = {}
  const byInjuryLevel: Record<string, number> = {}
  const byRoadShape: Record<string, number> = {}
  const bySidewalk: Record<string, number> = {}
  const byAgeGroup: Record<string, number> = {}
  const byHour: Record<string, number> = {}
  const byMonth: Record<string, number> = {}

  let totalFatalities = 0
  let totalInjuries = 0
  let childInvolved = 0
  let pedestrianInvolved = 0
  let fatalAccidents = 0
  let severeInjuries = 0
  let injuryLevelRows = 0
  let roadShapeRows = 0
  let intersectionRows = 0
  let sidewalkRows = 0
  let noSidewalkRows = 0
  let elderlyRows = 0
  let youngRows = 0
  let badWeatherRows = 0
  let badSurfaceRows = 0
  let pedestrianTypeRows = 0
  let crossingRows = 0

  for (const { row } of rows) {
    totalFatalities += row.fatalities ?? 0
    totalInjuries += row.injuries ?? 0
    if (row.involvesChild) childInvolved += 1
    if (row.involvesPedestrian) pedestrianInvolved += 1
    if (row.severityCode === 1) fatalAccidents += 1

    increment(byYear, row.sourceYear)
    increment(byWeather, row.weatherLabel)
    increment(byAccidentType, row.accidentTypeLabel)
    incrementIfPresent(byPartyType, row.partyATypeLabel)
    incrementIfPresent(byPartyType, row.partyBTypeLabel)
    incrementIfPresent(byRoadSurface, row.roadSurfaceLabel)
    incrementIfPresent(byTerrain, row.terrainLabel)
    incrementIfPresent(byInjuryLevel, row.injuryLevelA)
    incrementIfPresent(byInjuryLevel, row.injuryLevelB)
    incrementIfPresent(byRoadShape, row.roadShapeLabel)
    incrementIfPresent(bySidewalk, row.sidewalkLabel)

    if (row.injuryLevelA || row.injuryLevelB) injuryLevelRows += 1
    if (['死亡', '重傷'].includes(row.injuryLevelA ?? '') || ['死亡', '重傷'].includes(row.injuryLevelB ?? '')) {
      severeInjuries += 1
    }
    if (row.roadShapeLabel) {
      roadShapeRows += 1
      if (row.roadShapeLabel.includes('交差点')) intersectionRows += 1
    }
    if (row.sidewalkLabel) {
      sidewalkRows += 1
      if (['区分なし', '区別なし'].includes(row.sidewalkLabel)) noSidewalkRows += 1
    }
    if ((row.partyAAge ?? 0) >= 65 || (row.partyBAge ?? 0) >= 65) elderlyRows += 1
    if ((row.partyAAge != null && row.partyAAge <= 1) || (row.partyBAge != null && row.partyBAge <= 1)) youngRows += 1
    for (const age of [row.partyAAge, row.partyBAge]) {
      if (age != null && age > 0) increment(byAgeGroup, ageGroup(age))
    }

    if (['雨', '雪', '霧'].includes(row.weatherLabel ?? '')) badWeatherRows += 1
    if (['湿潤', '凍結', '積雪'].includes(row.roadSurfaceLabel ?? '')) badSurfaceRows += 1
    if (row.accidentTypeLabel?.includes('人対車両')) pedestrianTypeRows += 1
    if (row.accidentTypeLabel?.includes('横断')) crossingRows += 1

    const time = dateParts(row.occurredAt)
    if (time) {
      increment(byTimeOfDay, timeBucket(time.hour))
      increment(byHour, time.hour)
      increment(byMonth, time.month)
    }
  }

  const total = rows.length
  const intersectionRatio = roundRatio(intersectionRows, roadShapeRows)
  const noSidewalkRatio = roundRatio(noSidewalkRows, sidewalkRows)
  const elderlyRatio = roundRatio(elderlyRows, total)
  const youngRatio = roundRatio(youngRows, total)
  const badWeatherRatio = roundRatio(badWeatherRows, total)
  const badSurfaceRatio = roundRatio(badSurfaceRows, total)

  return {
    total_accidents: total,
    total_fatalities: totalFatalities,
    total_injuries: totalInjuries,
    child_involved: childInvolved,
    pedestrian_involved: pedestrianInvolved,
    fatal_accidents: fatalAccidents,
    by_year: byYear,
    by_time_of_day: byTimeOfDay,
    by_weather: topEntries(byWeather, 5),
    by_accident_type: topEntries(byAccidentType, 5),
    by_party_type: topEntries(byPartyType, 8),
    by_road_surface: byRoadSurface,
    by_terrain: byTerrain,
    injury_analysis: {
      by_injury_level: byInjuryLevel,
      severe_ratio: roundRatio(severeInjuries, injuryLevelRows),
    },
    road_environment: {
      by_road_shape: topEntries(byRoadShape, 5),
      by_sidewalk: topEntries(bySidewalk, 5),
      intersection_ratio: intersectionRatio,
      no_sidewalk_ratio: noSidewalkRatio,
    },
    party_analysis: {
      by_age_group: byAgeGroup,
      elderly_ratio: elderlyRatio,
      young_ratio: youngRatio,
    },
    time_analysis: {
      by_hour: byHour,
      by_month: byMonth,
      peak_hour: peakKey(byHour),
      peak_month: peakKey(byMonth),
    },
    situation_summary: {
      total_text: `${total}件の事故が過去${input.years}年間に半径${input.radiusMeters}m以内で発生`,
      severity_text: fatalAccidents > 0 ? `死亡事故${fatalAccidents}件を含む` : '死亡事故なし',
      pedestrian_text: pedestrianTypeRows > 0
        ? `歩行者事故${pedestrianTypeRows}件（横断中${crossingRows}件）`
        : '歩行者事故なし',
      weather_risk_text: badWeatherRows > 0
        ? `悪天候時の事故${badWeatherRows}件（全体の${badWeatherRatio}%）`
        : '悪天候時の事故なし',
      road_text: intersectionRows > total * 0.5
        ? '事故の過半数が交差点で発生'
        : rows.filter(({ row }) => row.roadShapeLabel?.includes('単路')).length > total * 0.5
          ? '事故の過半数が直線道路で発生'
          : '交差点・直線道路ともに事故あり',
      surface_text: badSurfaceRows > total * 0.2
        ? `路面状態が悪い時の事故が多い（${badSurfaceRatio}%）`
        : null,
      elderly_text: elderlyRows > total * 0.3
        ? `高齢者（65歳以上）関与率が高い（${elderlyRatio}%）`
        : null,
    },
    nearest_accidents: rows
      .slice()
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 10)
      .map(({ row, distanceMeters }) => nearbyAccident(row, distanceMeters)),
    risk_score: Math.min(
      100,
      Math.min(60, total * 10)
        + Math.min(20, fatalAccidents * 20)
        + Math.min(15, childInvolved * 15)
        + Math.min(10, pedestrianInvolved * 5),
    ),
    search_params: {
      latitude: input.latitude,
      longitude: input.longitude,
      radius_meters: input.radiusMeters,
      years: input.years,
    },
  }
}

export function createAccidentsRepo(db: AppDb) {
  return {
    async accidentsInBbox(actor: Actor, input: AccidentsInBboxInput): Promise<AccidentFeatureCollection> {
      assertCan(actor, 'select', 'traffic_accidents')
      assertFiniteInRange('minLng', input.minLng, -180, 180)
      assertFiniteInRange('maxLng', input.maxLng, -180, 180)
      assertFiniteInRange('minLat', input.minLat, -90, 90)
      assertFiniteInRange('maxLat', input.maxLat, -90, 90)
      if (input.minLng > input.maxLng || input.minLat > input.maxLat) {
        throw new RangeError('bbox minimums must not exceed maximums')
      }
      assertIntegerInRange('minYear', input.minYear, 1900, 2200)
      assertIntegerInRange('maxYear', input.maxYear, 1900, 2200)
      if (input.minYear > input.maxYear) throw new RangeError('minYear must not exceed maxYear')

      const predicates: SQL[] = [
        gte(trafficAccidents.longitude, input.minLng),
        lte(trafficAccidents.longitude, input.maxLng),
        gte(trafficAccidents.latitude, input.minLat),
        lte(trafficAccidents.latitude, input.maxLat),
        gte(trafficAccidents.sourceYear, input.minYear),
        lte(trafficAccidents.sourceYear, input.maxYear),
      ]
      if (input.severity === 'fatal') predicates.push(eq(trafficAccidents.severityCode, 1))
      if (input.child != null) predicates.push(eq(trafficAccidents.involvesChild, input.child))
      if (input.pedestrian != null) predicates.push(eq(trafficAccidents.involvesPedestrian, input.pedestrian))
      if (input.young != null) {
        const young = or(eq(trafficAccidents.partyAAge, 1), eq(trafficAccidents.partyBAge, 1))
        predicates.push(input.young ? young! : and(
          or(lte(trafficAccidents.partyAAge, 0), gte(trafficAccidents.partyAAge, 2)),
          or(lte(trafficAccidents.partyBAge, 0), gte(trafficAccidents.partyBAge, 2)),
        )!)
      }

      const requestedLimit = Math.max(1, Math.floor(input.limit ?? MAX_BBOX_RESULTS))
      const limit = Math.min(
        requestedLimit,
        input.child === true ? MAX_CHILD_BBOX_RESULTS : MAX_BBOX_RESULTS,
      )
      const rows = await db.select().from(trafficAccidents).where(and(...predicates)).limit(limit)

      return {
        type: 'FeatureCollection',
        features: rows.map((row) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
          properties: {
            id: row.id,
            severity: row.severityCode,
            fatalities: row.fatalities ?? 0,
            injuries: row.injuries ?? 0,
            year: row.sourceYear,
            type: row.accidentTypeLabel,
            hasChild: row.involvesChild,
            hasYoung: row.partyAAge === 1 || row.partyBAge === 1,
            hasPedestrian: row.involvesPedestrian,
            date: row.occurredAt,
            weather: row.weatherLabel,
            roadShape: row.roadShapeLabel,
            dayNight: row.dayNightCode,
          },
        })),
      }
    },

    async nearbyStats(actor: Actor, input: NearbyStatsInput): Promise<AccidentStats> {
      assertCan(actor, 'select', 'traffic_accidents')
      assertFiniteInRange('latitude', input.latitude, -90, 90)
      assertFiniteInRange('longitude', input.longitude, -180, 180)
      const radiusMeters = input.radiusMeters ?? 200
      const years = input.years ?? 5
      assertIntegerInRange('radiusMeters', radiusMeters, 1, MAX_RADIUS_METERS)
      assertIntegerInRange('years', years, 1, 10)
      const currentYear = input.currentYear ?? new Date().getUTCFullYear()
      assertIntegerInRange('currentYear', currentYear, 1900, 2200)

      const latitudeDelta = radiusMeters / 111_320
      const longitudeScale = Math.max(Math.cos((input.latitude * Math.PI) / 180), 0.01)
      const longitudeDelta = radiusMeters / (111_320 * longitudeScale)
      const candidateRows = await db
        .select()
        .from(trafficAccidents)
        .where(and(
          gte(trafficAccidents.latitude, input.latitude - latitudeDelta),
          lte(trafficAccidents.latitude, input.latitude + latitudeDelta),
          gte(trafficAccidents.longitude, input.longitude - longitudeDelta),
          lte(trafficAccidents.longitude, input.longitude + longitudeDelta),
          gte(trafficAccidents.sourceYear, currentYear - years),
        ))
        .limit(MAX_NEARBY_CANDIDATES)

      const center = turfOps.point([input.longitude, input.latitude])
      const nearbyRows = candidateRows
        .map((row) => ({
          row,
          distanceMeters: turfOps.distance(
            center,
            turfOps.point([row.longitude, row.latitude]),
            { units: 'kilometers' },
          ) * 1_000,
        }))
        .filter(({ distanceMeters }) => distanceMeters <= radiusMeters)

      return aggregateNearby(nearbyRows, {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters,
        years,
      })
    },
  }
}

export function accidentsInBbox(actor: Actor, input: AccidentsInBboxInput) {
  return createAccidentsRepo(getTrafficDb()).accidentsInBbox(actor, input)
}

export function nearbyStats(actor: Actor, input: NearbyStatsInput) {
  return createAccidentsRepo(getTrafficDb()).nearbyStats(actor, input)
}
