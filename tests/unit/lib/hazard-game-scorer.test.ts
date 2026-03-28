/**
 * TDD Unit Tests: Hazard Game Scorer (A8: ScoreAgent)
 *
 * AGENT_TEAM.md test_score_agent.py 仕様準拠 (7テストケース)
 *
 * Target: lib/hazard-game-scorer.ts
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSafetyScore,
  calculateFinalScoreWithBonus,
  checkSafetyEquipment,
  checkHazards,
  checkTraffic,
  checkObstructions,
  checkContextualRisks,
  determineLevel,
} from '@/lib/hazard-game-scorer'
import type {
  VisionResult,
  ThinkResult,
  DetectionItem,
  ContextualRisk,
  ComparisonResult,
  SafetyScore,
} from '@/lib/hazard-game-types'

// ---- Test Helpers ----

function createDetectionItem(
  overrides: Partial<DetectionItem> & { label: string; category: DetectionItem['category'] }
): DetectionItem {
  return {
    description: '',
    count: 1,
    confidence: 0.9,
    coverageRatio: 0.1,
    positions: [],
    ...overrides,
  }
}

function createMockVision(overrides: Partial<VisionResult> = {}): VisionResult {
  return {
    safetyEquipment: [],
    hazards: [],
    traffic: [],
    obstructions: [],
    inferenceTimeMs: 100,
    ...overrides,
  }
}

function createMockThink(overrides: Partial<ThinkResult> = {}): ThinkResult {
  return {
    contextualRisks: [],
    priorityImprovements: [],
    latentRisks: [],
    childPerspectiveRisks: [],
    ...overrides,
  }
}

function createSafetyScore(overrides: Partial<SafetyScore> = {}): SafetyScore {
  return {
    score: 58,
    level: 'warning',
    breakdown: [],
    detectionSummary: {
      safetyEquipmentCount: 0,
      hazardCount: 0,
      trafficCount: 0,
      obstructionCount: 0,
    },
    thinkSummary: {
      contextualRiskCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      lowSeverityCount: 0,
    },
    ...overrides,
  }
}

function createComparisonResult(overrides: Partial<ComparisonResult> = {}): ComparisonResult {
  return {
    matches: [],
    unmatchedUserMarkers: [],
    unmatchedAiDetections: [],
    accuracyScore: 60,
    bonusPoints: 10,
    ...overrides,
  }
}

// ---- Tests ----

describe('hazard-game-scorer', () => {
  describe('calculateSafetyScore', () => {
    it('returns 100 and level safe when all safety equipment present and no hazards', () => {
      const vision = createMockVision({
        safetyEquipment: [
          createDetectionItem({ label: 'guardrail', category: 'safety_equipment' }),
          createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
          createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
          createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
        ],
      })
      const think = createMockThink()

      const result = calculateSafetyScore(vision, think)

      expect(result.score).toBe(100)
      expect(result.level).toBe('safe')
      expect(result.breakdown).toHaveLength(0)
    })

    it('deducts 10 points when guardrail is not detected (road scene)', () => {
      const vision = createMockVision({
        safetyEquipment: [
          createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
          createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
          createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
        ],
      })
      const think = createMockThink()

      const result = calculateSafetyScore(vision, think)

      // crosswalk/traffic_light/sidewalk present → road scene, guardrail missing → -10
      expect(result.score).toBe(90)
      const guardrailDeduction = result.breakdown.find(
        (b) => b.item.includes('ガードレール')
      )
      expect(guardrailDeduction).toBeDefined()
      expect(guardrailDeduction!.points).toBe(-10)
    })

    it('accumulates penalties for multiple hazards', () => {
      const vision = createMockVision({
        safetyEquipment: [
          createDetectionItem({ label: 'guardrail', category: 'safety_equipment' }),
          createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
          createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
          createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
        ],
        hazards: [
          createDetectionItem({ label: '工事現場', category: 'hazards' }),
          createDetectionItem({ label: '壊れたフェンス', category: 'hazards' }),
          createDetectionItem({ label: '落下物', category: 'hazards' }),
        ],
      })
      const think = createMockThink()

      const result = calculateSafetyScore(vision, think)

      // 100 - (3 * 10) = 70
      expect(result.score).toBe(70)
      const hazardItems = result.breakdown.filter((b) => b.category === 'hazards')
      expect(hazardItems).toHaveLength(3)
      hazardItems.forEach((item) => {
        expect(item.points).toBe(-10)
      })
    })

    it('never returns a score below zero', () => {
      const vision = createMockVision({
        // No safety equipment (road scene due to traffic): -10 -8 -6 -6 = -30
        safetyEquipment: [],
        // 6 hazards: -60
        hazards: Array.from({ length: 6 }, (_, i) =>
          createDetectionItem({ label: `hazard-${i}`, category: 'hazards' })
        ),
        // 10 vehicles: -10 (also makes isRoadScene=true)
        traffic: [
          createDetectionItem({ label: 'car', category: 'traffic', count: 10 }),
        ],
        // 3 obstructions: -24
        obstructions: Array.from({ length: 3 }, (_, i) =>
          createDetectionItem({ label: `obstruction-${i}`, category: 'obstructions' })
        ),
      })
      const think = createMockThink({
        contextualRisks: [
          { description: 'Critical risk', severity: 'high', relatedDetections: [] },
          { description: 'Critical risk 2', severity: 'high', relatedDetections: [] },
        ],
      })

      const result = calculateSafetyScore(vision, think)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.level).toBe('danger')
    })

    it('never returns a score above 100', () => {
      const vision = createMockVision({
        safetyEquipment: [
          createDetectionItem({ label: 'guardrail', category: 'safety_equipment' }),
          createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
          createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
          createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
        ],
      })
      const think = createMockThink()

      const result = calculateSafetyScore(vision, think)

      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('correctly determines level boundaries', () => {
      // We test determineLevel directly for boundary values
      expect(determineLevel(100)).toBe('safe')
      expect(determineLevel(80)).toBe('safe')
      expect(determineLevel(79)).toBe('caution')
      expect(determineLevel(60)).toBe('caution')
      expect(determineLevel(59)).toBe('warning')
      expect(determineLevel(40)).toBe('warning')
      expect(determineLevel(39)).toBe('danger')
      expect(determineLevel(0)).toBe('danger')
    })

    it('adds penalty for contextual risks by severity', () => {
      const vision = createMockVision({
        safetyEquipment: [
          createDetectionItem({ label: 'guardrail', category: 'safety_equipment' }),
          createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
          createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
          createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
        ],
      })
      const think = createMockThink({
        contextualRisks: [
          { description: 'High risk 1', severity: 'high', relatedDetections: [] },
          { description: 'High risk 2', severity: 'high', relatedDetections: [] },
        ],
      })

      const result = calculateSafetyScore(vision, think)

      // 100 - (2 * 5) = 90
      expect(result.score).toBe(90)
      expect(result.thinkSummary.highSeverityCount).toBe(2)
      const contextualItems = result.breakdown.filter((b) => b.category === 'contextual')
      expect(contextualItems).toHaveLength(2)
      contextualItems.forEach((item) => {
        expect(item.points).toBe(-5)
      })
    })
  })

  describe('checkSafetyEquipment', () => {
    it('returns empty array when all equipment is present', () => {
      const equipment = [
        createDetectionItem({ label: 'guardrail', category: 'safety_equipment' }),
        createDetectionItem({ label: 'crosswalk', category: 'safety_equipment' }),
        createDetectionItem({ label: 'traffic_light', category: 'safety_equipment' }),
        createDetectionItem({ label: 'sidewalk', category: 'safety_equipment' }),
      ]
      expect(checkSafetyEquipment(equipment)).toHaveLength(0)
    })

    it('returns all penalties when no equipment is detected', () => {
      const result = checkSafetyEquipment([])
      expect(result).toHaveLength(4)
      const totalPenalty = result.reduce((sum, b) => sum + b.points, 0)
      expect(totalPenalty).toBe(-30)
    })
  })

  describe('checkHazards', () => {
    it('returns -10 per hazard item', () => {
      const hazards = [
        createDetectionItem({ label: '工事', category: 'hazards' }),
        createDetectionItem({ label: '段差', category: 'hazards' }),
      ]
      const result = checkHazards(hazards)
      expect(result).toHaveLength(2)
      expect(result[0].points).toBe(-10)
      expect(result[1].points).toBe(-10)
    })
  })

  describe('checkTraffic', () => {
    it('returns -5 for 6-8 vehicles', () => {
      const traffic = [
        createDetectionItem({ label: 'car', category: 'traffic', count: 6 }),
      ]
      const result = checkTraffic(traffic)
      const vehicleItem = result.find((r) => r.item === '車両多数')
      expect(vehicleItem).toBeDefined()
      expect(vehicleItem!.points).toBe(-5)
    })

    it('returns -10 for more than 8 vehicles', () => {
      const traffic = [
        createDetectionItem({ label: 'car', category: 'traffic', count: 9 }),
      ]
      const result = checkTraffic(traffic)
      const vehicleItem = result.find((r) => r.item === '車両過密')
      expect(vehicleItem).toBeDefined()
      expect(vehicleItem!.points).toBe(-10)
    })

    it('returns -5 for motorcycle detection', () => {
      const traffic = [
        createDetectionItem({ label: 'motorcycle', category: 'traffic', count: 1 }),
      ]
      const result = checkTraffic(traffic)
      const bikeItem = result.find((r) => r.item === 'バイク接近')
      expect(bikeItem).toBeDefined()
      expect(bikeItem!.points).toBe(-5)
    })
  })

  describe('checkObstructions', () => {
    it('returns -8 per obstruction item', () => {
      const obstructions = [
        createDetectionItem({ label: '電柱', category: 'obstructions' }),
      ]
      const result = checkObstructions(obstructions)
      expect(result).toHaveLength(1)
      expect(result[0].points).toBe(-8)
    })
  })

  describe('checkContextualRisks', () => {
    it('applies severity-based penalties', () => {
      const risks: ContextualRisk[] = [
        { description: 'High risk', severity: 'high', relatedDetections: [] },
        { description: 'Medium risk', severity: 'medium', relatedDetections: [] },
        { description: 'Low risk', severity: 'low', relatedDetections: [] },
      ]
      const result = checkContextualRisks(risks)
      expect(result).toHaveLength(3)
      expect(result[0].points).toBe(-5)
      expect(result[1].points).toBe(-3)
      expect(result[2].points).toBe(-1)
    })
  })

  describe('calculateFinalScoreWithBonus', () => {
    it('recalculates level from the final score after bonus is applied', () => {
      const baseScore = createSafetyScore({
        score: 58,
        level: 'warning',
      })
      const comparison = createComparisonResult({
        bonusPoints: 10,
      })

      const result = calculateFinalScoreWithBonus(baseScore, comparison)

      expect(result.score).toBe(68)
      expect(result.level).toBe('caution')
    })
  })
})
