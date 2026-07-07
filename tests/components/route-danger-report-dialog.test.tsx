/**
 * TDD Component Tests: RouteDangerReportDialog
 *
 * RED Phase: These tests should FAIL because the component doesn't exist yet
 *
 * Target: components/routes/route-danger-report-dialog.tsx
 * Phase: Route Danger Report Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
vi.mock('@/lib/report-generation/route-danger-report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/report-generation/route-danger-report')>()

  return {
    ...actual,
    generatePDFReport: vi.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))),
    generateImageReport: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
    createReportSummary: vi.fn(() => ({
      totalDangers: 0,
      byType: {},
      byLevel: {},
    })),
  }
})

describe('RouteDangerReportDialog', () => {
  const mockRoute = mockRoutes[0]
  const mockOnClose = vi.fn()
  const originalCreateObjectUrl = URL.createObjectURL
  const originalRevokeObjectUrl = URL.revokeObjectURL
  const originalAnchorClick = HTMLAnchorElement.prototype.click

  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
    HTMLAnchorElement.prototype.click = originalAnchorClick
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

  describe('Photo Selection', () => {
    it('shows photo options for dangers that have multiple images', async () => {
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

      expect(screen.getAllByText('表示写真の選択').length).toBeGreaterThan(0)
      expect(screen.getByRole('radio', { name: /加工画像 1/ })).toBeInTheDocument()
      expect(screen.getAllByRole('radio', { name: /報告画像/ }).length).toBeGreaterThan(0)

      // 非公開バケット対応: サムネイルは署名URL経由で表示し、DB保存済みの生の
      // 公開URLを <img src> に直接使わない(署名前は表示しない)。回帰防止。
      expect(
        document.querySelector('img[src="https://example.com/danger1_processed.jpg"]')
      ).toBeNull()
      expect(
        document.querySelector('img[src="https://example.com/danger1.jpg"]')
      ).toBeNull()
    })

    it('defaults to the original report image when no image has been selected', async () => {
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

      const originalImageRadio = screen.getAllByRole('radio', { name: /報告画像/ })[0]
      const processedImageRadio = screen.getByRole('radio', { name: /加工画像 1/ })

      expect(originalImageRadio).toBeChecked()
      expect(processedImageRadio).not.toBeChecked()
    })

    it('passes the selected image map to report generation', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const reportGenerationModule = await import('@/lib/report-generation/route-danger-report')
      const mapboxConfigModule = await import('@/lib/mapbox-config')
      vi.spyOn(mapboxConfigModule, 'getMapboxToken').mockReturnValue('pk.test-token')

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      fireEvent.click(screen.getByRole('radio', { name: /加工画像 1/ }))
      fireEvent.click(screen.getByRole('button', { name: /ダウンロード/i }))

      await waitFor(() => {
        expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledTimes(1)
      })

      expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedImageUrls: {
            'danger-1': 'https://example.com/danger1_processed.jpg',
          },
        }),
        expect.any(String)
      )
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
      const reportGenerationModule = await import('@/lib/report-generation/route-danger-report')
      const mapboxConfigModule = await import('@/lib/mapbox-config')
      vi.spyOn(mapboxConfigModule, 'getMapboxToken').mockReturnValue('pk.test-token')

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

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledTimes(1)
      })
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

  describe('School Summary Opt-in', () => {
    it('shows the school summary checkbox when dangers exist', async () => {
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

      const checkbox = screen.getByRole('checkbox', { name: /学校・地域共有用/ })
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('does not show the checkbox when there are no dangers', async () => {
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

      expect(
        screen.queryByRole('checkbox', { name: /学校・地域共有用/ })
      ).not.toBeInTheDocument()
    })

    it('passes includeSchoolSummary: false to report generation by default', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
      const reportGenerationModule = await import('@/lib/report-generation/route-danger-report')
      const mapboxConfigModule = await import('@/lib/mapbox-config')
      vi.spyOn(mapboxConfigModule, 'getMapboxToken').mockReturnValue('pk.test-token')

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /ダウンロード/i }))

      await waitFor(() => {
        expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledTimes(1)
      })

      expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledWith(
        expect.objectContaining({ includeSchoolSummary: false }),
        expect.any(String)
      )
    })

    it('passes includeSchoolSummary: true when the checkbox is checked', async () => {
      const { useRouteDangers } = await import('@/hooks/use-route-dangers')
      vi.mocked(useRouteDangers).mockReturnValue({
        dangers: mockDangerReportsNearRoute,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
      const reportGenerationModule = await import('@/lib/report-generation/route-danger-report')
      const mapboxConfigModule = await import('@/lib/mapbox-config')
      vi.spyOn(mapboxConfigModule, 'getMapboxToken').mockReturnValue('pk.test-token')

      render(
        <RouteDangerReportDialog
          open={true}
          onClose={mockOnClose}
          route={mockRoute}
        />
      )

      fireEvent.click(screen.getByRole('checkbox', { name: /学校・地域共有用/ }))
      fireEvent.click(screen.getByRole('button', { name: /ダウンロード/i }))

      await waitFor(() => {
        expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledTimes(1)
      })

      expect(reportGenerationModule.generatePDFReport).toHaveBeenCalledWith(
        expect.objectContaining({ includeSchoolSummary: true }),
        expect.any(String)
      )
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
