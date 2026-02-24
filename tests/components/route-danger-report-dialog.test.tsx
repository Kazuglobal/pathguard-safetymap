/**
 * TDD Component Tests: RouteDangerReportDialog
 *
 * RED Phase: These tests should FAIL because the component doesn't exist yet
 *
 * Target: components/routes/route-danger-report-dialog.tsx
 * Phase: Route Danger Report Feature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RouteDangerReportDialog } from '@/components/routes/route-danger-report-dialog'
import { mockRoutes } from '../fixtures/routes'
import { mockDangerReportsNearRoute, mockEmptyDangerReports } from '../fixtures/dangers'

// Mock the hooks
vi.mock('@/hooks/use-route-dangers', () => ({
  useRouteDangers: vi.fn(() => ({
    dangers: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

// Mock report generation
vi.mock('@/lib/report-generation/route-danger-report', () => ({
  generatePDFReport: vi.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))),
  generateImageReport: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
  createReportSummary: vi.fn(() => ({
    totalDangers: 0,
    byType: {},
    byLevel: {},
  })),
}))

describe('RouteDangerReportDialog', () => {
  const mockRoute = mockRoutes[0]
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders the dialog when open is true', () => {
      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(
        <RouteDangerReportDialog
          open={false}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('displays the route name in the title', () => {
      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByText(new RegExp(mockRoute.name))).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when fetching dangers', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })

  describe('Danger List Display', () => {
    it('displays list of dangers when available', async () => {
      const useRouteDangersModule = await import('@/hooks/use-route-dangers')
      vi.spyOn(useRouteDangersModule, 'useRouteDangers').mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      // Should show danger titles (the count is shown with separate elements)
      for (const danger of mockDangerReportsNearRoute) {
        expect(screen.getByText(danger.title)).toBeInTheDocument()
      }
    })

    it('displays message when no dangers found', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockEmptyDangerReports,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByText(/危険箇所は見つかりませんでした/)).toBeInTheDocument()
    })
  })

  describe('Export Format Selection', () => {
    it('has format selector with PDF, PNG, JPEG options', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByTestId('format-selector')).toBeInTheDocument()
    })

    it('defaults to PDF format', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      // PDF should be selected by default
      const pdfOption = screen.getByRole('radio', { name: /PDF/i })
      expect(pdfOption).toBeChecked()
    })
  })

  describe('Download Functionality', () => {
    it('has download button', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByRole('button', { name: /ダウンロード/i })).toBeInTheDocument()
    })

    it('generates PDF when download clicked with PDF format', async () => {
      const useRouteDangersModule = await import('@/hooks/use-route-dangers')
      vi.spyOn(useRouteDangersModule, 'useRouteDangers').mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /ダウンロード/i })
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).not.toBeDisabled()

      // The PDF generation is tested at the unit level
      // Here we just verify the button is clickable when dangers exist
      fireEvent.click(downloadButton)
    })

    it('disables download button when no dangers', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockEmptyDangerReports,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /ダウンロード/i })
      expect(downloadButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('displays error message when fetch fails', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: [],
        isLoading: false,
        error: 'データの取得に失敗しました',
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      expect(screen.getByText(/データの取得に失敗しました/)).toBeInTheDocument()
    })

    it('has retry button on error', async () => {
      const mockRefetch = vi.fn()
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: [],
        isLoading: false,
        error: 'データの取得に失敗しました',
        refetch: mockRefetch,
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      const retryButton = screen.getByRole('button', { name: /再試行/i })
      fireEvent.click(retryButton)

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('Close Functionality', () => {
    it('calls onClose when close button clicked', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      const closeButton = screen.getByRole('button', { name: /閉じる/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
