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
      fireEvent.click(image)

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
  })
})
