"use client"

import { Home, Sparkles } from "lucide-react"

import type { HunterSessionFailure } from "@/lib/hunter/session-client"
import { Mascot, PaperPanel, PrimaryCTA, tokens } from "./theme"

const C = tokens.color

/**
 * 採点(session)できなかったときの結果画面。
 * 0 点の結果を捏造せず、理由と復帰導線だけを出す(お祝い演出も出さない)。
 * - expired: 正解鍵の期限切れ → 「もういちど AIに 見てもらう」(再解析 or きろくの再取得)
 * - network/server: 「もういちど けっかを 出す」(同じ taps/answers を再送)
 */
export function SessionFailureScreen({
  failure,
  foundCount,
  canReanalyze,
  onRetryScoring,
  onReanalyze,
  onHome,
}: {
  failure: HunterSessionFailure
  /** たんけんで みつけた数(クイズは null)。がんばりは消さない。 */
  foundCount: number | null
  canReanalyze: boolean
  onRetryScoring: () => void
  onReanalyze: () => void
  onHome: () => void
}) {
  const expired = failure.kind === "expired"
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 pb-6 pt-2 text-center">
      <Mascot size="md" mood="think" />
      <PaperPanel tone="sun" className="w-full px-4 py-4">
        <p role="alert" className="text-[15px] font-bold leading-relaxed" style={{ color: C.ink }}>
          {failure.message}
        </p>
        {foundCount !== null && foundCount > 0 ? (
          <p className="mt-2 text-[13.5px] font-black" style={{ color: C.primaryStrong }}>
            {foundCount}こ みつけた がんばりは そのままだよ
          </p>
        ) : null}
      </PaperPanel>
      <div className="flex w-full flex-col gap-2.5">
        {expired && canReanalyze ? (
          <PrimaryCTA onClick={onReanalyze}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            もういちど AIに 見てもらう
          </PrimaryCTA>
        ) : (
          <PrimaryCTA onClick={onRetryScoring}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            もういちど けっかを 出す
          </PrimaryCTA>
        )}
        <PrimaryCTA variant="paper" size="md" onClick={onHome}>
          <Home className="h-4 w-4" aria-hidden="true" />
          ホームに もどる
        </PrimaryCTA>
      </div>
    </div>
  )
}
