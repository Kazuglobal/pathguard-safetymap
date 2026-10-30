import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapEmptyAreaNotice } from '@/components/map/map-empty-area-notice'

function renderNotice(isTopDetailsOpen?: boolean) {
  const handlers = { onReport: vi.fn(), onShowHeatmap: vi.fn(), onDismiss: vi.fn() }
  const view = render(<MapEmptyAreaNotice {...handlers} isTopDetailsOpen={isTopDetailsOpen} />)
  return { ...handlers, ...view }
}

// 0件の案内は、上の列と下の操作の列のあいだの空いた所に出す(上の列の下に潜ると、見出しや「閉じる」が押せなくなる)
describe('MapEmptyAreaNotice placement', () => {
  it('sits in the space below the top rows instead of the middle of the screen', () => {
    renderNotice()

    const band = screen.getByTestId('map-empty-area-band')
    expect(band).toHaveClass(
      'top-[calc(env(safe-area-inset-top,0px)+8.5rem)]',
      'md:top-[calc(env(safe-area-inset-top,0px)+12.5rem)]',
      'bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)]',
      'md:bottom-[13.5rem]',
    )
    expect(band).not.toHaveClass('top-1/2')
    // 空いた所のまんなか。入りきらないときは下へはみ出す(自動の余白は足りないと 0 になる)
    expect(screen.getByTestId('map-empty-area-notice')).toHaveClass('my-auto')
  })

  it('moves below 「くわしい表示」 while that row is out', () => {
    renderNotice(true)

    const band = screen.getByTestId('map-empty-area-band')
    expect(band).toHaveClass(
      'top-[calc(env(safe-area-inset-top,0px)+12.5rem)]',
      'md:top-[calc(env(safe-area-inset-top,0px)+16.5rem)]',
    )
    expect(band).not.toHaveClass('top-[calc(env(safe-area-inset-top,0px)+8.5rem)]')
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
