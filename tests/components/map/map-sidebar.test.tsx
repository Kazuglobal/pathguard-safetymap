import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MapSidebar from '@/components/map/map-sidebar'

vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }))
const props = { dangerReports: [], isLoading: false, selectedReport: null, onFilterChange: vi.fn(), filterOptions: { dangerType: 'all', dangerLevel: 'all', dateRange: 'all', showPending: true, prefecture: '千葉県' }, onReportSelect: vi.fn() }
describe('MapSidebar scope', () => {
  it('explains that an empty report list does not mean no accident records', () => {
    render(<MapSidebar {...props} />)
    expect(screen.getByText(/警察庁の事故ピンはこの一覧には含まれません/)).toBeInTheDocument()
    expect(screen.getByText(/事故の記録がないという意味ではありません/)).toBeInTheDocument()
    expect(screen.queryByText(/フィルターが適用中/)).not.toBeInTheDocument()
  })
  it('does not claim the report list is empty while loading', () => {
    render(<MapSidebar {...props} isLoading />)
    expect(screen.getByText(/報告を確認中/)).toBeInTheDocument()
    expect(screen.queryByText(/条件に合う報告はありません/)).not.toBeInTheDocument()
  })
})
