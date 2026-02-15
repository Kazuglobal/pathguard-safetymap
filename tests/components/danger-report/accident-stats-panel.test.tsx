/**
 * TDD Component Tests: AccidentStatsPanel
 *
 * Phase: Traffic Accident Statistics & Risk Score Feature
 * Target: components/danger-report/accident-stats-panel.tsx
 *
 * Test Coverage:
 * - Main component rendering (full/compact modes)
 * - Loading state
 * - Empty state (zero accidents)
 * - Error handling
 * - Risk level display
 * - Data visualization
 * - Interactions
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  mockHighRiskStats,
  mockMediumRiskStats,
  mockLowRiskStats,
  mockEmptyAccidentStats,
} from '@/tests/fixtures/accidents'

// Import components to test (will fail initially - RED phase)
import {
  AccidentStatsPanel,
  AccidentStatsLoading,
  AccidentStatsEmpty,
} from '@/components/danger-report/accident-stats-panel'

describe('AccidentStatsPanel', () => {
  describe('Full Mode (default)', () => {
    it('should render full accident statistics for high-risk location', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Risk score and label
      expect(screen.getByText('最高リスク')).toBeInTheDocument()
      expect(screen.getByText('(85/100)')).toBeInTheDocument()

      // Assert - Total accidents
      expect(screen.getByText('127')).toBeInTheDocument()

      // Assert - Fatal accidents
      expect(screen.getByText('3')).toBeInTheDocument()

      // Assert - Pedestrian accidents
      expect(screen.getByText('45')).toBeInTheDocument()
    })

    it('should display very_high risk level with correct styling', () => {
      // Act
      const { container } = render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Risk badge should have red/danger styling
      const riskBadge = container.querySelector('[data-risk-level="very_high"]')
      expect(riskBadge).toBeInTheDocument()
    })

    it('should display medium risk level with correct styling', () => {
      // Act
      const { container } = render(<AccidentStatsPanel stats={mockMediumRiskStats} />)

      // Assert - Risk badge should have yellow/warning styling
      const riskBadge = container.querySelector('[data-risk-level="medium"]')
      expect(riskBadge).toBeInTheDocument()
    })

    it('should display low risk level with correct styling', () => {
      // Act
      const { container } = render(<AccidentStatsPanel stats={mockLowRiskStats} />)

      // Assert - Risk badge should have green/success styling
      const riskBadge = container.querySelector('[data-risk-level="low"]')
      expect(riskBadge).toBeInTheDocument()
    })

    it('should show time distribution with school hours highlighted', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Should show time distribution section
      expect(screen.getByText(/時間帯別/i)).toBeInTheDocument()
      expect(screen.getByText(/14時:\s*10/i)).toBeInTheDocument()

      // School hours should be highlighted (7-9am, 2-5pm)
      const schoolHours = screen.getAllByTestId(/school-time/)
      expect(schoolHours.length).toBeGreaterThan(0)
    })

    it('should prefer bucketed time distribution when provided', () => {
      // Arrange
      const bucketedStats = {
        ...mockHighRiskStats,
        accidents_by_hour: mockHighRiskStats.accidents_by_hour.map((hour) => ({ ...hour, count: 0 })),
        time_buckets: [
          { label: '14-17時 (下校時間帯)', count: 12, is_school_time: true },
          { label: 'その他', count: 101, is_school_time: false },
        ],
      }

      // Act
      render(<AccidentStatsPanel stats={bucketedStats} />)

      // Assert
      expect(screen.getByText(/14-17時 \(下校時間帯\): 12/i)).toBeInTheDocument()
      expect(screen.queryByText(/14時:\s*10/i)).not.toBeInTheDocument()
    })

    it('should show accident types with pedestrian accidents highlighted', () => {
      // Act
      const { container } = render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Should show accident types (may appear multiple times)
      const pedestrianElements = screen.getAllByText('歩行者横断中')
      expect(pedestrianElements.length).toBeGreaterThan(0)

      // Pedestrian-related types should be highlighted (check for data-testid)
      const pedestrianTypes = container.querySelectorAll('[data-testid="pedestrian-related"]')
      expect(pedestrianTypes.length).toBeGreaterThan(0)
    })

    it('should show nearest accidents with distances', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Should show nearest accidents section
      expect(screen.getByText(/近隣の事故/i)).toBeInTheDocument()

      // Should show distances
      expect(screen.getByText(/45m/i)).toBeInTheDocument()

      // Should show child/pedestrian icons
      const childIcons = screen.getAllByText(/🎒/)
      const pedestrianIcons = screen.getAllByText(/🚶/)
      expect(childIcons.length + pedestrianIcons.length).toBeGreaterThan(0)
    })

    it('should show year-by-year trend', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Should show year trend
      expect(screen.getByText(/年次推移/i)).toBeInTheDocument()

      // Should show years
      expect(screen.getByText('2023')).toBeInTheDocument()
      expect(screen.getByText('2024')).toBeInTheDocument()
      expect(screen.getByText('2025')).toBeInTheDocument()
    })

    it('should show weather conditions', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Should show weather section
      expect(screen.getByText(/天候別/i)).toBeInTheDocument()

      // Should show weather types with counts
      expect(screen.getByText(/晴れ.*89/i)).toBeInTheDocument()
      expect(screen.getByText(/雨.*13/i)).toBeInTheDocument()
    })

    it('should mark fatal accidents with red indicator', () => {
      // Act
      const { container } = render(<AccidentStatsPanel stats={mockHighRiskStats} />)

      // Assert - Fatal accidents should have red dot or indicator
      const fatalIndicators = container.querySelectorAll('[data-severity="fatal"]')
      expect(fatalIndicators.length).toBeGreaterThan(0)
    })
  })

  describe('Compact Mode', () => {
    it('should render compact view with only essential stats', () => {
      // Act
      render(<AccidentStatsPanel stats={mockHighRiskStats} mode="compact" />)

      // Assert - Should show risk label and score
      expect(screen.getByText('最高リスク')).toBeInTheDocument()
      expect(screen.getByText('(85/100)')).toBeInTheDocument()

      // Should show minimal stats (2 cards)
      const statCards = screen.getAllByTestId('stat-card')
      expect(statCards.length).toBeLessThanOrEqual(2)

      // Should NOT show detailed breakdowns
      expect(screen.queryByText(/年次推移/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/近隣の事故/i)).not.toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should render empty state when no accidents', () => {
      // Act
      render(<AccidentStatsPanel stats={mockEmptyAccidentStats} />)

      // Assert - Should show zero risk
      expect(screen.getByText('0')).toBeInTheDocument()

      // Should show safe message
      expect(screen.getByText(/事故データなし/i)).toBeInTheDocument()
    })

    it('should render AccidentStatsEmpty component for zero accidents', () => {
      // Act
      render(<AccidentStatsEmpty />)

      // Assert - Should have safe/success styling
      expect(screen.getByText(/安全/i)).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should render loading skeleton', () => {
      // Act
      const { container } = render(<AccidentStatsLoading />)

      // Assert - Should have skeleton/loading indicators
      const loadingElements = container.querySelectorAll('[data-loading="true"]')
      expect(loadingElements.length).toBeGreaterThan(0)
    })
  })
})
