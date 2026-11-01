/**
 * 浸水深の目安と、津波に関する事実。
 *
 * 各項目に出典名とURLを必須にし、出典のない文は置かない
 * （tests/unit/lib/hazard-depth-guide.test.ts で強制）。
 *
 * 2026-11-01時点の作業環境では mlit.go.jp への直接アクセスが
 * ネットワーク設定で許可されていないため、本文の表現は検索結果で
 * 確認した範囲にとどめている。公開前に、下記URLの一次資料で
 * 文言・数値（とくに波の高さと陸上の浸水深の区別）を再確認する。
 */

export interface DepthGuideMark {
  /** 目盛りの深さ（m） */
  depthMeters: number
  /** 画面に出す短い説明 */
  label: string
  sourceName: string
  sourceUrl: string
}

export interface HazardFact {
  text: string
  sourceName: string
  sourceUrl: string
}

const EDOGAWA_SOURCE = {
  sourceName: '国土交通省 関東地方整備局 江戸川河川事務所「浸水深の区分」',
  sourceUrl: 'https://www.ktr.mlit.go.jp/edogawa/edogawa00746_2.html',
} as const

/** 洪水・津波に共通で使う、建物の階との対応の目安。 */
export const DEPTH_GUIDE_MARKS: DepthGuideMark[] = [
  { depthMeters: 0.5, label: '建物1階の床上まで浸水するおそれ', ...EDOGAWA_SOURCE },
  { depthMeters: 3, label: '建物2階の床面まで浸水するおそれ', ...EDOGAWA_SOURCE },
  { depthMeters: 5, label: '建物3階の床面まで浸水するおそれ', ...EDOGAWA_SOURCE },
]

/** 目安であることの注意。人物・建物の高さは利用者やカメラに映る建物の計測結果ではない。 */
export const DEPTH_GUIDE_CAVEAT =
  '建物の構造や身長によって異なる一般的な目安です。目の前の建物や、あなた自身を測った値ではありません。'

/**
 * 津波の危険性に関する事実。
 * 「津波の高さ」と「陸上の浸水深」は別の値として区別して書く。
 */
export const TSUNAMI_FACTS: HazardFact[] = [
  {
    text: '津波では、海水が横方向に強く流れるため、20〜30cm程度の浅い水深でも立っているのが難しくなるとされています。',
    sourceName: '国土交通省 中部地方整備局「3.11 伝えたい、あの日のこと」資料',
    sourceUrl: 'https://www.cbr.mlit.go.jp/3.11wasurenai/kako/4-19.pdf',
  },
  {
    text: '気象庁は、予想される津波の高さが0.5mを超える場合に津波注意報、1m程度を超える場合に津波警報、3m程度を超える場合に大津波警報を発表します（津波の高さであり、陸上の浸水深とは別の値です）。',
    sourceName: '国土交通省 中部地方整備局「3.11 伝えたい、あの日のこと」資料',
    sourceUrl: 'https://www.cbr.mlit.go.jp/3.11wasurenai/kako/4-19.pdf',
  },
]

/** 表示する深さの範囲に収まる目盛りだけを返す。範囲外の目盛りは出さない。 */
export function depthGuideMarksWithin(maxMeters: number | null): DepthGuideMark[] {
  if (maxMeters === null || !Number.isFinite(maxMeters) || maxMeters <= 0) return []
  return DEPTH_GUIDE_MARKS.filter(mark => mark.depthMeters <= maxMeters)
}
