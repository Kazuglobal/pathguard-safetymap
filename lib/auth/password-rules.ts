/** パスワードの決まり。新規登録と設定(パスワードを変える)で同じものを使う */
export const PASSWORD_MIN_LENGTH = 8

export interface PasswordChecks {
  length: boolean
  letter: boolean
  number: boolean
}

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  }
}
