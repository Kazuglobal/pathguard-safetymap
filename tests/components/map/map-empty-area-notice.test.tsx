import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapEmptyAreaNotice } from '@/components/map/map-empty-area-notice'
import { BELOW_MAP_TOP_ROWS } from '@/lib/map-overlay-ui'

function renderNotice() {
  const handlers = { onReport: vi.fn(), onShowHeatmap: vi.fn(), onDismiss: vi.fn() }
  const view = render(<MapEmptyAreaNotice {...handlers} />)
  return { ...handlers, ...view }
}

// 0件の案内は、上の列と下の操作の列のあいだの帯に出す(上の列の下に潜ると見出しや「閉じる」が押せず、下にはみ出すと報告のボタンを覆う)
describe('MapEmptyAreaNotice placement', () => {
  it('sits in the band between the top rows and the bottom controls, instead of the middle of the screen', () => {
    renderNotice()

    const band = screen.getByTestId('map-empty-area-band')
    expect(band).toHaveClass(
      ...BELOW_MAP_TOP_ROWS.folded.split(' '),
      'bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)]',
      'md:bottom-[13.5rem]',
    )
    expect(band).not.toHaveClass('top-1/2')
  })

  it('stays inside the band and scrolls when it does not fit, so it never covers the report buttons', () => {
    renderNotice()

    // 帯のまんなか(自動の余白)。入りきらないときは帯の高さで止めて、中をスクロールさせる
    expect(screen.getByTestId('map-empty-area-notice')).toHaveClass('my-auto', 'max-h-full', 'overflow-y-auto')
  })
})

describe('MapEmptyAreaNotice actions', () => {
  it('offers the first report, the nationwide heatmap and closing', async () => {
    const user = userEvent.setup()
    const notice = renderNotice()

    await user.click(screen.getByRole('button', { name: '危険を報告する' }))
    await user.click(screen.getByRole('button', { name: /事故ヒートマップ\(全国データ\)を見る/ }))
    await user.click(screen.getByRole('button', { name: 'この案内を閉じる' }))

    expect(notice.onReport).toHaveBeenCalledTimes(1)
    expect(notice.onShowHeatmap).toHaveBeenCalledTimes(1)
    expect(notice.onDismiss).toHaveBeenCalledTimes(1)
  })
})
