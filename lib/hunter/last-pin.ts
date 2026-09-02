// =============================================
// きけんハンター 最後に確定したピンの記憶 (端末内のみ)
// 通学路は毎日同じ場所なので、2 枚目以降のピン画面を「東京」から始めない。
// localStorage が使えない環境(SSR/プライベートモード)では静かに null。
// =============================================

/** 端末を家族/学校で共有しても他のアカウントの位置が出ないよう、ユーザーごとに鍵を分ける。 */
export const LAST_PIN_STORAGE_KEY = "hunter:lastPin:v1"

export function lastPinStorageKey(userId: string): string {
  return `${LAST_PIN_STORAGE_KEY}:${userId}`
}

export interface HunterLastPin {
  readonly latitude: number
  readonly longitude: number
}

function isLat(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90
}
function isLng(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180
}

export function loadLastPin(
  userId: string | null | undefined,
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): HunterLastPin | null {
  if (!storage || !userId) return null
  try {
    const raw = storage.getItem(lastPinStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown }
    if (!isLat(parsed?.latitude) || !isLng(parsed?.longitude)) return null
    return { latitude: parsed.latitude, longitude: parsed.longitude }
  } catch {
    return null
  }
}

export function saveLastPin(
  userId: string | null | undefined,
  pin: HunterLastPin,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  if (!storage || !userId || !isLat(pin.latitude) || !isLng(pin.longitude)) return
  try {
    storage.setItem(lastPinStorageKey(userId), JSON.stringify({ latitude: pin.latitude, longitude: pin.longitude }))
  } catch {
    // 容量超過・プライベートモード等は無視(記憶は任意の便利機能)
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}
