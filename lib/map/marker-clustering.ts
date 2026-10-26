/**
 * ライブ地図の危険ピンの近接グループ化(純粋関数)
 *
 * DOMマーカー(mapboxgl.Marker)を維持したまま、ズームレベルに応じて
 * 近接するピンを「N件」クラスタにまとめる。Mapboxネイティブクラスタ
 * (geojsonソース+レイヤー)への置換はしない設計判断(2026-07-08)。
 * アイコン付きDOMマーカー・クリック→モーダルの既存アーキテクチャを保つ。
 *
 * PDFレポート側の重なり回避(report-map.ts の spreadOverlappingMarkers)とは
 * 独立: あちらは静的画像用のbbox相対計算、こちらはズーム連動の画面px基準。
 */

export interface ClusterablePoint {
  latitude: number
  longitude: number
}

export interface MarkerGroup<T extends ClusterablePoint> {
  /** グループの表示位置(メンバーの重心) */
  latitude: number
  longitude: number
  /** 1件なら単独ピン、2件以上ならクラスタとして描画する */
  items: T[]
}

/** この画面ピクセル距離より近いピン同士をまとめる */
export const CLUSTER_PIXEL_THRESHOLD = 44

/** このズーム以上ではクラスタせず、重なりピンを扇状に散らして全件見せる */
export const CLUSTER_MAX_ZOOM = 17

/** 扇状展開時に「重なっている」とみなす画面ピクセル距離 */
const SPREAD_PIXEL_THRESHOLD = 20

/** このズーム以上でピンの下に種類名・段階のラベルを出す(広域では絵だけにして地図を文字で埋めない) */
export const PIN_LABEL_MIN_ZOOM = 16

/**
 * ラベルを出すのに必要な空き(画面ピクセル)。ラベルはピン直下に中央寄せで出るため、
 * この範囲に他のマーカーがあると、ラベル同士が重なるか隣のピンを覆ってしまう。
 */
export const PIN_LABEL_CLEARANCE_X_PX = 110
// ピンの高さ54 + ラベル約22 + 余白: 真下のピンの頭にラベルが掛からない距離
export const PIN_LABEL_CLEARANCE_Y_PX = 84

/** 扇状展開の半径(画面ピクセル)。ピン幅44pxで隣同士が重なりすぎない値 */
const SPREAD_RADIUS_PX = 32

/**
 * 画面ピクセル距離を経度差(度)に変換する。
 * Mapboxの世界は zoom で 512 * 2^zoom px = 経度360度。
 */
export function pixelsToLngDegrees(pixels: number, zoom: number): number {
  return (pixels * 360) / (512 * Math.pow(2, zoom))
}

/** 2点の度単位の近似距離(経度は緯度で補正)。しきい値比較専用 */
function approxDegreeDistance(a: ClusterablePoint, b: ClusterablePoint): number {
  const latRad = (((a.latitude + b.latitude) / 2) * Math.PI) / 180
  const dLat = a.latitude - b.latitude
  const dLng = (a.longitude - b.longitude) * Math.cos(latRad)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * 近接するポイントを貪欲法でグループ化する。
 * 各ポイントは「重心がしきい値以内にある最初のグループ」へ入り、
 * どこにも入らなければ新グループになる。O(n×グループ数)。
 * 表示範囲内の件数(bbox絞り込み済み)を前提とした実装。
 */
export function groupMarkersByProximity<T extends ClusterablePoint>(
  items: T[],
  zoom: number,
  thresholdPx: number = CLUSTER_PIXEL_THRESHOLD,
): MarkerGroup<T>[] {
  const thresholdDeg = pixelsToLngDegrees(thresholdPx, zoom)
  const groups: MarkerGroup<T>[] = []

  for (const item of items) {
    let joined = false
    for (const group of groups) {
      if (approxDegreeDistance(item, group) <= thresholdDeg) {
        group.items.push(item)
        // 重心を更新(逐次平均)
        const n = group.items.length
        group.latitude += (item.latitude - group.latitude) / n
        group.longitude += (item.longitude - group.longitude) / n
        joined = true
        break
      }
    }
    if (!joined) {
      groups.push({ latitude: item.latitude, longitude: item.longitude, items: [item] })
    }
  }

  return groups
}

export interface SpreadPin<T extends ClusterablePoint> {
  item: T
  /** 表示用座標(重なり時は元位置から扇状にずらした位置) */
  latitude: number
  longitude: number
}

/**
 * 高ズーム時: 重なっているピンだけを重心のまわりに扇状に散らして
 * 全件をタップ可能にする。単独ピンは元の位置のまま。
 */
export function spreadOverlappingPins<T extends ClusterablePoint>(
  items: T[],
  zoom: number,
): SpreadPin<T>[] {
  const groups = groupMarkersByProximity(items, zoom, SPREAD_PIXEL_THRESHOLD)
  const result: SpreadPin<T>[] = []

  for (const group of groups) {
    if (group.items.length === 1) {
      const item = group.items[0]
      result.push({ item, latitude: item.latitude, longitude: item.longitude })
      continue
    }

    const latRad = (group.latitude * Math.PI) / 180
    // メンバー数が多いほど半径を少し広げ、散らした後に再度重ならないようにする
    const radiusDeg = pixelsToLngDegrees(
      SPREAD_RADIUS_PX * Math.max(1, group.items.length / 4),
      zoom,
    )
    group.items.forEach((item, index) => {
      const angle = (2 * Math.PI * index) / group.items.length - Math.PI / 2
      result.push({
        item,
        latitude: group.latitude + Math.sin(angle) * radiusDeg,
        longitude: group.longitude + (Math.cos(angle) * radiusDeg) / Math.cos(latRad),
      })
    })
  }

  return result
}

/**
 * 各ポイントの周囲にラベルを出せる空きがあるかを返す(入力と同じ順の配列)。
 * 「空きがあるピンだけラベルを出す」ための判定で、近くに他のマーカー
 * (単独ピン・クラスタ・扇状に散らしたピン)があるポイントは false になる。
 * 表示範囲内の件数を前提とした O(n^2)。
 */
export function findPointsWithLabelRoom(
  points: ClusterablePoint[],
  zoom: number,
  clearanceXPx: number = PIN_LABEL_CLEARANCE_X_PX,
  clearanceYPx: number = PIN_LABEL_CLEARANCE_Y_PX,
): boolean[] {
  const clearanceLngDeg = pixelsToLngDegrees(clearanceXPx, zoom)
  const clearanceYDeg = pixelsToLngDegrees(clearanceYPx, zoom)

  return points.map((point, index) => {
    // 緯度1度は経度1度より画面上で 1/cos(lat) 倍長いので、縦のしきい値を補正する
    const clearanceLatDeg = clearanceYDeg * Math.cos((point.latitude * Math.PI) / 180)
    return !points.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        Math.abs(other.longitude - point.longitude) < clearanceLngDeg &&
        Math.abs(other.latitude - point.latitude) < clearanceLatDeg,
    )
  })
}
