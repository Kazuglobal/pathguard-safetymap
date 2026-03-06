import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ARImageGallery } from '@/components/map/ar-image-gallery'

describe('ARImageGallery', () => {
  describe('rendering', () => {
    it('画像がない場合はプレースホルダーを表示する', () => {
      render(<ARImageGallery images={[]} alt="テスト画像" />)

      expect(screen.getByTestId('ar-image-placeholder')).toBeInTheDocument()
    })

    it('単一の画像を表示する', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('複数画像がある場合は最初の画像を表示する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('複数画像がある場合はインジケーターを表示する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      expect(screen.getByTestId('ar-image-indicators')).toBeInTheDocument()
      const indicators = screen.getAllByTestId('ar-image-indicator')
      expect(indicators).toHaveLength(2)
    })

    it('単一画像の場合はインジケーターを表示しない', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      expect(screen.queryByTestId('ar-image-indicators')).not.toBeInTheDocument()
    })

    it('複数画像がある場合はナビゲーションボタンを表示する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      expect(screen.getByTestId('ar-image-prev-button')).toBeInTheDocument()
      expect(screen.getByTestId('ar-image-next-button')).toBeInTheDocument()
    })

    it('画像カウンターを表示する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ]}
          alt="テスト画像"
        />
      )

      expect(screen.getByTestId('ar-image-counter')).toHaveTextContent('1 / 3')
    })
  })

  describe('navigation', () => {
    it('次へボタンで次の画像に切り替える', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const nextButton = screen.getByTestId('ar-image-next-button')
      fireEvent.click(nextButton)

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image2.jpg')
      expect(screen.getByTestId('ar-image-counter')).toHaveTextContent('2 / 2')
    })

    it('前へボタンで前の画像に切り替える', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      // まず次へ
      fireEvent.click(screen.getByTestId('ar-image-next-button'))
      // 前へ戻る
      fireEvent.click(screen.getByTestId('ar-image-prev-button'))

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('最後の画像で次へを押すと最初の画像に戻る（ループ）', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const nextButton = screen.getByTestId('ar-image-next-button')
      fireEvent.click(nextButton) // 2枚目
      fireEvent.click(nextButton) // 1枚目に戻る

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('最初の画像で前へを押すと最後の画像に移動する（ループ）', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const prevButton = screen.getByTestId('ar-image-prev-button')
      fireEvent.click(prevButton)

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image3.jpg')
      expect(screen.getByTestId('ar-image-counter')).toHaveTextContent('3 / 3')
    })

    it('インジケーターをクリックして特定の画像に移動できる', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const indicators = screen.getAllByTestId('ar-image-indicator')
      fireEvent.click(indicators[2]) // 3番目を選択

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image3.jpg')
    })
  })

  describe('callbacks', () => {
    it('画像切り替え時にonChangeコールバックが呼ばれる', () => {
      const onChange = vi.fn()

      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
          onChange={onChange}
        />
      )

      fireEvent.click(screen.getByTestId('ar-image-next-button'))

      expect(onChange).toHaveBeenCalledWith(1, 'https://example.com/image2.jpg')
    })

    it('画像クリック時にonClickコールバックが呼ばれる', () => {
      const onClick = vi.fn()

      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
          onClick={onClick}
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.mouseDown(image)
      fireEvent.mouseUp(image)

      expect(onClick).toHaveBeenCalledWith(0, 'https://example.com/image1.jpg')
    })
  })

  describe('styling', () => {
    it('カスタムクラス名を適用できる', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
          className="custom-class"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      expect(container).toHaveClass('custom-class')
    })

    it('現在選択中のインジケーターがアクティブスタイルになる', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const indicators = screen.getAllByTestId('ar-image-indicator')
      expect(indicators[0]).toHaveAttribute('data-active', 'true')
      expect(indicators[1]).toHaveAttribute('data-active', 'false')
    })
  })

  describe('loading states', () => {
    it('画像読み込み中にスケルトンを表示する', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      expect(screen.getByTestId('ar-image-skeleton')).toBeInTheDocument()
    })

    it('画像読み込み完了でスケルトンが消える', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.load(image)

      expect(screen.queryByTestId('ar-image-skeleton')).not.toBeInTheDocument()
    })

    it('画像切り替え時に未ロード画像のスケルトンを表示する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      // 1枚目をロード完了にする
      const image = screen.getByAltText('テスト画像')
      fireEvent.load(image)
      expect(screen.queryByTestId('ar-image-skeleton')).not.toBeInTheDocument()

      // 2枚目に切り替え（まだロードされていない）
      fireEvent.click(screen.getByTestId('ar-image-next-button'))
      expect(screen.getByTestId('ar-image-skeleton')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('画像読み込み失敗時にフォールバックUIを表示する', () => {
      render(
        <ARImageGallery
          images={['https://example.com/broken.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.error(image)

      expect(screen.getByTestId('ar-image-error')).toBeInTheDocument()
      expect(screen.getByText('画像を読み込めませんでした')).toBeInTheDocument()
    })

    it('エラー時にリトライボタンを表示する', () => {
      render(
        <ARImageGallery
          images={['https://example.com/broken.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.error(image)

      expect(screen.getByTestId('ar-image-retry-button')).toBeInTheDocument()
      expect(screen.getByText('再読み込み')).toBeInTheDocument()
    })

    it('リトライボタンクリックで再読み込みする', () => {
      render(
        <ARImageGallery
          images={['https://example.com/broken.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.error(image)

      // リトライクリック
      fireEvent.click(screen.getByTestId('ar-image-retry-button'))

      // エラー表示が消え、スケルトンが再表示される
      expect(screen.queryByTestId('ar-image-error')).not.toBeInTheDocument()
      expect(screen.getByTestId('ar-image-skeleton')).toBeInTheDocument()

      // srcにリトライパラメータが付与される
      const reloadedImage = screen.getByAltText('テスト画像')
      expect(reloadedImage.getAttribute('src')).toContain('_retry=1')
    })

    it('リトライ上限(3回)到達後はリトライボタンが消える', () => {
      render(
        <ARImageGallery
          images={['https://example.com/broken.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')

      // 3回リトライ → 全部失敗
      for (let i = 0; i < 3; i++) {
        fireEvent.error(image)
        fireEvent.click(screen.getByTestId('ar-image-retry-button'))
      }

      // 4回目のエラー後、リトライボタンが表示されない
      fireEvent.error(image)
      expect(screen.getByTestId('ar-image-error')).toBeInTheDocument()
      expect(screen.queryByTestId('ar-image-retry-button')).not.toBeInTheDocument()
    })

    it('images変更時にエラー状態とリトライ回数がリセットされる', () => {
      const { rerender } = render(
        <ARImageGallery
          images={['https://example.com/broken-1.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')

      // リトライ上限まで到達させる
      for (let i = 0; i < 3; i++) {
        fireEvent.error(image)
        fireEvent.click(screen.getByTestId('ar-image-retry-button'))
      }
      fireEvent.error(image)
      expect(screen.queryByTestId('ar-image-retry-button')).not.toBeInTheDocument()

      // 画像セットを入れ替える
      rerender(
        <ARImageGallery
          images={['https://example.com/broken-2.jpg']}
          alt="テスト画像"
        />
      )

      // 新しい画像では古いエラー状態を引き継がず、loadingから始まる
      expect(screen.getByTestId('ar-image-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('ar-image-error')).not.toBeInTheDocument()

      // 新しい画像でエラー時は再びリトライ可能
      const nextImage = screen.getByAltText('テスト画像')
      fireEvent.error(nextImage)
      expect(screen.getByTestId('ar-image-retry-button')).toBeInTheDocument()
    })

    it('エラー状態でもナビゲーションが機能する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/broken.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      // 1枚目をエラーにする
      const image = screen.getByAltText('テスト画像')
      fireEvent.error(image)
      expect(screen.getByTestId('ar-image-error')).toBeInTheDocument()

      // 2枚目に切り替え
      fireEvent.click(screen.getByTestId('ar-image-next-button'))

      // 2枚目は別の状態（loading）
      const nextImage = screen.getByAltText('テスト画像')
      expect(nextImage.getAttribute('src')).toBe('https://example.com/image2.jpg')
      expect(screen.getByTestId('ar-image-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('ar-image-error')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('画像に適切なalt属性が設定される', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="危険箇所の写真"
        />
      )

      const image = screen.getByAltText('危険箇所の写真')
      expect(image).toBeInTheDocument()
    })

    it('ナビゲーションボタンにaria-labelが設定される', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      expect(screen.getByTestId('ar-image-prev-button')).toHaveAttribute('aria-label', '前の画像')
      expect(screen.getByTestId('ar-image-next-button')).toHaveAttribute('aria-label', '次の画像')
    })

    it('カルーセルコンテナにroleとaria-roledescriptionが設定される', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="危険箇所"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      expect(container).toHaveAttribute('role', 'region')
      expect(container).toHaveAttribute('aria-roledescription', '画像カルーセル')
      expect(container).toHaveAttribute('aria-label', '危険箇所')
    })

    it('カウンターにaria-liveが設定される', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const counter = screen.getByTestId('ar-image-counter')
      expect(counter).toHaveAttribute('role', 'status')
      expect(counter).toHaveAttribute('aria-live', 'polite')
    })

    it('インジケーターにaria-labelとaria-currentが設定される', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const indicators = screen.getAllByTestId('ar-image-indicator')
      expect(indicators[0]).toHaveAttribute('aria-label', '画像1を表示')
      expect(indicators[0]).toHaveAttribute('aria-current', 'true')
      expect(indicators[1]).toHaveAttribute('aria-label', '画像2を表示')
      expect(indicators[1]).not.toHaveAttribute('aria-current')
    })

    it('ローディング状態にrole="status"が設定される', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      const skeleton = screen.getByTestId('ar-image-skeleton')
      expect(skeleton).toHaveAttribute('role', 'status')
      expect(skeleton).toHaveAttribute('aria-label', '画像を読み込み中')
    })

    it('エラー状態にrole="alert"が設定される', () => {
      render(
        <ARImageGallery
          images={['https://example.com/broken.jpg']}
          alt="テスト画像"
        />
      )

      const image = screen.getByAltText('テスト画像')
      fireEvent.error(image)

      const errorElement = screen.getByTestId('ar-image-error')
      expect(errorElement).toHaveAttribute('role', 'alert')
    })
  })

  describe('keyboard navigation', () => {
    it('右矢印キーで次の画像に移動する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      fireEvent.keyDown(container, { key: 'ArrowRight' })

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image2.jpg')
    })

    it('左矢印キーで前の画像に移動する', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      fireEvent.keyDown(container, { key: 'ArrowRight' })
      fireEvent.keyDown(container, { key: 'ArrowLeft' })

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('単一画像の場合はキーボードナビゲーションが動作しない', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      fireEvent.keyDown(container, { key: 'ArrowRight' })

      const image = screen.getByAltText('テスト画像')
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('複数画像の場合はコンテナがフォーカス可能', () => {
      render(
        <ARImageGallery
          images={[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ]}
          alt="テスト画像"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      expect(container).toHaveAttribute('tabIndex', '0')
    })

    it('単一画像の場合はtabIndexが設定されない', () => {
      render(
        <ARImageGallery
          images={['https://example.com/image1.jpg']}
          alt="テスト画像"
        />
      )

      const container = screen.getByTestId('ar-image-gallery')
      expect(container).not.toHaveAttribute('tabIndex')
    })
  })
})
