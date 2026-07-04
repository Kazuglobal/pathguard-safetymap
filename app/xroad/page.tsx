"use client"

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import MapWrapper from '@/components/map/map-wrapper'
import XRoadLayer from '@/components/map/xroad-layer'
import { tankenTokens, ENDPAPER, PAPER_NOISE } from '@/lib/design/tanken'
import { Car, Info, MapPin, ShieldCheck } from 'lucide-react'

const T = tankenTokens
const C = T.color

/**
 * 交通の安全ページ（保護者向け）
 *
 * 国土交通省の道路データをもとに、通学路まわりの「交通のあぶなさ」を
 * 地図でたしかめるためのページ。世界観は「たんけんノート」。
 *
 * 方針:
 *  - 偽データは一切表示しない。国のデータを地図に重ねるのは保護者が明示的に
 *    操作したときだけ（初期表示では外部APIを呼ばない）。
 *  - データが取れない場合はサマリを出さない（そもそも推測値を作らない）。
 */
export default function TrafficSafetyPage() {
  // 国の道路データを地図に重ねるか。初期は false（=読み込み時に外部APIを呼ばない）。
  const [showRoadData, setShowRoadData] = useState(false)

  return (
    <main
      className="min-h-[100dvh] w-full"
      style={{
        fontFamily: T.font.family,
        color: C.ink,
        background: `${ENDPAPER}, linear-gradient(175deg, ${C.paper} 0%, #F4ECDA 100%)`,
        wordBreak: 'keep-all',
        overflowWrap: 'break-word',
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        {/* ヘッダー: このページが何かを保護者の言葉で */}
        <header className="mb-5">
          <Sticker>つうがくろの あんぜん</Sticker>
          <h1 className="mt-3 text-[26px] font-black leading-tight sm:text-[32px]">
            くるまの事故が多いのはどこ？
          </h1>
          <p className="mt-2 text-[15px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
            国の道路データをもとに、通学路のまわりの交通のあぶなさを地図でたしかめられます。
          </p>
        </header>

        {/* 主役: 地図 */}
        <Panel className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                style={{ background: C.primarySoft, color: C.primaryStrong }}
              >
                <Car className="h-4 w-4" strokeWidth={2.6} />
              </span>
              <div>
                <h2 className="text-[16px] font-black leading-none">交通のちず</h2>
                <p className="mt-1 text-[12px] font-bold leading-none" style={{ color: C.inkFaint }}>
                  地図をうごかして 通学路のまわりを見てみましょう
                </p>
              </div>
            </div>

            <ToggleChip
              pressed={showRoadData}
              onClick={() => setShowRoadData((v) => !v)}
              label="国の道路データを重ねる"
            />
          </div>

          {/* 地図本体。MapWrapper の高さは 100vh 固定のため、枠でクリップして収める */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: 'clamp(260px, 48vh, 440px)',
              borderRadius: T.radius.panel,
              border: `1px solid ${T.border.soft}`,
              background: C.paperDeep,
            }}
          >
            <MapWrapper>
              {showRoadData && (
                <XRoadLayer
                  layerId="road-data"
                  dataType="roads"
                  visible={showRoadData}
                  layerOptions={{ paint: { 'line-color': C.accent, 'line-width': 2 } }}
                />
              )}
            </MapWrapper>
          </div>

          {/*
            サマリ枠（いつ・どこ・どれくらい近いか）はここに置く想定。
            現状は保護者に見せられる確かな集計データが無いため、推測値を作らず非表示にする。
            実データが取れるようになったら、この位置に1行サマリを出す。
          */}

          <p className="mt-3 flex items-start gap-2 px-1 text-[12.5px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
            <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.sky }} aria-hidden="true" />
            <span>
              「国の道路データを重ねる」を押すと、国土交通省の道路データを地図に表示します。
              地域や時間帯によっては、データが見つからないことがあります。
            </span>
          </p>
        </Panel>

        {/* 二次的な情報は折りたたみで */}
        <div className="mt-5 space-y-3">
          <Accordion summary="地図の見かた" icon={<MapPin className="h-4 w-4" strokeWidth={2.6} />}>
            <ul className="space-y-2 text-[14px] font-bold leading-relaxed">
              <li>ドラッグで地図をうごかし、ピンチやスクロールで拡大・縮小できます。</li>
              <li>車がよく通る大きな道は、お子さんにとって注意が必要な場所です。</li>
              <li>通学路が大きな道とまじわる交差点を、重点的に見てみましょう。</li>
            </ul>
          </Accordion>

          <Accordion summary="このデータについて" icon={<ShieldCheck className="h-4 w-4" strokeWidth={2.6} />}>
            <div className="space-y-2 text-[14px] font-bold leading-relaxed">
              <p>
                地図に重ねられる道路データは、国が公開している道路データプラットフォームのものです。
                交通量や道路の情報は地域ごとに整備状況がちがい、すべての道で見られるわけではありません。
              </p>
              <p style={{ color: C.inkSoft }}>
                表示される情報は参考です。実際の交通のようすは、時間帯やその日の状況によって変わります。
              </p>
            </div>
          </Accordion>
        </div>

        {/* 出典表記 */}
        <footer className="mt-6 border-t pt-4 text-[12px] font-bold leading-relaxed" style={{ borderColor: T.border.faint, color: C.inkFaint }}>
          出典: 国土交通省 xROAD（道路データプラットフォーム）。
          表示される情報は参考であり、国土交通省が内容を保証するものではありません。
        </footer>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ *
 * ページ内プレゼンテーション部品（たんけんノート・トークン準拠）
 * ------------------------------------------------------------------ */

function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section
      className={className}
      style={{
        background: `${PAPER_NOISE}, ${C.card}`,
        borderRadius: T.radius.card,
        border: `1px solid ${T.border.faint}`,
        boxShadow: T.shadow.card,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

function Sticker({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-black leading-none"
      style={{
        background: C.sun,
        color: C.ink,
        transform: 'rotate(-2deg)',
        boxShadow: `0 0 0 2.5px #fff, ${T.shadow.soft}`,
      }}
    >
      {children}
    </span>
  )
}

function ToggleChip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[13.5px] font-black transition-[transform,box-shadow] duration-100 active:translate-y-[3px] active:!shadow-none ${T.cls.focus}`}
      style={{
        background: pressed ? C.primary : '#FFFFFF',
        color: pressed ? '#FFFFFF' : C.ink,
        border: `2px solid ${pressed ? 'transparent' : T.border.soft}`,
        boxShadow: pressed ? T.shadow.pressGreen : T.shadow.pressPaper,
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-4 w-4 place-items-center rounded-full text-[10px]"
        style={{ background: pressed ? 'rgba(255,255,255,.9)' : C.inkFaint, color: pressed ? C.primaryStrong : '#fff' }}
      >
        {pressed ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

function Accordion({ summary, icon, children }: { summary: string; icon: ReactNode; children: ReactNode }) {
  return (
    <details
      className="group overflow-hidden"
      style={{
        background: C.card,
        borderRadius: T.radius.panel,
        border: `1px solid ${T.border.faint}`,
        boxShadow: T.shadow.soft,
      }}
    >
      <summary
        className={`flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 px-4 text-[15px] font-black ${T.cls.focus}`}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: C.primarySoft, color: C.primaryStrong }}
        >
          {icon}
        </span>
        <span className="flex-1">{summary}</span>
        <span
          aria-hidden="true"
          className="text-[13px] font-black transition-transform duration-200 group-open:rotate-180"
          style={{ color: C.inkFaint }}
        >
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1" style={{ color: C.ink }}>
        {children}
      </div>
    </details>
  )
}
