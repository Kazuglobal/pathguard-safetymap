// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildPersonalMetadataScrub, PERSONAL_METADATA_KEYS } from '@/lib/privacy/personal-metadata'

describe('buildPersonalMetadataScrub', () => {
  it('Google ログインが入れる名前・写真の URL だけを null にする(ほかのキーは触らない)', () => {
    const metadata = {
      iss: 'https://accounts.google.com',
      sub: '123',
      email: 'parent@example.com',
      email_verified: true,
      name: '山田 花子',
      full_name: '山田 花子',
      avatar_url: 'https://lh3.googleusercontent.com/a/photo',
      picture: 'https://lh3.googleusercontent.com/a/photo',
      provider_id: '123',
    }

    expect(buildPersonalMetadataScrub(metadata)).toEqual({
      full_name: null,
      name: null,
      avatar_url: null,
      picture: null,
    })
  })

  it('LINE の古いメタデータからは表示名・アイコンを消し、本人確認に使う line_user_id は残す', () => {
    const patch = buildPersonalMetadataScrub({
      provider: 'line',
      line_user_id: 'U123',
      name: 'はなこ',
      full_name: 'はなこ',
      avatar_url: 'https://profile.line-scdn.net/photo',
    })

    expect(patch).toEqual({ full_name: null, name: null, avatar_url: null })
    expect(patch).not.toHaveProperty('line_user_id')
    expect(patch).not.toHaveProperty('provider')
  })

  it('以前の登録フォームが入れた氏名(full_name)を消す', () => {
    expect(buildPersonalMetadataScrub({ full_name: '山田 太郎' })).toEqual({ full_name: null })
  })

  it('値が空文字や null でも、キーが残っていれば消す', () => {
    expect(buildPersonalMetadataScrub({ full_name: '', picture: null })).toEqual({ full_name: null, picture: null })
  })

  it('消すものが無ければ null(更新の API を呼ばずに済む)', () => {
    expect(buildPersonalMetadataScrub({ provider: 'line', line_user_id: 'U123' })).toBeNull()
    expect(buildPersonalMetadataScrub({})).toBeNull()
    expect(buildPersonalMetadataScrub(null)).toBeNull()
    expect(buildPersonalMetadataScrub(undefined)).toBeNull()
  })

  it('プロトタイプから継承したキーは数えない', () => {
    const inherited = Object.create({ full_name: '継承された値' }) as Record<string, unknown>
    expect(buildPersonalMetadataScrub(inherited)).toBeNull()
  })

  it('OIDC の名前に関わる標準クレームも対象にする', () => {
    expect(PERSONAL_METADATA_KEYS).toEqual(expect.arrayContaining([
      'given_name', 'family_name', 'middle_name', 'nickname', 'preferred_username',
    ]))
  })
})
