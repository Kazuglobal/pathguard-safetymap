/* Ambient module declarations for Turf.js sub-packages
   Next.js のビルド時に型エラーが出ないよう最低限の any 型スタブを定義します。
   Turf 本来の詳細型が不要な場合はこのまま、詳細型が必要になったら適宜置き換えてください。
*/

declare module "@turf/bbox" {
  const bbox: (...args: any[]) => any
  export default bbox
}

declare module "@turf/buffer" {
  const buffer: (...args: any[]) => any
  export default buffer
}

declare module "@turf/boolean-point-in-polygon" {
  const booleanPointInPolygon: (...args: any[]) => any
  export default booleanPointInPolygon
}

declare module "@turf/helpers" {
  export function point(...args: any[]): any
}

declare module "@turf/turf" {
  const turf: any
  export default turf
  export * from "@turf/helpers"
} 