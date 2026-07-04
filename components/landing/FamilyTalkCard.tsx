import Link from "next/link"
import { MessagesSquare, ChevronRight } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * こんやの さくせんかいぎ。
 * データを見せるだけでは安心は生まれないので、
 * 「今夜こどもと話す1つの質問」を曜日替わりで提案する。
 */
const TALK_PROMPTS: readonly string[] = [
  "つうがくろで いちばん くるまが おおい ばしょは どこ？",
  "こまったとき、とちゅうで にげこめる おみせや おうちは ある？",
  "しらない人に こえを かけられたら、まず なんて いう？",
  "あめの日に すべりやすい ばしょ、みぞや かわの ちかくは ある？",
  "しんごうの ない こうさてん、わたる まえに なにを みる？",
  "きょう みちで「ちょっと ひやっ」とした ことは あった？",
  "もし じしんが きたら、つうがくろの どこで まてば あんしん？",
]

export function FamilyTalkCard() {
  const dayOfWeek = new Date().getDay()
  const prompt = TALK_PROMPTS[dayOfWeek]

  return (
    <section className="px-4 py-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div
          className="relative overflow-hidden rounded-[22px] border p-5 md:p-8"
          style={{
            background: C.sunSoft,
            borderColor: "rgba(226,168,18,.35)",
            boxShadow: tankenTokens.shadow.soft,
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p
                className="flex items-center gap-1.5 text-xs font-bold"
                style={{ color: "#8A6A0C" }}
              >
                <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                こんやの かぞく さくせんかいぎ
              </p>
              <p
                className="mt-2 text-lg font-black leading-snug md:text-xl"
                style={{ color: C.ink }}
              >
                {prompt}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
                夕はんのあとの1分でOK。話すほど、こどもの「きづく目」がそだちます。
              </p>
            </div>
            <Link
              href="/safe-magazine"
              className={`inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-full border-2 px-4 py-2 text-sm font-bold transition-transform active:translate-y-[3px] active:shadow-none md:self-center ${tankenTokens.cls.focus}`}
              style={{
                background: C.card,
                borderColor: tankenTokens.border.soft,
                color: C.ink,
                boxShadow: tankenTokens.shadow.pressPaper,
              }}
            >
              安全の読みもの
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
