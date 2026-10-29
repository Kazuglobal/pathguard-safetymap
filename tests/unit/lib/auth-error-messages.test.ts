// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  DUPLICATE_EMAIL_MESSAGE,
  EMAIL_NOT_CONFIRMED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  isRateLimitAuthError,
  isSessionMissingAuthError,
  LINK_EXPIRED_MESSAGE,
  OFFLINE_MESSAGE,
  RATE_LIMIT_MESSAGE,
  resolveAuthErrorMessage,
  SAME_PASSWORD_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SIGNUP_CLOSED_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
} from '@/lib/auth/error-messages'

const FALLBACK = 'うまくいきませんでした。時間をおいて、もう一度お試しください。'

describe('認証エラーの日本語の文(UIUX改装 項目42)', () => {
  it.each([
    [{ message: 'Invalid login credentials', code: 'invalid_credentials' }, INVALID_CREDENTIALS_MESSAGE],
    [{ message: 'Invalid login credentials' }, INVALID_CREDENTIALS_MESSAGE],
    [{ message: 'Email not confirmed', code: 'email_not_confirmed' }, EMAIL_NOT_CONFIRMED_MESSAGE],
    [{ message: 'User already registered', code: 'user_already_exists' }, DUPLICATE_EMAIL_MESSAGE],
    [{ message: 'A user with this email address has already been registered', code: 'email_exists' }, DUPLICATE_EMAIL_MESSAGE],
    [{ message: 'New password should be different from the old password.', code: 'same_password' }, SAME_PASSWORD_MESSAGE],
    [{ message: 'Password should be at least 6 characters.', code: 'weak_password' }, WEAK_PASSWORD_MESSAGE],
    [{ message: 'Unable to validate email address: invalid format', code: 'validation_failed' }, INVALID_EMAIL_MESSAGE],
    [{ message: 'Signups not allowed for this instance', code: 'signup_disabled' }, SIGNUP_CLOSED_MESSAGE],
    [{ message: 'Email link is invalid or has expired', code: 'otp_expired' }, LINK_EXPIRED_MESSAGE],
    [{ message: 'Auth session missing!' }, SESSION_EXPIRED_MESSAGE],
    [{ message: 'Email rate limit exceeded', code: 'over_email_send_rate_limit' }, RATE_LIMIT_MESSAGE],
    [{ message: 'Request rate limit reached' }, RATE_LIMIT_MESSAGE],
    [{ message: 'Failed to fetch' }, OFFLINE_MESSAGE],
    [{ message: 'Load failed' }, OFFLINE_MESSAGE],
    [{ message: 'Invalid API key' }, SERVICE_UNAVAILABLE_MESSAGE],
  ])('%o → 日本語の文', (error, expected) => {
    expect(resolveAuthErrorMessage(error, FALLBACK)).toBe(expected)
  })

  it('変換できないものは、英語のメッセージを返さずに呼び出し側の日本語の文に落とす', () => {
    expect(resolveAuthErrorMessage({ message: 'Database error saving new user' }, FALLBACK)).toBe(FALLBACK)
    expect(resolveAuthErrorMessage({ message: 'Unexpected failure', code: 'unexpected_failure' }, FALLBACK)).toBe(FALLBACK)
    expect(resolveAuthErrorMessage(new Error(''), FALLBACK)).toBe(FALLBACK)
    expect(resolveAuthErrorMessage(null, FALLBACK)).toBe(FALLBACK)
    expect(resolveAuthErrorMessage('文字だけ', FALLBACK)).toBe(FALLBACK)
  })

  it('コードを先に見る(入力したアドレスに「429」が入っていても、レート制限の文にしない)', () => {
    const error = { message: 'Email address "hanako0429@gmial.com" is invalid', code: 'email_address_invalid' }
    expect(resolveAuthErrorMessage(error, FALLBACK)).toBe(INVALID_EMAIL_MESSAGE)
    expect(isRateLimitAuthError(error)).toBe(false)
    // コードが無い古い形でも、「429」の文字だけではレート制限にしない
    expect(isRateLimitAuthError({ message: 'Email address "hanako0429@gmial.com" is invalid' })).toBe(false)
  })

  it('HTTP の状態が 429 なら、文やコードが無くてもレート制限', () => {
    expect(resolveAuthErrorMessage({ message: '', status: 429 }, FALLBACK)).toBe(RATE_LIMIT_MESSAGE)
    expect(isRateLimitAuthError({ status: 429 })).toBe(true)
  })

  it('画面が確かめる条件(8文字など)を、認証サービスの「弱いパスワード」の文にくり返さない。期限切れのリンクは開き方も伝える', () => {
    expect(WEAK_PASSWORD_MESSAGE).not.toMatch(/\d/)
    expect(LINK_EXPIRED_MESSAGE).toContain('同じブラウザ')
    expect(INVALID_EMAIL_MESSAGE).toBe('例: name@example.com の形で入力してください')
  })

  it('形の違反(validation_failed)でも、メールの話でなければメールの形の文にしない', () => {
    expect(resolveAuthErrorMessage({ message: 'Invalid redirect URL', code: 'validation_failed' }, FALLBACK)).toBe(FALLBACK)
  })

  it('利用者に見せる文に、英語・認証サービスの名前・設定の話を入れない', () => {
    const all = [
      DUPLICATE_EMAIL_MESSAGE, EMAIL_NOT_CONFIRMED_MESSAGE, INVALID_CREDENTIALS_MESSAGE, INVALID_EMAIL_MESSAGE,
      LINK_EXPIRED_MESSAGE, OFFLINE_MESSAGE, RATE_LIMIT_MESSAGE, SAME_PASSWORD_MESSAGE, SERVICE_UNAVAILABLE_MESSAGE,
      SESSION_EXPIRED_MESSAGE, SIGNUP_CLOSED_MESSAGE, WEAK_PASSWORD_MESSAGE,
    ]
    for (const message of all) {
      // 例示のアドレス(例: name@example.com)だけは英字のまま
      expect(message.replace('name@example.com', '')).not.toMatch(/Supabase|環境変数|API|[A-Za-z]{4,}/)
    }
    expect(DUPLICATE_EMAIL_MESSAGE).toBe('このメールアドレスは登録済みです')
  })

  it('レート制限とログインの期限切れを見分ける(「rate」を含むだけの文はレート制限にしない)', () => {
    expect(isRateLimitAuthError({ message: 'rate limit exceeded' })).toBe(true)
    expect(isRateLimitAuthError({ message: 'Could not generate a link' })).toBe(false)
    expect(isSessionMissingAuthError({ message: 'Auth session missing!' })).toBe(true)
    expect(isSessionMissingAuthError({ message: 'Invalid login credentials' })).toBe(false)
  })
})
