import Link from "next/link"
import { ChevronRight } from "lucide-react"

/**
 * 地図の事故の表示から、事故をくわしく調べる画面へのリンク(UIUX改装 項目43)。
 * 事故ヒートマップの設定と、地点を選んだときの「周辺事故の集計」の下に出す。
 */
export const ACCIDENT_DATA_LINKS = [
  { href: "/accidents", label: "街の事故を調べる", description: "地域を選んで、事故の多い場所を一覧で見る" },
  { href: "/xroad", label: "事故の多い道", description: "国の道路データで、通学路のまわりの交通のあぶなさを見る" },
] as const

export function AccidentDataLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="事故をくわしく調べる" className={`grid gap-1.5 ${className}`}>
      {ACCIDENT_DATA_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{link.label}</span>
            <span className="block text-xs text-slate-600">{link.description}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  )
}
