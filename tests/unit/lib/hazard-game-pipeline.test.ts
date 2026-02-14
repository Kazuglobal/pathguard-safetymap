/**
 * TDD Unit Tests: Hazard Game Pipeline Parser
 *
 * AGENT_TEAM.md パイプライン応答パース仕様 (5テストケース)
 *
 * Target: lib/gemini-hazard.ts (parseGeminiPipelineResponse, clampNum, parseBbox)
 */

import { describe, it, expect } from 'vitest'
import {
  parseGeminiPipelineResponse,
  parseDetectionItems,
  parseContextualRisks,
  clampNum,
  parseBbox,
} from '@/lib/gemini-hazard'

describe('hazard-game-pipeline parser', () => {
  describe('parseGeminiPipelineResponse', () => {
    it('parses a valid response with all fields', () => {
      const raw = {
        vision: {
          safety_equipment: [
            {
              label: 'guardrail',
              description: 'Metal guardrail along road',
              count: 2,
              confidence: 0.95,
              coverage_ratio: 0.15,
              positions: [{ x: 0.1, y: 0.5, width: 0.3, height: 0.1 }],
            },
          ],
          hazards: [
            {
              label: 'construction',
              description: 'Road construction site',
              count: 1,
              confidence: 0.8,
              coverage_ratio: 0.1,
              positions: [],
            },
          ],
          traffic: [],
          obstructions: [],
        },
        think: {
          contextual_risks: [
            {
              description: 'Construction near school zone',
              severity: 'high',
              related_detections: ['construction'],
            },
          ],
          priority_improvements: ['Add temporary barriers'],
          latent_risks: ['Noise pollution'],
          child_perspective_risks: ['Confusing signage'],
        },
        educational_tips: ['Always look both ways', 'Use crosswalks'],
      }

      const result = parseGeminiPipelineResponse(raw)

      // Vision
      expect(result.vision.safetyEquipment).toHaveLength(1)
      expect(result.vision.safetyEquipment[0].label).toBe('guardrail')
      expect(result.vision.safetyEquipment[0].confidence).toBe(0.95)
      expect(result.vision.safetyEquipment[0].positions).toHaveLength(1)
      expect(result.vision.hazards).toHaveLength(1)
      expect(result.vision.traffic).toHaveLength(0)
      expect(result.vision.obstructions).toHaveLength(0)

      // Think
      expect(result.think.contextualRisks).toHaveLength(1)
      expect(result.think.contextualRisks[0].severity).toBe('high')
      expect(result.think.priorityImprovements).toHaveLength(1)
      expect(result.think.latentRisks).toHaveLength(1)
      expect(result.think.childPerspectiveRisks).toHaveLength(1)

      // Tips
      expect(result.educationalTips).toHaveLength(2)
    })

    it('returns default values for empty categories', () => {
      const raw = {
        vision: {},
        think: {},
      }

      const result = parseGeminiPipelineResponse(raw)

      expect(result.vision.safetyEquipment).toHaveLength(0)
      expect(result.vision.hazards).toHaveLength(0)
      expect(result.vision.traffic).toHaveLength(0)
      expect(result.vision.obstructions).toHaveLength(0)
      expect(result.think.contextualRisks).toHaveLength(0)
      expect(result.think.priorityImprovements).toHaveLength(0)
      expect(result.think.latentRisks).toHaveLength(0)
      expect(result.think.childPerspectiveRisks).toHaveLength(0)
      expect(result.educationalTips).toHaveLength(0)
    })

    it('handles null/undefined input gracefully', () => {
      const result = parseGeminiPipelineResponse(null)

      expect(result.vision.safetyEquipment).toHaveLength(0)
      expect(result.vision.hazards).toHaveLength(0)
      expect(result.think.contextualRisks).toHaveLength(0)
      expect(result.educationalTips).toHaveLength(0)
    })
  })

  describe('clampNum', () => {
    it('clamps confidence values above 1.0 to 1.0', () => {
      expect(clampNum(1.5, 0, 1, 0.5)).toBe(1.0)
      expect(clampNum(2.0, 0, 1, 0.5)).toBe(1.0)
    })

    it('clamps values below minimum', () => {
      expect(clampNum(-0.5, 0, 1, 0.5)).toBe(0)
    })

    it('returns fallback for NaN values', () => {
      expect(clampNum('invalid', 0, 1, 0.5)).toBe(0.5)
      expect(clampNum(undefined, 0, 1, 0.5)).toBe(0.5)
      expect(clampNum(null, 0, 1, 0.5)).toBe(0)
    })

    it('passes through valid values unchanged', () => {
      expect(clampNum(0.7, 0, 1, 0.5)).toBe(0.7)
    })
  })

  describe('parseBbox', () => {
    it('normalizes bbox values to 0-1 range', () => {
      const result = parseBbox({ x: 1.5, y: -0.2, width: 0.5, height: 2.0 })

      expect(result.x).toBe(1.0)
      expect(result.y).toBe(0)
      expect(result.width).toBe(0.5)
      expect(result.height).toBe(1.0)
    })

    it('returns zero bbox for null input', () => {
      const result = parseBbox(null)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })
  })

  describe('parseDetectionItems', () => {
    it('returns empty array for non-array input', () => {
      expect(parseDetectionItems(null as any, 'hazards')).toEqual([])
      expect(parseDetectionItems(undefined as any, 'hazards')).toEqual([])
      expect(parseDetectionItems('string' as any, 'hazards')).toEqual([])
    })

    it('sets default values for missing fields', () => {
      const items = parseDetectionItems([{ label: 'test' }], 'hazards')

      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('test')
      expect(items[0].description).toBe('')
      expect(items[0].count).toBe(1)
      expect(items[0].confidence).toBe(0.5)
      expect(items[0].coverageRatio).toBe(0)
      expect(items[0].positions).toHaveLength(0)
      expect(items[0].category).toBe('hazards')
    })

    it('falls back to type when label is missing', () => {
      const items = parseDetectionItems(
        [{ type: 'guardrail', description: 'ガードレール' }],
        'safety_equipment'
      )

      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('guardrail')
    })

    it('falls back to a safe integer when count is non-numeric', () => {
      const items = parseDetectionItems(
        [{ label: 'car', count: 'many' }],
        'traffic'
      )

      expect(items).toHaveLength(1)
      expect(items[0].count).toBe(1)
      expect(Number.isNaN(items[0].count)).toBe(false)
    })
  })

  describe('parseContextualRisks', () => {
    it('returns empty array for non-array input', () => {
      expect(parseContextualRisks(null as any)).toEqual([])
    })

    it('defaults severity to medium for invalid values', () => {
      const risks = parseContextualRisks([
        { description: 'test', severity: 'invalid' },
      ])

      expect(risks[0].severity).toBe('medium')
    })
  })
})
