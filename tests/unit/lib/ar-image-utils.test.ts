import { describe, it, expect } from 'vitest'
import {
  getReportImages,
  getAllReportImages,
  hasMultipleImages,
  getImageCount,
} from '@/lib/ar-image-utils'
import type { DangerReport } from '@/lib/types'

// テスト用のモックデータ
const createMockReport = (overrides: Partial<DangerReport> = {}): DangerReport => ({
  id: 'test-id-1',
  user_id: 'user-1',
  title: 'テスト危険箇所',
  description: 'テストの説明',
  latitude: 35.6762,
  longitude: 139.6503,
  danger_type: '交通',
  danger_level: 3,
  status: 'active',
  image_url: null,
  processed_image_urls: null,
  prefecture: '東京都',
  prefecture_code: 13,
  city: '渋谷区',
  municipality_code: '13113',
  town: '神宮前',
  postal_code: '150-0001',
  geocode_source: null,
  geocoded_at: null,
  geocode_confidence: null,
  address_hash: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('ar-image-utils', () => {
  describe('getReportImages', () => {
    it('画像がない場合は空配列を返す', () => {
      const report = createMockReport()
      const images = getReportImages(report)
      expect(images).toEqual([])
    })

    it('image_urlのみがある場合はそれを配列で返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/image1.jpg',
      })
      const images = getReportImages(report)
      expect(images).toEqual(['https://example.com/image1.jpg'])
    })

    it('processed_image_urlsのみがある場合はそれを返す', () => {
      const report = createMockReport({
        processed_image_urls: [
          'https://example.com/processed1.jpg',
          'https://example.com/processed2.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://example.com/processed1.jpg',
        'https://example.com/processed2.jpg',
      ])
    })

    it('image_urlとprocessed_image_urls両方がある場合は両方を結合して返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/original.jpg',
        processed_image_urls: [
          'https://example.com/processed1.jpg',
          'https://example.com/processed2.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://example.com/original.jpg',
        'https://example.com/processed1.jpg',
        'https://example.com/processed2.jpg',
      ])
    })

    it('重複するURLは除去される', () => {
      const report = createMockReport({
        image_url: 'https://example.com/same.jpg',
        processed_image_urls: [
          'https://example.com/same.jpg',
          'https://example.com/different.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://example.com/same.jpg',
        'https://example.com/different.jpg',
      ])
    })

    it('空文字列のURLは除外される', () => {
      const report = createMockReport({
        image_url: '',
        processed_image_urls: ['', 'https://example.com/valid.jpg', ''],
      })
      const images = getReportImages(report)
      expect(images).toEqual(['https://example.com/valid.jpg'])
    })
  })

  describe('getAllReportImages', () => {
    it('複数のレポートから全ての画像を取得する', () => {
      const reports: DangerReport[] = [
        createMockReport({
          id: 'report-1',
          image_url: 'https://example.com/report1.jpg',
        }),
        createMockReport({
          id: 'report-2',
          processed_image_urls: ['https://example.com/report2-1.jpg', 'https://example.com/report2-2.jpg'],
        }),
      ]

      const allImages = getAllReportImages(reports)
      expect(allImages).toHaveLength(2)
      expect(allImages[0]).toEqual({
        reportId: 'report-1',
        images: ['https://example.com/report1.jpg'],
      })
      expect(allImages[1]).toEqual({
        reportId: 'report-2',
        images: ['https://example.com/report2-1.jpg', 'https://example.com/report2-2.jpg'],
      })
    })

    it('画像がないレポートも含まれる（空配列として）', () => {
      const reports: DangerReport[] = [
        createMockReport({ id: 'report-1' }),
        createMockReport({
          id: 'report-2',
          image_url: 'https://example.com/image.jpg',
        }),
      ]

      const allImages = getAllReportImages(reports)
      expect(allImages).toHaveLength(2)
      expect(allImages[0]).toEqual({
        reportId: 'report-1',
        images: [],
      })
    })
  })

  describe('hasMultipleImages', () => {
    it('画像がない場合はfalseを返す', () => {
      const report = createMockReport()
      expect(hasMultipleImages(report)).toBe(false)
    })

    it('画像が1枚の場合はfalseを返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/single.jpg',
      })
      expect(hasMultipleImages(report)).toBe(false)
    })

    it('画像が2枚以上の場合はtrueを返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/original.jpg',
        processed_image_urls: ['https://example.com/processed.jpg'],
      })
      expect(hasMultipleImages(report)).toBe(true)
    })

    it('processed_image_urlsに2枚以上ある場合はtrueを返す', () => {
      const report = createMockReport({
        processed_image_urls: [
          'https://example.com/p1.jpg',
          'https://example.com/p2.jpg',
          'https://example.com/p3.jpg',
        ],
      })
      expect(hasMultipleImages(report)).toBe(true)
    })
  })

  describe('getImageCount', () => {
    it('画像がない場合は0を返す', () => {
      const report = createMockReport()
      expect(getImageCount(report)).toBe(0)
    })

    it('image_urlのみの場合は1を返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/single.jpg',
      })
      expect(getImageCount(report)).toBe(1)
    })

    it('全ての画像数を正しく返す', () => {
      const report = createMockReport({
        image_url: 'https://example.com/original.jpg',
        processed_image_urls: [
          'https://example.com/p1.jpg',
          'https://example.com/p2.jpg',
        ],
      })
      expect(getImageCount(report)).toBe(3)
    })

    it('重複画像は1回だけカウントされる', () => {
      const report = createMockReport({
        image_url: 'https://example.com/same.jpg',
        processed_image_urls: ['https://example.com/same.jpg'],
      })
      expect(getImageCount(report)).toBe(1)
    })
  })
})
