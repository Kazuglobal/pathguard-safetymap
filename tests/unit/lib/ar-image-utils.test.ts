import { describe, it, expect } from 'vitest'
import {
  getReportImages,
  getAllReportImages,
  hasMultipleImages,
  getImageCount,
  isValidImageUrl,
} from '@/lib/ar-image-utils'
import type { DangerReport } from '@/lib/types'

// テスト用の許可されたホストのベースURL
const VALID_HOST = 'https://test.supabase.co/storage/v1/object/public'

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
  processed_image_url: null,
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
        image_url: 'https://test.supabase.co/storage/v1/object/public/image1.jpg',
      })
      const images = getReportImages(report)
      expect(images).toEqual(['https://test.supabase.co/storage/v1/object/public/image1.jpg'])
    })

    it('processed_image_url（単数形）のみがある場合はそれを配列で返す', () => {
      const report = createMockReport({
        processed_image_url: 'https://test.supabase.co/storage/v1/object/public/single-processed.jpg',
      })
      const images = getReportImages(report)
      expect(images).toEqual(['https://test.supabase.co/storage/v1/object/public/single-processed.jpg'])
    })

    it('processed_image_url（単数形）とprocessed_image_urls（複数形）の両方がある場合は結合して返す', () => {
      const report = createMockReport({
        processed_image_url: 'https://test.supabase.co/storage/v1/object/public/single-processed.jpg',
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/multi-processed1.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://test.supabase.co/storage/v1/object/public/single-processed.jpg',
        'https://test.supabase.co/storage/v1/object/public/multi-processed1.jpg',
      ])
    })

    it('processed_image_url（単数形）の重複は除去される', () => {
      const report = createMockReport({
        processed_image_url: 'https://test.supabase.co/storage/v1/object/public/same.jpg',
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/same.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://test.supabase.co/storage/v1/object/public/same.jpg',
      ])
    })

    it('processed_image_urlsのみがある場合はそれを返す', () => {
      const report = createMockReport({
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/processed1.jpg',
          'https://test.supabase.co/storage/v1/object/public/processed2.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://test.supabase.co/storage/v1/object/public/processed1.jpg',
        'https://test.supabase.co/storage/v1/object/public/processed2.jpg',
      ])
    })

    it('image_urlとprocessed_image_urls両方がある場合は両方を結合して返す', () => {
      const report = createMockReport({
        image_url: 'https://test.supabase.co/storage/v1/object/public/original.jpg',
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/processed1.jpg',
          'https://test.supabase.co/storage/v1/object/public/processed2.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://test.supabase.co/storage/v1/object/public/original.jpg',
        'https://test.supabase.co/storage/v1/object/public/processed1.jpg',
        'https://test.supabase.co/storage/v1/object/public/processed2.jpg',
      ])
    })

    it('重複するURLは除去される', () => {
      const report = createMockReport({
        image_url: 'https://test.supabase.co/storage/v1/object/public/same.jpg',
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/same.jpg',
          'https://test.supabase.co/storage/v1/object/public/different.jpg',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([
        'https://test.supabase.co/storage/v1/object/public/same.jpg',
        'https://test.supabase.co/storage/v1/object/public/different.jpg',
      ])
    })

    it('空文字列のURLは除外される', () => {
      const report = createMockReport({
        image_url: '',
        processed_image_urls: ['', 'https://test.supabase.co/storage/v1/object/public/valid.jpg', ''],
      })
      const images = getReportImages(report)
      expect(images).toEqual(['https://test.supabase.co/storage/v1/object/public/valid.jpg'])
    })
  })

  describe('getAllReportImages', () => {
    it('複数のレポートから全ての画像を取得する', () => {
      const reports: DangerReport[] = [
        createMockReport({
          id: 'report-1',
          image_url: 'https://test.supabase.co/storage/v1/object/public/report1.jpg',
        }),
        createMockReport({
          id: 'report-2',
          processed_image_urls: ['https://test.supabase.co/storage/v1/object/public/report2-1.jpg', 'https://test.supabase.co/storage/v1/object/public/report2-2.jpg'],
        }),
      ]

      const allImages = getAllReportImages(reports)
      expect(allImages).toHaveLength(2)
      expect(allImages[0]).toEqual({
        reportId: 'report-1',
        images: ['https://test.supabase.co/storage/v1/object/public/report1.jpg'],
      })
      expect(allImages[1]).toEqual({
        reportId: 'report-2',
        images: ['https://test.supabase.co/storage/v1/object/public/report2-1.jpg', 'https://test.supabase.co/storage/v1/object/public/report2-2.jpg'],
      })
    })

    it('画像がないレポートも含まれる（空配列として）', () => {
      const reports: DangerReport[] = [
        createMockReport({ id: 'report-1' }),
        createMockReport({
          id: 'report-2',
          image_url: 'https://test.supabase.co/storage/v1/object/public/image.jpg',
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
        image_url: 'https://test.supabase.co/storage/v1/object/public/single.jpg',
      })
      expect(hasMultipleImages(report)).toBe(false)
    })

    it('画像が2枚以上の場合はtrueを返す', () => {
      const report = createMockReport({
        image_url: 'https://test.supabase.co/storage/v1/object/public/original.jpg',
        processed_image_urls: ['https://test.supabase.co/storage/v1/object/public/processed.jpg'],
      })
      expect(hasMultipleImages(report)).toBe(true)
    })

    it('processed_image_urlsに2枚以上ある場合はtrueを返す', () => {
      const report = createMockReport({
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/p1.jpg',
          'https://test.supabase.co/storage/v1/object/public/p2.jpg',
          'https://test.supabase.co/storage/v1/object/public/p3.jpg',
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
        image_url: 'https://test.supabase.co/storage/v1/object/public/single.jpg',
      })
      expect(getImageCount(report)).toBe(1)
    })

    it('全ての画像数を正しく返す', () => {
      const report = createMockReport({
        image_url: 'https://test.supabase.co/storage/v1/object/public/original.jpg',
        processed_image_urls: [
          'https://test.supabase.co/storage/v1/object/public/p1.jpg',
          'https://test.supabase.co/storage/v1/object/public/p2.jpg',
        ],
      })
      expect(getImageCount(report)).toBe(3)
    })

    it('重複画像は1回だけカウントされる', () => {
      const report = createMockReport({
        image_url: 'https://test.supabase.co/storage/v1/object/public/same.jpg',
        processed_image_urls: ['https://test.supabase.co/storage/v1/object/public/same.jpg'],
      })
      expect(getImageCount(report)).toBe(1)
    })
  })

  describe('isValidImageUrl - セキュリティ検証', () => {
    describe('許可されるURL', () => {
      it('Supabase StorageのURLを許可する', () => {
        expect(isValidImageUrl('https://abc.supabase.co/storage/v1/object/public/images/test.jpg')).toBe(true)
        expect(isValidImageUrl('https://xyz.supabase.in/storage/v1/object/public/images/test.jpg')).toBe(true)
      })

      it('localhostのURLを許可する（開発環境）', () => {
        expect(isValidImageUrl('http://localhost:3000/images/test.jpg')).toBe(true)
        expect(isValidImageUrl('http://127.0.0.1:3000/images/test.jpg')).toBe(true)
      })

      it('Base64画像データURLを許可する', () => {
        expect(isValidImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')).toBe(true)
        expect(isValidImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true)
      })
    })

    describe('拒否されるURL - XSS攻撃防止', () => {
      it('javascript: プロトコルを拒否する', () => {
        expect(isValidImageUrl("javascript:alert('XSS')")).toBe(false)
        expect(isValidImageUrl("javascript:void(0)")).toBe(false)
        expect(isValidImageUrl("JAVASCRIPT:alert('XSS')")).toBe(false) // 大文字
      })

      it('data:text/html を拒否する', () => {
        expect(isValidImageUrl('data:text/html,<script>alert("XSS")</script>')).toBe(false)
        expect(isValidImageUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=')).toBe(false)
      })

      it('vbscript: プロトコルを拒否する', () => {
        expect(isValidImageUrl('vbscript:msgbox("XSS")')).toBe(false)
      })

      it('file: プロトコルを拒否する', () => {
        expect(isValidImageUrl('file:///etc/passwd')).toBe(false)
      })
    })

    describe('拒否されるURL - 許可されていないホスト', () => {
      it('外部サイトのURLを拒否する', () => {
        expect(isValidImageUrl('https://example.com/malicious.jpg')).toBe(false)
        expect(isValidImageUrl('https://evil-site.com/image.png')).toBe(false)
      })

      it('類似ドメイン攻撃を防ぐ', () => {
        expect(isValidImageUrl('https://supabase.co.evil.com/image.jpg')).toBe(false)
        expect(isValidImageUrl('https://fake-supabase.co/image.jpg')).toBe(false)
      })
    })

    describe('無効な入力', () => {
      it('空文字列を拒否する', () => {
        expect(isValidImageUrl('')).toBe(false)
        expect(isValidImageUrl('   ')).toBe(false)
      })

      it('nullやundefinedを拒否する', () => {
        expect(isValidImageUrl(null as unknown as string)).toBe(false)
        expect(isValidImageUrl(undefined as unknown as string)).toBe(false)
      })

      it('無効なURLを拒否する', () => {
        expect(isValidImageUrl('not-a-url')).toBe(false)
        expect(isValidImageUrl('://missing-protocol.com')).toBe(false)
      })
    })
  })

  describe('getReportImages - セキュリティ統合', () => {
    it('悪意のあるURLはフィルタリングされる', () => {
      const report = createMockReport({
        image_url: "javascript:alert('XSS')",
        processed_image_urls: [
          'https://evil.com/malicious.jpg',
          'data:text/html,<script>alert("XSS")</script>',
        ],
      })
      const images = getReportImages(report)
      expect(images).toEqual([])
    })

    it('安全なURLのみが返される', () => {
      const report = createMockReport({
        image_url: 'https://abc.supabase.co/storage/image.jpg',
        processed_image_urls: [
          'https://evil.com/malicious.jpg', // 除外される
          'data:image/png;base64,validBase64', // 許可される
        ],
      })
      const images = getReportImages(report)
      expect(images).toHaveLength(2)
      expect(images).toContain('https://abc.supabase.co/storage/image.jpg')
      expect(images).toContain('data:image/png;base64,validBase64')
    })
  })
})
