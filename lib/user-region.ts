// 地域選択の一元管理
//
// 「あなたの地域」の解決を1箇所に集約する。
// LocalSafetyAlertsSection・ニュースフィードなど地域絞込を行うUIは
// 必ずこのモジュール経由で読み書きし、独自のlocalStorageキーを新設しない。
// 地域アラートと報告一覧の地域フィルタの「選択」は、このモジュールの
// 機能別キー(ファイル末尾)に保存する。

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
export const SCHOOL_DISTRICT_STORAGE_KEY = "pathguardian:selected_school_district"

export function getStoredSchoolDistrict(prefecture: string, city: string | null): string | null {
  if (typeof window === 'undefined' || !city) return null
  try {
    const saved = JSON.parse(window.localStorage.getItem(SCHOOL_DISTRICT_STORAGE_KEY) ?? 'null')
    return saved?.prefecture === prefecture && saved?.city === city && typeof saved?.id === 'string' && saved.id.length <= 160 ? saved.id : null
  } catch { return null }
}

export function setStoredSchoolDistrict(prefecture: string, city: string | null, id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!city || !id || id.length > 160 || !isKnownRegion(prefecture) || prefecture === NATIONWIDE) {
      window.localStorage.removeItem(SCHOOL_DISTRICT_STORAGE_KEY)
    } else {
      window.localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify({ prefecture, city, id }))
    }
  } catch { /* Keep the current selection in memory when storage is unavailable. */ }
}

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

// 機能ごとの地域選択の保存
//
// 地域アラート(学区マスターの市区町村名)と報告一覧の地域フィルタ(報告データの
// city 値)は市町村の呼び名の体系が違う。上の共有キー(CITY_STORAGE_KEY 等)を
// 両方で読み書きすると、片方の検証がもう片方の選択を消してしまうため、
// 選択は機能ごとの専用キーに保存する。
// - 専用キーが無いときだけ旧共有キーを1回読んで引き継ぎ、すぐ専用キーへ書く(以後は旧キーを読まない)
// - 旧共有キーは消さない・書き換えない(Push購読・地図など他の機能や旧版が読む)
// - 都道府県は「あなたの地域」として REGION_STORAGE_KEY に反映してよい(呼び出し側の判断)

export const ALERTS_REGION_STORAGE_KEY = "pathguardian:alerts-region:v1"
export const REPORT_REGION_STORAGE_KEY = "pathguardian:report-region:v1"

// /api/school-districts の受け付け上限と同じ
const MAX_STORED_CITY_LENGTH = 80
const MAX_STORED_SCHOOL_DISTRICT_ID_LENGTH = 160

/** 地域アラートの選択。未選択の都道府県は "" */
export interface AlertsRegionSelection {
  prefecture: string
  city: string | null
  schoolDistrictId: string | null
}

/** 報告一覧の地域フィルタの選択 */
export interface ReportRegionSelection {
  /** 「全国」または47都道府県 */
  prefecture: string
  /** 最後に選んだ市町村(県とペア)。別の県を見ている間も保ち、その県へ戻ったら復元する */
  lastCity: { prefecture: string; city: string } | null
}

