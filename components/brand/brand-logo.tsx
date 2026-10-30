import { BRAND } from "@/lib/brand"

/**
 * PathGuardian のロゴ(紹介HP /lp と同じ文字のロゴ)。ナビ・紹介HP・ログインなどの画面で共用する(UIUX改装 項目3・32)。
 * ロゴの文字は、コントラストの決まりの対象外(WCAG のロゴの例外)。説明名は読める濃さで出す。
 */

const SIZES = {
  /** 幅の狭いヘッダー(紹介HP)。スマホでは少し小さくして、横のボタンとくっつかないようにする */
  compact: "text-base sm:text-lg",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
} as const

export function BrandLogo({
  size = "md",
  showDescriptor = false,
  className = "",
}: {
  size?: keyof typeof SIZES
  /** 下に「通学路みまもりアプリ」を添える */
  showDescriptor?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`} data-testid="brand-logo">
      <span
        className={`font-black tracking-tight ${SIZES[size]}`}
        style={{ fontFamily: 'var(--font-lp-display), "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif' }}
      >
        <span style={{ color: "#2B2723" }}>Path</span>
        <span style={{ color: "#E8A33D" }}>Guardian</span>
      </span>
      {showDescriptor && (
        <span className="mt-1 text-xs font-bold" style={{ color: "#6B5F4D" }}>
          {BRAND.descriptor}
        </span>
      )}
    </span>
  )
}
