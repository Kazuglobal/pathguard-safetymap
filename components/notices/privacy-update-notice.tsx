"use client"

/**
 * 「氏名を預からないしくみにした」ことを、ログインしている人に一度だけ知らせる(UIUX改装 項目55)。
 *
 * - 閉じるか「くわしく」を押したら、この端末では二度と出さない
 * - 保存できない環境(プライベートモードなど)では、毎回出してしまわないよう出さない
 * - 初回の絵本オンボーディングが出る画面(/landing)では重ねずに、次に開いた画面で出す
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"

import { shouldShowTutorial } from "@/lib/tutorial-storage"

export const NAME_REMOVAL_NOTICE_KEY = "pg:notice:name-removal:v1"

function hasSeenNotice(): boolean {
  try {
    return localStorage.getItem(NAME_REMOVAL_NOTICE_KEY) === "1"
  } catch {
    return true
  }
}

function markNoticeSeen(): void {
  try {
    localStorage.setItem(NAME_REMOVAL_NOTICE_KEY, "1")
  } catch {
    // 保存できなくても閉じる操作は止めない
  }
}

export function PrivacyUpdateNotice() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasSeenNotice()) return
    if (pathname === "/landing" && shouldShowTutorial()) return
    setOpen(true)
  }, [pathname])

  if (!open) return null

  const close = () => {
    markNoticeSeen()
    setOpen(false)
  }

  return (
    <section
      role="status"
      aria-labelledby="privacy-update-notice-title"
      className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-2xl border bg-card p-4 pr-12 shadow-lg"
      data-testid="privacy-update-notice"
    >
      <button
        type="button"
        onClick={close}
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        aria-label="お知らせを閉じる"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <h2 id="privacy-update-notice-title" className="text-sm font-bold">
        お名前(氏名)を預からないしくみにしました
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        登録とプロフィールから氏名の欄をなくしました。これまでにお預かりした氏名と、LINE・Google から受け取ったお名前・アイコンも削除します。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={close}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          わかりました
        </button>
        <Link
          href="/privacy#revisions"
          onClick={close}
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline"
        >
          くわしく(プライバシーポリシー)
        </Link>
      </div>
    </section>
  )
}
