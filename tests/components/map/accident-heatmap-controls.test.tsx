import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccidentHeatmapControls } from '@/components/map/accident-heatmap-controls'
import { DEFAULT_HEATMAP_FILTERS } from '@/lib/traffic-accident-heatmap'

describe('AccidentHeatmapControls', () => {
  it('toggles visibility from header button', () => {
    const onToggleVisibility = vi.fn()

    render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={false}
        onToggleVisibility={onToggleVisibility}
        isLoading={false}
        featureCount={0}
        error={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '事故ヒートマップ表示切替' }))
    expect(onToggleVisibility).toHaveBeenCalledTimes(1)
  })

  it('shows loading, count, and error states when visible', () => {
    const { rerender } = render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={true}
        onToggleVisibility={vi.fn()}
        isLoading={true}
        featureCount={128}
        error={null}
      />,
    )

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()

    rerender(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={true}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={128}
        error="取得エラー"
      />,
    )

    expect(screen.getByText('128件表示中')).toBeInTheDocument()
    expect(screen.getByText('取得エラー')).toBeInTheDocument()
  })

  it('describes child and young filters with explicit semantics', () => {
    render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={true}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={128}
        error={null}
      />,
    )

    expect(screen.getByText('子ども関与（補充票確認分）のみ')).toBeInTheDocument()
    expect(screen.getByText('※ 子ども関与は補充票確認分で判定')).toBeInTheDocument()
    expect(screen.getByText('若年者関与（24歳以下コード）のみ')).toBeInTheDocument()
    expect(screen.getByText('※ 若年者関与は警察庁オープンデータの年齢区分コードで判定')).toBeInTheDocument()
    expect(screen.getByText('※ 同時選択時は両方の条件に一致する事故のみ表示')).toBeInTheDocument()
    expect(screen.queryByText('24歳以下関与のみ')).not.toBeInTheDocument()
  })

  it('updates the young filter independently', () => {
    const onFiltersChange = vi.fn()

    render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={onFiltersChange}
        isVisible={true}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={128}
        error={null}
      />,
    )

    fireEvent.click(screen.getByLabelText('若年者関与（24歳以下コード）のみ'))
    expect(onFiltersChange).toHaveBeenCalledWith({ youngFilter: true })
  })

  it('renders a compact mobile trigger instead of the desktop card shell', () => {
    render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={false}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={0}
        error={null}
        isMobile={true}
      />,
    )

    expect(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' })).toBeInTheDocument()
    expect(screen.queryByText('対象期間')).not.toBeInTheDocument()
  })

  it('opens the mobile drawer and exposes the same filter controls', () => {
    render(
      <AccidentHeatmapControls
        filters={{ ...DEFAULT_HEATMAP_FILTERS, childFilter: true }}
        onFiltersChange={vi.fn()}
        isVisible={true}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={128}
        error={null}
        isMobile={true}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' }))

    expect(screen.getByText('対象期間')).toBeInTheDocument()
    expect(screen.getByText('128件表示中')).toBeInTheDocument()
    expect(screen.getByText('子ども関与（補充票確認分）のみ')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('keeps the mobile trigger available even when the heatmap is hidden', () => {
    render(
      <AccidentHeatmapControls
        filters={DEFAULT_HEATMAP_FILTERS}
        onFiltersChange={vi.fn()}
        isVisible={false}
        onToggleVisibility={vi.fn()}
        isLoading={false}
        featureCount={0}
        error={null}
        isMobile={true}
      />,
    )

    expect(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' })).toBeInTheDocument()
  })
})
