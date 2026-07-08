/**
 * AR表示の安全抑制判定(純粋関数)
 *
 * 位置精度が低い・移動速度が速いときにAR上の接近強調/通知を抑制する。
 * かつて親子モード限定だったが、個人利用(通常モード)でも歩きスマホ中の
 * 誤った強調は危険なため、モードを問わず同一閾値で判定する。
 * 閾値をモード別に分けないこと(テストと保守が複雑になる)。
 *
 * speed が null/undefined の端末では速度判定は発火しない(現状挙動を許容。
 * 「取得できない→抑制しない」は安全側への誤作動を作らないための判断)。
 */

/** 位置精度がこの値(メートル)を超えたら強調を抑制する */
export const AR_ACCURACY_SUPPRESS_THRESHOLD_M = 50

/** 移動速度がこの値(km/h)を超えたら接近通知を抑制する */
export const AR_SPEED_SUPPRESS_THRESHOLD_KMH = 15

export interface ARSafetySuppression {
  /** 位置精度が低く、強調表示を抑制すべき */
  isLocationAccuracyLow: boolean
  /** 移動速度が速く、接近通知を抑制すべき(歩きスマホ/乗車中の可能性) */
  isMovingTooFast: boolean
}

export function getARSafetySuppression(
  location: { accuracy?: number | null; speed?: number | null } | null | undefined,
): ARSafetySuppression {
  const isLocationAccuracyLow =
    typeof location?.accuracy === "number" &&
    Number.isFinite(location.accuracy) &&
    location.accuracy > AR_ACCURACY_SUPPRESS_THRESHOLD_M

  const isMovingTooFast =
    typeof location?.speed === "number" &&
    Number.isFinite(location.speed) &&
    location.speed * 3.6 > AR_SPEED_SUPPRESS_THRESHOLD_KMH

  return { isLocationAccuracyLow, isMovingTooFast }
}