export const EMPTY_ALERTS_REGION: AlertsRegionSelection = Object.freeze({
  prefecture: "",
  city: null,
  schoolDistrictId: null,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPrefecture(value: unknown): value is string {
  return typeof value === "string" && (ALL_PREFECTURES as readonly string[]).includes(value)
}

function isRegionValue(value: unknown): value is string {
  return typeof value === "string" && isKnownRegion(value)
}

function toStoredCity(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" && value.length <= MAX_STORED_CITY_LENGTH
    ? value
    : null
}

function toStoredSchoolDistrictId(value: unknown): string | null {
  return typeof value === "string" && value !== "" && value.length <= MAX_STORED_SCHOOL_DISTRICT_ID_LENGTH
    ? value
    : null
}

/** 未保存なら undefined、壊れた JSON なら null を返す(読み取り不可の例外は呼び出し側で扱う) */
function readStoredJson(key: string): unknown {
  const raw = window.localStorage.getItem(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function toAlertsRegion(value: unknown): AlertsRegionSelection {
  const record: Record<string, unknown> = isRecord(value) ? value : {}
  const prefecture = isPrefecture(record.prefecture) ? record.prefecture : ""
  const city = prefecture ? toStoredCity(record.city) : null
  const schoolDistrictId = city ? toStoredSchoolDistrictId(record.schoolDistrictId) : null
  return { prefecture, city, schoolDistrictId }
}

function toCityPair(value: unknown): ReportRegionSelection["lastCity"] {
  if (!isRecord(value) || !isPrefecture(value.prefecture)) return null
  const city = toStoredCity(value.city)
  return city ? { prefecture: value.prefecture, city } : null
}

function toReportRegion(value: unknown): ReportRegionSelection {
  const record: Record<string, unknown> = isRecord(value) ? value : {}
  const prefecture = isRegionValue(record.prefecture) ? record.prefecture : NATIONWIDE
  return { prefecture, lastCity: toCityPair(record.lastCity) }
}

function readLegacyAlertsRegion(): AlertsRegionSelection {
  // 小学校区の旧キーは地域アラートだけが書いていた。県・市区町村とペアで
  // 残っていれば、他の機能が書き換えた共有キーより確かな「最後の選択」になる
  const legacyDistrict = readStoredJson(SCHOOL_DISTRICT_STORAGE_KEY)
  if (isRecord(legacyDistrict)) {
    const fromDistrict = toAlertsRegion({
      prefecture: legacyDistrict.prefecture,
      city: legacyDistrict.city,
      schoolDistrictId: legacyDistrict.id,
    })
    if (fromDistrict.schoolDistrictId) return fromDistrict
  }
  const prefecture = getStoredRegion()
  if (prefecture === NATIONWIDE) return { ...EMPTY_ALERTS_REGION }
  return toAlertsRegion({ prefecture, city: getStoredCity(prefecture), schoolDistrictId: null })
}

/**
 * 地域アラートの選択を返す。専用キーが無いときだけ旧共有キーから引き継ぎ、
 * その結果を専用キーへ書いて移行を確定させる。SSR・読み取り不可なら未選択。
 */
export function getStoredAlertsRegion(): AlertsRegionSelection {
  if (typeof window === "undefined") return { ...EMPTY_ALERTS_REGION }
  try {
    const stored = readStoredJson(ALERTS_REGION_STORAGE_KEY)
    if (stored !== undefined) return toAlertsRegion(stored)
    const migrated = readLegacyAlertsRegion()
    setStoredAlertsRegion(migrated)
    return migrated
  } catch {
    return { ...EMPTY_ALERTS_REGION }
  }
}

export function setStoredAlertsRegion(selection: AlertsRegionSelection): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ALERTS_REGION_STORAGE_KEY, JSON.stringify(toAlertsRegion(selection)))
  } catch {
    // localStorage不可の環境では選択をセッション内のみ保持する
  }
}

/**
 * 報告一覧の地域フィルタの選択を返す。専用キーが無いときだけ旧共有キー
 * (都道府県・市町村)から引き継ぎ、専用キーへ書いて移行を確定させる。
 */
export function getStoredReportRegion(): ReportRegionSelection {
  if (typeof window === "undefined") return { prefecture: NATIONWIDE, lastCity: null }
  try {
    const stored = readStoredJson(REPORT_REGION_STORAGE_KEY)
    if (stored !== undefined) return toReportRegion(stored)
    const migrated: ReportRegionSelection = {
      prefecture: getStoredRegion(),
      lastCity: toCityPair(readStoredJson(CITY_STORAGE_KEY)),
    }
    setStoredReportRegion(migrated)
    return migrated
  } catch {
    return { prefecture: NATIONWIDE, lastCity: null }
  }
}

export function setStoredReportRegion(selection: ReportRegionSelection): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(REPORT_REGION_STORAGE_KEY, JSON.stringify(toReportRegion(selection)))
  } catch {
    // localStorage不可の環境では選択をセッション内のみ保持する
  }
}

/** 報告フィルタの選択から、指定の県で使う市町村を返す(県が違う・全国なら null) */
export function getReportRegionCity(
  lastCity: ReportRegionSelection["lastCity"],
  prefecture: string,
): string | null {
  if (prefecture === NATIONWIDE || !lastCity || lastCity.prefecture !== prefecture) return null
  return lastCity.city
}
