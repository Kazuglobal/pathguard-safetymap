import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccidentStatsOverlay } from '@/components/map/accident-stats-overlay'

const props = { status: 'loading' as const, stats: null, isMobile: true, awaitingLocationSelection: false, isReportFormOpen: false, onReset: vi.fn(), center: [139.957, 35.8983] as [number, number] }

describe('AccidentStatsOverlay', () => {
  it('identifies the selected center rather than claiming the data is for GPS', () => {
    render(<AccidentStatsOverlay {...props} />)
    expect(screen.getByText('選択地点の周辺事故')).toBeInTheDocument()
    expect(screen.getByText(/現在地とは別/)).toBeInTheDocument()
    expect(screen.getByText(/35.89830, 139.95700/)).toBeInTheDocument()
    expect(screen.queryByText(/記録はありません/)).not.toBeInTheDocument()
  })
  it('stays hidden while the reports sidebar or another panel is open', () => {
    render(<AccidentStatsOverlay {...props} isOtherPanelOpen />)
    expect(screen.queryByRole('region', { name: '周辺事故の集計' })).not.toBeInTheDocument()
  })
  it('shows the map and aggregate periods explicitly when older pins are visible', () => {
    render(<AccidentStatsOverlay {...props} mapYearWindow={{ minYear: 2019, maxYear: 2025 }} />)
    expect(screen.getByText('集計: 2021〜2025年の全事故')).toBeInTheDocument()
    expect(screen.getByText(/地図のピン: 2019〜2025年/)).toBeInTheDocument()
    expect(screen.getByText(/集計期間外のピンは件数に含みません/)).toBeInTheDocument()
  })
  it('does not present a failed request as zero accidents', () => {
    render(<AccidentStatsOverlay {...props} status="error" />)
    expect(screen.getByText(/ゼロ件という意味ではありません/)).toBeInTheDocument()
    expect(screen.queryByText(/記録はありません/)).not.toBeInTheDocument()
  })
})
