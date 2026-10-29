import { CheckCircle2, Circle } from "lucide-react"

import { checkPassword, PASSWORD_RULE_LABELS, type PasswordChecks } from "@/lib/auth/password-rules"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color
const RULE_KEYS = Object.keys(PASSWORD_RULE_LABELS) as Array<keyof PasswordChecks>

/**
 * パスワードの条件の一覧。打つたびに、満たした条件に印が付く。
 * 新規登録・パスワードの再設定・設定(パスワードを変える)で同じものを出す(条件は lib/auth/password-rules.ts)。
 */
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  const checks = checkPassword(password)
  return (
    <ul id={id} className="space-y-1 text-xs font-bold" aria-label="パスワードの条件">
      {RULE_KEYS.map((key) => (
        <li key={key} className="flex items-center gap-2" style={{ color: checks[key] ? C.primaryStrong : C.inkSoft }}>
          {checks[key] ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
          {PASSWORD_RULE_LABELS[key]}
        </li>
      ))}
    </ul>
  )
}
