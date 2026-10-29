"use client"

import Link from "next/link"
import {
  ChevronRight,
  MapPin,
  MessagesSquare,
  Route,
} from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/** 読み込み中に出す骨組みの数。ready のセル(この30日の注意地点・通学路)の数とそろえる。 */
const LOADING_PLACEHOLDER_COUNT = 2

/** 骨組みと ready のセルで同じ最小高さを使い、読み込み完了時のレイアウトシフトを防ぐ。 */
const QUICK_CHECK_MIN_HEIGHT = "min-h-[108px]"

export interface ChildRouteQuickCheck {
  id: string
  title: string
  value: string
  /** 値の下に小さく添える補足(例: 徒歩約12分)。 */
  detail?: string
  href: string
  description?: string
}

export interface NewsPreviewItem {
  id: string
  title: string
  categoryLabel: string
  categoryColor: string
  slug: string
}

export type ChildRouteDashboardState =
  | "loading"
  | "empty"
  | "needs_setup"
  | "error"
  | "ready"

interface ChildRouteDashboardProps {
  state: ChildRouteDashboardState
  childName?: string
  errorMessage?: string
  quickChecks?: ChildRouteQuickCheck[]
  retryHref?: string
  newsPreview?: NewsPreviewItem[]
}

/** セルの数に合わせて列数を決める(Tailwind が拾えるようクラス名は固定の文字列で持つ)。 */
function getQuickCheckGridClass(count: number) {
  if (count >= 3) return "grid-cols-3"
  if (count === 2) return "grid-cols-2"
  return "grid-cols-1"
}

