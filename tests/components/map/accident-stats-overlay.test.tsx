import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccidentStatsOverlay } from '@/components/map/accident-stats-overlay'
vi.mock('@/components/map/point-hazard-section', () => ({ PointHazardSection: () => null }))

vi.mock('@/components/danger-report/accident-stats-panel', () => ({ default: () => <div>集計の中身</div> }))

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
  // 事故の詳細から、事故をくわしく調べる画面へ(UIUX改装 項目43)
  it('links the loaded stats to the accident explorer and the road data page', () => {
    const stats = { totalAccidents: 3 } as unknown as NonNullable<Parameters<typeof AccidentStatsOverlay>[0]['stats']>
    render(<AccidentStatsOverlay {...props} status="loaded" stats={stats} />)
    expect(screen.getByRole('link', { name: /街の事故を調べる/ })).toHaveAttribute('href', '/accidents')
    expect(screen.getByRole('link', { name: /事故の多い道/ })).toHaveAttribute('href', '/xroad')
  })
  it('does not show the links before the stats are loaded', () => {
    render(<AccidentStatsOverlay {...props} />)
    expect(screen.queryByRole('link', { name: /街の事故を調べる/ })).not.toBeInTheDocument()
  })
  it('does not present a failed request as zero accidents', () => {
    render(<AccidentStatsOverlay {...props} status="error" />)
    expect(screen.getByText(/ゼロ件という意味ではありません/)).toBeInTheDocument()
    expect(screen.queryByText(/記録はありません/)).not.toBeInTheDocument()
  })
})
