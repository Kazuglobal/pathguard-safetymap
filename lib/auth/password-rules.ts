/**
 * パスワードの決まり。新規登録・パスワードの再設定・設定(パスワードを変える)で同じものを使う。
 * 条件の一覧は components/auth/password-checklist.tsx が、ここの言い方で出す。
 */
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

/** 条件の言い方(画面の一覧に出す順) */
export const PASSWORD_RULE_LABELS: Readonly<Record<keyof PasswordChecks, string>> = {
  length: `${PASSWORD_MIN_LENGTH}文字以上で入力してください`,
  letter: "英字（アルファベット）を含めてください",
  number: "数字を含めてください",
}

/** 条件をすべて満たしているか */
export function isPasswordValid(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean)
}

/** 条件を満たさずに送ろうとしたときの文 */
export const PASSWORD_RULES_ERROR = "パスワードの3つの条件をすべて満たしてください"
