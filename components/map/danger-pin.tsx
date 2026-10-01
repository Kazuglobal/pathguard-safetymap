import { getDangerTypePresentation } from "@/lib/map/danger-type-presentation"
import { PIN_PATH, PIN_VIEW_BOX } from "@/lib/map/pin-shape"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"

/**
 * 地図マーカーの見た目(純表示)。配置・クリック配線は hooks/use-danger-markers.tsx が担う。
 *
 * 共通文法: 色つきの外形(=危険度) + 白い丸 + 濃い色の絵(=種類)。
 * 外形が黄でも赤でも絵のコントラストが変わらないよう、絵は必ず白丸の上に置く。
 * しずく形は lib/map/pin-shape.ts の自前 path を使う。
 */

interface DangerPinProps {
  dangerType: string
  dangerLevel: number
  isPending?: boolean
  /** 拡大時だけ種類名と段階(★)をピンの下に出す */
  showLabel?: boolean
}

export function DangerPin({
  dangerType,
  dangerLevel,
  isPending = false,
  showLabel = false,
}: DangerPinProps) {
  const type = getDangerTypePresentation(dangerType)
  const level = getDangerLevelPresentation(dangerLevel)
  const Icon = type.icon

  return (
    <span className="danger-pin-visual" aria-hidden="true">
      <svg className="danger-pin-shape" viewBox={PIN_VIEW_BOX} focusable="false">
        <path
          className="danger-pin-body"
          d={PIN_PATH}
          fill={level.colorHex}
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <circle cx="22" cy="20" r="13" fill="#fff" />
      </svg>
      <Icon className="danger-pin-icon" strokeWidth={2.4} />
      {showLabel ? (
        <span className="map-marker-label" data-testid="danger-pin-label">
          {type.label}
          <span className="danger-pin-label-stars">{level.stars}</span>
          {isPending ? <span className="danger-pin-label-pending">確認中</span> : null}
        </span>
      ) : null}
    </span>
  )
}

/**
 * クラスタの件数バッジ。外周の色(--cluster-color)はマーカー要素側で指定する
 * (後ろにずらした輪も同じ色を使うため)。
 */
export function DangerClusterBadge({ count }: { count: number }) {
  return (
    <span className="danger-cluster-visual" aria-hidden="true">
      <span className="danger-cluster-count">
        {/* 3桁は白丸に収まらない。正確な件数はマーカーの aria-label が持つ */}
        {count > 99 ? "99+" : count}
        <span className="danger-cluster-unit">件</span>
      </span>
    </span>
  )
}
