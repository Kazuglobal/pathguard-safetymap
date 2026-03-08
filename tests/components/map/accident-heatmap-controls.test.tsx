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

  it('describes the child filter using child involvement wording', () => {
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

    expect(screen.getByText('子ども関与のみ')).toBeInTheDocument()
    expect(screen.getByText('※ 子ども関与は補充票確認分で判定')).toBeInTheDocument()
    expect(screen.queryByText('24歳以下関与のみ')).not.toBeInTheDocument()
  })
})
