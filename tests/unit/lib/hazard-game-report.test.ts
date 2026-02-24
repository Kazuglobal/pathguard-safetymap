/**
 * TDD Unit Tests: Hazard Game Report (A10: ReportAgent)
 *
 * AGENT_TEAM.md test_report_agent.py 仕様準拠 (3テストケース)
 *
 * Target: lib/hazard-game-report.ts
 */

import { describe, it, expect } from 'vitest'
import {
  generateSafetyReport,
  formatReportAsText,
} from '@/lib/hazard-game-report'
import type { PipelineAnalysisResult } from '@/lib/hazard-game-types'

// ---- Test Fixtures ----

function createMockPipelineResult(): PipelineAnalysisResult {
  return {
    vision: {
      safetyEquipment: [
        {
          category: 'safety_equipment',
          label: 'guardrail',
          description: 'Metal guardrail',
          count: 1,
          confidence: 0.9,
          coverageRatio: 0.1,
          positions: [],
        },
      ],
      hazards: [
        {
          category: 'hazards',
          label: '工事現場',
          description: 'Road construction',
          count: 1,
          confidence: 0.85,
          coverageRatio: 0.15,
          positions: [],
        },
      ],
      traffic: [
        {
          category: 'traffic',
          label: 'car',
          description: 'Vehicles on road',
          count: 3,
          confidence: 0.8,
          coverageRatio: 0.2,
          positions: [],
        },
      ],
      obstructions: [],
      inferenceTimeMs: 1500,
    },
    think: {
      contextualRisks: [
        {
          description: 'Construction near school zone increases risk',
          severity: 'high',
          relatedDetections: ['工事現場'],
        },
        {
          description: 'Limited visibility at corner',
          severity: 'medium',
          relatedDetections: [],
        },
      ],
      priorityImprovements: ['Add temporary barriers', 'Improve signage'],
      latentRisks: ['Noise pollution may affect concentration'],
      childPerspectiveRisks: ['Low visibility due to height'],
    },
    score: {
      score: 62,
      level: 'caution',
      breakdown: [
        { item: '横断歩道', category: 'safety_equipment', points: -15, reason: '横断歩道が検出されませんでした' },
        { item: '信号機', category: 'safety_equipment', points: -10, reason: '信号機が検出されませんでした' },
        { item: '工事現場', category: 'hazards', points: -10, reason: '危険要素「工事現場」を1件検出' },
        { item: 'Construction near school', category: 'contextual', points: -5, reason: '高リスク: Construction near school zone' },
      ],
      detectionSummary: {
        safetyEquipmentCount: 1,
        hazardCount: 1,
        trafficCount: 1,
        obstructionCount: 0,
      },
      thinkSummary: {
        contextualRiskCount: 2,
        highSeverityCount: 1,
        mediumSeverityCount: 1,
        lowSeverityCount: 0,
      },
    },
    educationalTips: [
      '工事現場の近くでは特に注意しましょう',
      '横断歩道がない場所では左右をよく確認',
    ],
    analysisTimestamp: '2025-01-15T10:30:00.000Z',
  }
}

// ---- Tests ----

describe('hazard-game-report', () => {
  describe('generateSafetyReport', () => {
    it('generates a parent report with score and key risks', () => {
      const result = createMockPipelineResult()
      const report = generateSafetyReport(result, 'parent')

      expect(report.title).toBeDefined()
      expect(report.title.length).toBeGreaterThan(0)
      expect(report.generatedAt).toBeDefined()
      expect(report.score).toBe(result.score)
      expect(report.sections.length).toBeGreaterThan(0)
      expect(report.recommendations.length).toBeGreaterThan(0)

      // Parent report should include score info
      const scoreSection = report.sections.find(
        (s) => s.title.includes('スコア') || s.title.includes('安全')
      )
      expect(scoreSection).toBeDefined()

      // Parent report should mention key risks
      const riskSection = report.sections.find(
        (s) => s.title.includes('リスク') || s.title.includes('危険')
      )
      expect(riskSection).toBeDefined()
    })

    it('generates a municipality report with all quantitative data', () => {
      const result = createMockPipelineResult()
      const report = generateSafetyReport(result, 'municipality')

      expect(report.title).toBeDefined()
      expect(report.sections.length).toBeGreaterThan(0)

      // Municipality report should be more detailed
      const text = formatReportAsText(report)

      // Should contain numerical data
      expect(text).toContain('62')  // score
      expect(text).toContain('注意') // level label

      // Should include detection category data
      expect(text).toMatch(/安全設備|safety/i)
      expect(text).toMatch(/危険|hazard/i)
    })

    it('throws error for invalid report type', () => {
      const result = createMockPipelineResult()

      expect(() => {
        generateSafetyReport(result, 'invalid' as any)
      }).toThrow()
    })
  })

  describe('formatReportAsText', () => {
    it('formats report as readable text', () => {
      const result = createMockPipelineResult()
      const report = generateSafetyReport(result, 'parent')
      const text = formatReportAsText(report)

      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain(report.title)
    })
  })
})
