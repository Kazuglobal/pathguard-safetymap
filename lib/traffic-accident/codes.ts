// =============================================
// 警察庁 交通事故統計オープンデータ（本票）のコード解釈
//
// traffic_accidents の取り込み時に、事故類型の大分類コード（01/21/41/61）へ
// 「車両相互_正面衝突」のような詳細名が誤って付けられ、当事者種別が空のため
// involves_pedestrian も常に false になっている（2026-09-26 確認）。
// 本票の「事故類型」は大分類しか持たないので、読み出し時にコードから正しい値を導く。
// 純粋関数・イミュータブル。
// =============================================

export const ACCIDENT_CLASS_BY_CODE = {
  '01': '人対車両',
  '21': '車両相互',
  '41': '車両単独',
  '61': '列車',
} as const

export type AccidentClass = (typeof ACCIDENT_CLASS_BY_CODE)[keyof typeof ACCIDENT_CLASS_BY_CODE]

export const PEDESTRIAN_ACCIDENT_CODE = '01'

function normalizeCode(code: string | null | undefined): string | null {
  if (code == null) return null
  const trimmed = String(code).trim()
  if (!/^\d{1,2}$/.test(trimmed)) return null
  return trimmed.padStart(2, '0')
}

/** 事故類型コード → 大分類ラベル。未知・空は null。 */
export function accidentClassFromCode(code: string | null | undefined): AccidentClass | null {
  const normalized = normalizeCode(code)
  if (!normalized) return null
  return (ACCIDENT_CLASS_BY_CODE as Record<string, AccidentClass>)[normalized] ?? null
}

/** 人対車両（大分類コード01）は歩行者が関係した事故。保存済みフラグが true の場合もそのまま true。 */
export function isPedestrianAccident(row: {
  accidentTypeCode: string | null
  involvesPedestrian: boolean
}): boolean {
  return row.involvesPedestrian || normalizeCode(row.accidentTypeCode) === PEDESTRIAN_ACCIDENT_CODE
}

/** 読み出した行の事故類型ラベルと歩行者フラグを、コードから導いた値に置き換えた新しい行を返す。 */
export function normalizeAccidentRow<
  T extends { accidentTypeCode: string | null; accidentTypeLabel: string | null; involvesPedestrian: boolean },
>(row: T): T {
  const accidentClass = accidentClassFromCode(row.accidentTypeCode)
  return {
    ...row,
    accidentTypeLabel: accidentClass ?? row.accidentTypeLabel,
    involvesPedestrian: isPedestrianAccident(row),
  }
}
