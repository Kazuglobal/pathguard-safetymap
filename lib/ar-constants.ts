// AR関連の定数、型定義、ユーティリティ

// ========== 型定義 ==========

export type ARErrorType =
  | "camera_denied"
  | "camera_unavailable"
  | "location_denied"
  | "location_unavailable"
  | "orientation_denied"
  | "orientation_unavailable"
  | "unknown"

export interface ARError {
  type: ARErrorType
  message: string
  suggestion: string
}

export type Throttled<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

// ========== 定数 ==========

// パフォーマンス
export const DRAW_TARGET_FPS = 30
export const ORIENTATION_THROTTLE_MS = 33

// カメラ
export const CAMERA_IDEAL_WIDTH = 1280
export const CAMERA_IDEAL_HEIGHT = 720

// 位置情報
export const LOCATION_MAX_AGE_MS = 2000
export const LOCATION_TIMEOUT_MS = 10000

// AR表示
export const SCREEN_X_SCALE = 0.7
export const SCREEN_Y_OFFSET = 0.3
export const SCREEN_Y_SCALE = 0.4
export const SCREEN_X_MARGIN = 50
export const ROAD_Y_RATIO = 0.85

// 角度・距離
export const MAX_ANGLE_DEGREES = 90
export const WALKING_SPEED_KMH = 4
export const DEFAULT_MAX_DISTANCE = 500
export const DEFAULT_FOV = 60
export const FOV_SAFE_MIN = 1 // 数学的安全下限（tan(0)回避）
export const FOV_SAFE_MAX = 179 // 数学的安全上限（tan(90)回避）

// 設定スライダー
export const DISTANCE_MIN = 100
export const DISTANCE_MAX = 1000
export const DISTANCE_STEP = 50
export const FOV_MIN = 40
export const FOV_MAX = 90
export const FOV_STEP = 5

// マーカー描画
export const MARKER_ICON_MIN_SIZE = 24
export const MARKER_ICON_BASE_SIZE = 48
export const MARKER_ICON_DISTANCE_DIVISOR = 15
export const MARKER_DASH_PATTERN: readonly number[] = [5, 5] as const
export const MARKER_DASH_LINE_WIDTH = 2
export const MARKER_DASH_ALPHA = 0.8
export const MARKER_BORDER_OFFSET = 2
export const MARKER_BORDER_ALPHA = 0.9
export const MARKER_CIRCLE_LINE_WIDTH = 3
export const MARKER_CIRCLE_COLOR_ALPHA = "CC"
export const MARKER_TRIANGLE_TOP = 0.5
export const MARKER_TRIANGLE_BOTTOM = 0.3
export const MARKER_TRIANGLE_WIDTH = 0.4
export const MARKER_FONT = "bold 12px sans-serif"
export const MARKER_TEXT_PADDING = 4
export const MARKER_TEXT_HEIGHT = 16
export const MARKER_TEXT_GAP = 5
export const MARKER_TEXT_BG_ALPHA = 0.7
export const MARKER_ROAD_Y_PADDING = 20
export const MARKER_FG_COLOR = "#ffffff"

// ========== ユーティリティ ==========

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): Throttled<T> {
  let inThrottle = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      timeoutId = setTimeout(() => {
        inThrottle = false
        timeoutId = null
      }, limit)
    }
  }) as Throttled<T>
  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = null
    inThrottle = false
  }
  return throttled
}

const ERROR_MESSAGES: Record<ARErrorType, Omit<ARError, "type">> = {
  camera_denied: {
    message: "カメラへのアクセスが拒否されました",
    suggestion:
      "設定アプリを開き、このサイトのカメラ許可を有効にしてください。\niOS: 設定 > Safari > カメラ\nAndroid: 設定 > サイトの設定 > カメラ",
  },
  camera_unavailable: {
    message: "カメラが利用できません",
    suggestion:
      "背面カメラが搭載されていないか、他のアプリで使用中です。他のアプリを閉じてお試しください。",
  },
  location_denied: {
    message: "位置情報へのアクセスが拒否されました",
    suggestion:
      "設定アプリを開き、位置情報サービスを有効にしてください。\niOS: 設定 > プライバシー > 位置情報サービス\nAndroid: 設定 > 位置情報",
  },
  location_unavailable: {
    message: "位置情報を取得できません",
    suggestion:
      "GPS信号が弱い可能性があります。屋外に出るか、窓際で試してください。",
  },
  orientation_denied: {
    message: "デバイスの向き検出が拒否されました",
    suggestion:
      "方向検出なしでも利用可能ですが、精度が低下します。設定から許可を有効にすることをお勧めします。",
  },
  orientation_unavailable: {
    message: "デバイスの向き検出がサポートされていません",
    suggestion:
      "お使いのデバイスはコンパス機能に対応していません。危険個所は表示されますが、方向の精度が低くなります。",
  },
  unknown: {
    message: "予期しないエラーが発生しました",
    suggestion: "ページを再読み込みするか、しばらくしてからお試しください。",
  },
}

export function createARError(type: ARErrorType, customMessage?: string): ARError {
  const base = ERROR_MESSAGES[type]
  return {
    type,
    message: customMessage && type === "unknown" ? customMessage : base.message,
    suggestion: base.suggestion,
  }
}
