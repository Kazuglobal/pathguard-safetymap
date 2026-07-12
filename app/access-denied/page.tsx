import Link from "next/link"
import { ArrowLeft, LockKeyhole, Map } from "lucide-react"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

export default function AccessDeniedPage() {
  const t = tankenTokens

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ backgroundColor: t.color.paper, backgroundImage: PAPER_NOISE, color: t.color.ink }}
    >
      <section
        className="w-full max-w-lg rounded-[22px] border p-6 text-center sm:p-8"
        style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }}
        aria-labelledby="access-denied-title"
      >
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: t.color.accentSoft, color: t.color.accentStrong }}
          aria-hidden="true"
        >
          <LockKeyhole className="h-8 w-8" />
        </span>
        <h1 id="access-denied-title" className="mt-5 text-2xl font-black">
          この画面は管理者専用です
        </h1>
        <p className="mt-3 text-sm leading-7" style={{ color: t.color.inkSoft }}>
          ログインはできていますが、このアカウントには管理画面を開く権限がありません。
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/map"
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-black text-white ${t.cls.focus}`}
            style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}
          >
            <Map className="h-5 w-5" aria-hidden="true" />
            安全マップへ
          </Link>
          <Link
            href="/mypage"
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 font-black ${t.cls.focus}`}
            style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.pressPaper }}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            マイページへ
          </Link>
        </div>
      </section>
    </main>
  )
}
