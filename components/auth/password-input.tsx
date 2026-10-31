"use client"

import { forwardRef, useState, type ComponentProps } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">

/**
 * パスワードの入力欄。右はしのボタンで、入れた文字を見せる・隠すを切り替えられる(UIUX改装 項目36)。
 * ログイン・新規登録・パスワードの再設定で同じものを使う。
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, id, disabled, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "入力したパスワードを隠す" : "入力したパスワードを表示する"}
        data-testid={id ? `${id}-visibility-toggle` : undefined}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
})
