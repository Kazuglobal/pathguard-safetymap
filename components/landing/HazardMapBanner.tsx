import Link from "next/link"
import { MapPin, ChevronRight } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * リアルタイム危険マップへの誘導バナー。
 * 以前はクリックすると偽のプレースホルダー地図モーダルが開く行き止まりだったが、
 * 地図ページへ直接遷移するシンプルなリンクに改めた。
 */
export function HazardMapBanner() {
  return (
    <section className="px-4 py-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/map"
          className={`group relative block w-full overflow-hidden rounded-[22px] border p-6 text-left transition-transform active:translate-y-[2px] md:p-10 ${tankenTokens.cls.focus}`}
          style={{
            background: C.night,
            borderColor: "rgba(255,255,255,.08)",
            boxShadow: tankenTokens.shadow.card,
          }}
        >
          {/* 点線ルートの装飾 */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
            viewBox="0 0 600 160"
            preserveAspectRatio="none"
          >
            <path
              d="M-10 130 Q 120 60 260 100 T 610 50"
              fill="none"
              stroke={C.sun}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="1 14"
            />
            <circle cx="260" cy="100" r="6" fill={C.accent} />
            <circle cx="470" cy="72" r="6" fill={C.sun} />
          </svg>

          <div className="relative flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p
                className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-widest"
                style={{ color: "rgba(255,255,255,.65)" }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 animate-pulse rounded-full"
                  style={{ background: C.sun }}
                />
                リアルタイム更新
              </p>
              <h3 className="mb-1 text-xl font-black leading-snug text-white md:text-2xl">
                今、近所のどこに「気をつけて」があるか
              </h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,.7)" }}>
                不審者情報・交通の危険・みんなの報告を、1枚の地図で
              </p>
            </div>
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-1"
              style={{ background: C.sun, boxShadow: "0 3px 0 #E2A812" }}
            >
              <ChevronRight className="h-6 w-6" style={{ color: C.ink }} aria-hidden="true" />
              <span className="sr-only">地図をひらく</span>
            </span>
          </div>

          <p
            className="relative mt-4 flex items-center gap-1 text-xs font-bold"
            style={{ color: C.sun }}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            地図をひらく
          </p>
        </Link>
      </div>
    </section>
  )
}
