import Link from "next/link"
import { ArrowLeft } from "lucide-react"

/** パスワードを忘れたとき・再設定の画面の「ログインに戻る」 */
export function BackToLogin({ label = "ログインに戻る" }: { label?: string }) {
  return (
    <div className="mt-6 text-center">
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 hover:underline"
        data-testid="back-to-login"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </div>
  )
}
