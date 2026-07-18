// 地域選択の一元管理
//
// 「あなたの地域」の解決を1箇所に集約する。
// LocalSafetyAlertsSection・ニュースフィードなど地域絞込を行うUIは
// 必ずこのモジュール経由で読み書きし、独自のlocalStorageキーを新設しない。

export const REGION_STORAGE_KEY = "pathguardian:selected_prefecture"

export const NATIONWIDE = "全国"

export const ALL_PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const

// 地域チップに常時表示するクイック選択肢（従来のLocalSafetyAlertsSectionと同一）
export const PREFECTURE_QUICK_OPTIONS = [
  NATIONWIDE, "北海道", "宮城県", "東京都", "神奈川県",
  "埼玉県", "千葉県", "愛知県", "大阪府", "兵庫県", "福岡県",
] as const

export function isKnownRegion(value: string): boolean {
  return value === NATIONWIDE || (ALL_PREFECTURES as readonly string[]).includes(value)
}

/** 保存済みの地域を返す。未保存・不正値・SSR時は「全国」 */
export function getStoredRegion(): string {
  if (typeof window === "undefined") return NATIONWIDE
  try {
    const stored = window.localStorage.getItem(REGION_STORAGE_KEY)
    return stored && isKnownRegion(stored) ? stored : NATIONWIDE
  } catch {
    return NATIONWIDE
  }
}

export function setStoredRegion(region: string): void {
  if (typeof window === "undefined" || !isKnownRegion(region)) return
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region)
  } catch {
    // localStorage不可の環境（プライベートモード等）では選択をセッション内のみ保持する
  }
}

/** クイック選択肢に、選択中の地域が含まれない場合は末尾に足して返す */
export function getRegionChipOptions(selected: string): string[] {
  const options = [...PREFECTURE_QUICK_OPTIONS]
  if (!options.includes(selected as (typeof PREFECTURE_QUICK_OPTIONS)[number]) && isKnownRegion(selected)) {
    return [...options, selected]
  }
  return options
}

// 市町村の選択保存
//
// 既存の REGION_STORAGE_KEY(都道府県)は Push通知購読・地図フィルタ等と
// 共有しているため形式を変えない。市町村は別キーに「都道府県とペア」で
// 保存し、県をまたいだ復元(例: 東京都で保存した千代田区を大阪府で適用)を防ぐ。

export const CITY_STORAGE_KEY = "pathguardian:selected_city"

/** 保存済みの市町村を返す。県が一致しない・未保存・SSR時は null */
export function getStoredCity(prefecture: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { prefecture?: unknown; city?: unknown }
    if (parsed.prefecture !== prefecture) return null
    return typeof parsed.city === "string" && parsed.city.trim() ? parsed.city : null
  } catch {
    return null
  }
}

export function setStoredCity(prefecture: string, city: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (!city || prefecture === NATIONWIDE || !isKnownRegion(prefecture)) {
      window.localStorage.removeItem(CITY_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture, city }))
  } catch {
    // localStorage不可の環境（プライベートモード等）では選択をセッション内のみ保持する
  }
}
