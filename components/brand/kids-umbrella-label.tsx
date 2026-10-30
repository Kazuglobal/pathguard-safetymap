import { BRAND } from "@/lib/brand"
import { tankenTokens } from "@/lib/design/tanken"

/**
 * 子ども向けの遊びの画面で、見出しの上に出す傘の名前「きけんハンター」(UIUX改装 項目8)。
 * ハザードゲーム・つうがくろクイズ・セーフティクエスト・ミッション・バッジ・ランキングで同じ表記にする
 * (tests/unit/lib/kids-umbrella.test.ts が、どの画面にも出ているかを見る)。
 */
export function KidsUmbrellaLabel({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs font-black tracking-[0.18em] ${className}`} style={{ color: tankenTokens.color.primaryStrong }}>
      {BRAND.kidsUmbrella}
    </p>
  )
}
