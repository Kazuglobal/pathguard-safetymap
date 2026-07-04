import Image from "next/image"
import Link from "next/link"
import { MapPin, Route as RouteIcon, ShieldCheck, ScanFace, Landmark } from "lucide-react"

import { tankenTokens, ENDPAPER } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * ランディングのヒーロー。
 * 「このアプリは何か」「親にとって何が安心か」を3秒で伝える。
 * 偽キャンペーンのカルーセルの代替として、実在する価値だけを載せる。
 */
export function LandingHero() {
  return (
    <section
      data-testid="hero-section"
      className="relative overflow-hidden"
      style={{
        background: C.paper,
        backgroundImage: ENDPAPER,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pb-10 pt-6 md:flex-row md:gap-12 md:pb-16 md:pt-12">
        {/* 左: メッセージ */}
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
            style={{
              background: C.sunSoft,
              borderColor: "rgba(226,168,18,.4)",
              color: "#8A6A0C",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            小学生の家族のための 通学路あんぜんノート
          </span>

          <h1
            className="mt-4 text-[28px] font-black leading-snug tracking-tight md:text-[40px]"
            style={{ color: C.ink }}
          >
            「いってらっしゃい」を、
            <br />
            もっと安心に。
          </h1>

          <p
            className="mt-3 max-w-md text-sm leading-relaxed md:text-base"
            style={{ color: C.inkSoft }}
          >
            通学路の「気をつけたい場所」を家族で見つけて、地図に残せます。
            近所の不審者情報や交通の危険も、毎朝3分でチェック。
          </p>

          {/* CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/map"
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold text-white transition-transform active:translate-y-1 active:shadow-none ${tankenTokens.cls.focus}`}
              style={{
                background: C.primary,
                boxShadow: tankenTokens.shadow.pressGreen,
              }}
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
              きょうの地図をひらく
            </Link>
            <Link
              href="/routes"
              className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-[10px] text-sm font-bold transition-transform active:translate-y-[3px] active:shadow-none ${tankenTokens.cls.focus}`}
              style={{
                background: C.card,
                borderColor: tankenTokens.border.soft,
                color: C.ink,
                boxShadow: tankenTokens.shadow.pressPaper,
              }}
            >
              <RouteIcon className="h-4 w-4" aria-hidden="true" />
              通学路をとうろくする
            </Link>
          </div>

          {/* 安心の根拠(実装済みの事実のみ) */}
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: C.inkSoft }}>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: C.primary }} aria-hidden="true" />
              みんなの報告は承認制
            </li>
            <li className="flex items-center gap-1.5">
              <ScanFace className="h-3.5 w-3.5" style={{ color: C.primary }} aria-hidden="true" />
              顔・ナンバーは加工して共有
            </li>
            <li className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" style={{ color: C.primary }} aria-hidden="true" />
              自治体・警察の公開情報も収集
            </li>
          </ul>
        </div>

        {/* 右: 絵本イラスト(実在アセット) */}
        <div className="relative w-full max-w-[420px] flex-shrink-0 md:w-[42%]">
          <div
            className="relative rotate-[1.5deg] rounded-[18px] border p-3 pb-4"
            style={{
              background: C.card,
              borderColor: tankenTokens.border.faint,
              boxShadow: tankenTokens.shadow.card,
            }}
          >
            {/* マスキングテープ */}
            <span
              aria-hidden="true"
              className="absolute -top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 rounded-[3px] opacity-80"
              style={{ background: C.sunSoft, border: "1px solid rgba(226,168,18,.35)" }}
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[12px]">
              <Image
                src="/images/onboarding/app-onboarding-4.png"
                alt="子どもが光る安全ルートを歩いて登校し、相棒のルペが見守っているイラスト"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 420px"
              />
            </div>
            <p
              className="mt-3 text-center text-xs font-bold"
              style={{ color: C.inkSoft }}
            >
              あいぼうの「ルペ」と、まちを たんけん
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
