"use client"

import Link from "next/link"
import { Home, RotateCw, WifiOff } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * ログイン状態を たしかめられなかったとき(通信エラーなど)の きけんハンターの画面。
 *
 * ここで /login へ送ってはいけない。/login は Cookie に残っているセッションを見て
 * next(=きけんハンター)へすぐ戻すので、通信が直るまで往復が止まらなくなる。
 * 読み込み直すボタンと、ホームへ もどる道だけを出す
 * (/safety-quest の下では 下のタブバーが出ないため、もどる道は ここで用意する)。
 * 通信が不安定なときに出る画面なので、framer-motion を使う theme.tsx は読み込まない。
 */
export function HunterAuthRetry() {
  return (
    <div
      className="paper-surface flex min-h-[100dvh] w-full items-center justify-center px-6 py-10"
      style={{ fontFamily: tankenTokens.font.family, wordBreak: "keep-all", overflowWrap: "break-word" }}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{ background: C.accentSoft, color: C.accentStrong }}
          aria-hidden="true"
        >
          <WifiOff className="h-7 w-7" strokeWidth={2.6} />
        </span>

        <p role="alert" className="text-[16px] font-black leading-relaxed" style={{ color: C.ink }}>
          つながりにくいみたい。もういちど ためしてね
        </p>

        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`inline-flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-full border-2 border-transparent px-6 text-[16px] font-black transition-[transform,box-shadow] duration-100 active:translate-y-[4px] active:!shadow-none ${tankenTokens.cls.focus}`}
            style={{ background: C.sun, color: C.ink, boxShadow: tankenTokens.shadow.pressSun }}
          >
            <RotateCw className="h-5 w-5" aria-hidden="true" strokeWidth={2.6} />
            もういちど よみこむ
          </button>
          <Link
            href="/landing"
            className={`inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-full border-2 bg-white px-6 text-[15px] font-black transition-[transform,box-shadow] duration-100 active:translate-y-[3px] active:!shadow-none ${tankenTokens.cls.focus}`}
            style={{ color: C.ink, borderColor: tankenTokens.border.soft, boxShadow: tankenTokens.shadow.pressPaper }}
          >
            <Home className="h-4 w-4" aria-hidden="true" strokeWidth={2.6} />
            ホームに もどる
          </Link>
        </div>
      </div>
    </div>
  )
}
