import { describe, it, expect } from 'vitest'

import {
  isPrivateOrLoopbackHost,
  validateImageUrl,
} from '../../../supabase/functions/analyze-hazard/url-guard'

/**
 * analyze-hazard は image_url をエッジ関数自身が fetch するため、
 * validateImageUrl が唯一の SSRF ゲートになる(allowlist は既定で空)。
 *
 * 以前はソース文字列の正規表現一致で「判定が書いてあること」だけを見ていたが、
 * それでは判定が死んでいても緑になった(実際に IPv4-mapped の分岐が
 * 一度も成立しない書き方になっていたのを検出できなかった)。ここでは実挙動を通す。
 */
describe('analyze-hazard の image_url ガード', () => {
  describe('ブロックすべきホスト', () => {
    const blocked = [
      ['ループバック(IPv4)', 'https://127.0.0.1/x.png'],
      ['ループバック(10進表記 — URLが正規化)', 'https://2130706433/x.png'],
      ['ループバック(省略表記 — URLが正規化)', 'https://127.1/x.png'],
      ['0.0.0.0/8', 'https://0.0.0.0/x.png'],
      ['プライベート(10/8)', 'https://10.0.0.5/x.png'],
      ['プライベート(172.16/12)', 'https://172.20.1.1/x.png'],
      ['プライベート(192.168/16)', 'https://192.168.1.1/x.png'],
      ['リンクローカル(クラウドメタデータ)', 'https://169.254.169.254/x.png'],
      ['localhost', 'https://localhost/x.png'],
      ['.internal', 'https://metadata.google.internal/x.png'],
      ['.local', 'https://printer.local/x.png'],
      ['IPv6 ループバック', 'https://[::1]/x.png'],
      ['IPv6 未指定アドレス', 'https://[::]/x.png'],
      ['IPv6 ユニークローカル(fc00::/7)', 'https://[fd00::1]/x.png'],
      ['IPv6 リンクローカル(fe80::/10)', 'https://[fe80::1]/x.png'],
    ] as const

    it.each(blocked)('%s は拒否する', (_label, url) => {
      expect(validateImageUrl(url)).toBe('image_url host is not allowed')
    })
  })

  describe('IPv4-mapped / IPv4-compatible IPv6 — 回帰テスト', () => {
    // WHATWG URL は埋め込みIPv4を16進ピースへ正規化する
    // ([::ffff:127.0.0.1] → [::ffff:7f00:1])。
    // ドット付き十進で判定しようとすると一度も一致せず、素通りする
    const mapped = [
      ['[::ffff:127.0.0.1] (ループバック)', 'https://[::ffff:127.0.0.1]/x.png'],
      ['[::ffff:10.0.0.5] (プライベート)', 'https://[::ffff:10.0.0.5]/x.png'],
      ['[::ffff:169.254.169.254] (メタデータ)', 'https://[::ffff:169.254.169.254]/x.png'],
      ['[::127.0.0.1] (IPv4互換)', 'https://[::127.0.0.1]/x.png'],
      ['正規化後の形を直接指定', 'https://[::ffff:7f00:1]/x.png'],
    ] as const

    it.each(mapped)('%s は拒否する', (_label, url) => {
      expect(validateImageUrl(url)).toBe('image_url host is not allowed')
    })

    it('URL が16進ピースへ正規化することを前提として明示しておく', () => {
      expect(new URL('https://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]')
      expect(isPrivateOrLoopbackHost('[::ffff:7f00:1]')).toBe(true)
    })
  })

  describe('通すべきホスト', () => {
    it('公開のグローバルIPv4は通す', () => {
      expect(validateImageUrl('https://93.184.216.34/x.png')).toBeNull()
    })

    it('通常の公開ホスト名は通す', () => {
      expect(validateImageUrl('https://example.supabase.co/storage/x.png')).toBeNull()
    })

    it('グローバルIPv6は通す', () => {
      expect(validateImageUrl('https://[2001:db8::1]/x.png')).toBeNull()
    })
  })

  describe('スキームと形式', () => {
    it('http は拒否する', () => {
      expect(validateImageUrl('http://example.com/x.png')).toBe('image_url must use HTTPS')
    })

    it('URL として解釈できない値は拒否する', () => {
      expect(validateImageUrl('not a url')).toBe('image_url must be a valid HTTPS URL')
    })
  })

  describe('allowlist(VLM_ALLOWED_IMAGE_HOSTS 相当)', () => {
    it('指定時は許可ホストとそのサブドメインだけ通す', () => {
      const allowed = ['example.supabase.co']
      expect(validateImageUrl('https://example.supabase.co/x.png', allowed)).toBeNull()
      expect(validateImageUrl('https://cdn.example.supabase.co/x.png', allowed)).toBeNull()
      expect(validateImageUrl('https://evil.example/x.png', allowed)).toBe(
        'image_url host is not allowed'
      )
    })

    it('allowlist を指定してもプライベート宛先は通さない', () => {
      expect(validateImageUrl('https://[::ffff:10.0.0.5]/x.png', ['10.0.0.5'])).toBe(
        'image_url host is not allowed'
      )
    })
  })
})