/** 状態メッセージ付きの案内パネル(empty / needs_setup / error 共通の見た目)。 */
function GuidancePanel({
  tone,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  tone: "sun" | "accent" | "danger"
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
}) {
  const toneStyles = {
    sun: { bg: C.sunSoft, border: "rgba(226,168,18,.4)", cta: "#8A6A0C" },
    accent: { bg: C.accentSoft, border: "rgba(216,102,10,.35)", cta: C.accentStrong },
    danger: { bg: C.dangerSoft, border: "rgba(217,85,85,.35)", cta: C.danger },
  }[tone]

  return (
    <div
      className="mt-4 rounded-[18px] border-2 border-dashed p-5"
      style={{ background: toneStyles.bg, borderColor: toneStyles.border }}
    >
      <p className="text-sm font-bold" style={{ color: C.ink }}>
        {title}
      </p>
      <p className="mt-1 text-sm leading-6" style={{ color: C.inkSoft }}>
        {body}
      </p>
      <Link
        href={ctaHref}
        className={`mt-3 inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold transition-transform active:translate-y-[2px] active:shadow-none ${tankenTokens.cls.focus}`}
        style={{
          background: C.card,
          borderColor: tankenTokens.border.soft,
          color: toneStyles.cta,
          boxShadow: tankenTokens.shadow.pressPaper,
        }}
      >
        {ctaLabel}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

export function ChildRouteDashboard({
  state,
  childName,
  errorMessage,
  quickChecks = [],
  retryHref = "/map",
  newsPreview,
}: ChildRouteDashboardProps) {
  const resolvedErrorMessage =
    errorMessage && errorMessage !== "最新の危険情報を読み込めませんでした。"
      ? errorMessage
      : "時間をおいて再試行するか、マップで通学路を確認してください。"

  // 呼び名(例: さくちゃん)には「さん」を付けない
  const leadText = `${childName ? `${childName}向け` : "登録した通学路向け"}の注意点を毎朝3分で確認できます。`

  const getQuickCheckIcon = (item: ChildRouteQuickCheck) => {
    if (item.id === "share" || item.title.includes("共有")) {
      return MessagesSquare
    }
    if (item.id === "route" || item.title.includes("ルート")) {
      return Route
    }

    return MapPin
  }

  return (
    <section
      data-testid="child-route-dashboard"
      className="py-3 md:py-4"
      style={{ background: C.paper }}
    >
      <div className="mx-auto max-w-xl px-4">
        <div
          className="rounded-[22px] border p-4 md:p-5"
          style={{
            background: C.card,
            borderColor: tankenTokens.border.faint,
            boxShadow: tankenTokens.shadow.card,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-black tracking-tight" style={{ color: C.ink }}>
                今日の通学3分チェック
              </h2>
              <p className="mt-1 text-xs md:hidden" style={{ color: C.inkSoft }}>
                {leadText}
              </p>
            </div>
            <p className="hidden text-sm leading-6 md:block" style={{ color: C.inkSoft }}>
              {leadText}
            </p>
            {/* 通学路が未登録のときは「通学路を登録する」だけを出し、次の行動を1つに絞る */}
            {state !== "empty" && (
              <Link
                href="/map"
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white transition-transform active:translate-y-[2px] active:shadow-none ${tankenTokens.cls.focus}`}
                style={{ background: C.primary, boxShadow: "0 3px 0 #0C7A55" }}
              >
                地図を見る
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </div>

          {state === "loading" ? (
            // ready 時と同じ高さを確保してレイアウトシフトを防ぐ
            <div
              className={`mt-2 grid ${getQuickCheckGridClass(LOADING_PLACEHOLDER_COUNT)} gap-2`}
              aria-label="読み込み中"
              role="status"
            >
              {Array.from({ length: LOADING_PLACEHOLDER_COUNT }).map((_, index) => (
                <div
                  key={index}
                  className={`flex ${QUICK_CHECK_MIN_HEIGHT} animate-pulse flex-col items-center justify-center gap-2 rounded-[14px] border p-2.5`}
                  style={{ background: C.paperDeep, borderColor: tankenTokens.border.faint }}
                >
                  <div className="h-4 w-10 rounded-full" style={{ background: "rgba(67,57,43,.12)" }} />
                  <div className="h-7 w-7 rounded-full" style={{ background: "rgba(67,57,43,.10)" }} />
                  <div className="h-3 w-14 rounded-full" style={{ background: "rgba(67,57,43,.08)" }} />
                  <span className="sr-only">読み込み中</span>
                </div>
              ))}
            </div>
          ) : state === "needs_setup" ? (
            <GuidancePanel
              tone="accent"
              title="この通学路はまだシミュレーション準備中です"
              body="ルートをもう一度設定すると、危険地点や見直しポイントをここで表示できます。"
              ctaLabel="通学路を見直す"
              ctaHref="/routes"
            />
          ) : state === "empty" ? (
            <GuidancePanel
              tone="sun"
              title="通学路を登録すると、わが子向けの注意が表示されます"
              body="まずはルートを1件登録すると、危険地点や見直しポイントをここで確認できます。"
              ctaLabel="通学路を登録する"
              ctaHref="/routes"
            />
          ) : state === "error" ? (
            <GuidancePanel
              tone="danger"
              title="最新の危険情報を読み込めませんでした。"
              body={resolvedErrorMessage}
              ctaLabel="マップで確認する"
              ctaHref={retryHref}
            />
          ) : (
            <>
              <div className={`mt-2 grid ${getQuickCheckGridClass(quickChecks.length)} gap-2`}>
                {quickChecks.map((item) => {
                  const Icon = getQuickCheckIcon(item)

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`group flex ${QUICK_CHECK_MIN_HEIGHT} flex-col items-center justify-center rounded-[14px] border p-2.5 text-center transition-transform hover:-translate-y-0.5 ${tankenTokens.cls.focus}`}
                      style={{
                        background: C.paperDeep,
                        borderColor: tankenTokens.border.faint,
                      }}
                    >
                      <span className="text-base font-black leading-tight" style={{ color: C.ink }}>
                        {item.value}
                      </span>
                      {item.detail ? (
                        <span className="mt-0.5 text-xs font-bold leading-tight" style={{ color: C.ink }}>
                          {item.detail}
                        </span>
                      ) : null}
                      <div
                        className="my-1 inline-flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ background: C.primarySoft, color: C.primaryStrong }}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <p
                        className="line-clamp-2 text-xs font-bold leading-tight"
                        style={{ color: C.inkSoft }}
                      >
                        {item.title}
                      </p>
                    </Link>
                  )
                })}
              </div>
              {newsPreview && newsPreview.length > 0 && (
                <div className="mt-3 border-t pt-3" style={{ borderColor: tankenTokens.border.faint }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: C.inkSoft }}>
                      通学路の安全ニュース
                    </span>
                    <Link
                      href="/school-route-news"
                      className={`flex items-center gap-0.5 rounded-full text-xs font-bold ${tankenTokens.cls.focus}`}
                      style={{ color: C.primaryStrong }}
                    >
                      すべて見る
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <ul className="space-y-1.5">
                    {newsPreview.map((news) => (
                      <li key={news.id}>
                        <Link
                          href={`/school-route-news/${news.slug}`}
                          className={`flex items-center gap-2 rounded-md text-xs leading-snug ${tankenTokens.cls.focus}`}
                          style={{ color: C.ink }}
                        >
                          <span
                            className="inline-flex flex-shrink-0 items-center gap-1.5 text-[10px] font-bold"
                            style={{ color: C.inkSoft }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: news.categoryColor }}
                            />
                            <span>{news.categoryLabel}</span>
                          </span>
                          <span className="line-clamp-1 min-w-0">{news.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
