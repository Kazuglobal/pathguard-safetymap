// =============================================
// 端末内の顔検出(報告の写真・きけんハンターで共用。UIUX改装 項目57)
// 推論はすべてブラウザ内で完結し、ぼかす前の写真は外部へ送らない。
// もとは components/safety-quest/hunter/mask-confirm.tsx にあった処理を、そのまま移した。
// =============================================

import type { DetectedFace } from "@/lib/media/masking"

// --- MediaPipe 顔検出 (第一候補・端末内推論) ---
// WASM とモデル(.tflite)は self-host (public/mediapipe/*) から取得する。
// 外部 CDN に依存せず CSP(script-src/connect-src 'self') 内で完結し、
// オフラインでも動く (設計書 §6.6)。写真(未マスク画像)は fetch せず、
// detector.detect(img) に渡してブラウザ内 (WASM) で推論する。
// 資産は scripts/copy-mediapipe.js が predev/build 時に node_modules から配置する。
const MEDIAPIPE_WASM_BASE = "/mediapipe/wasm"
const BLAZE_FACE_MODEL_URL = "/mediapipe/models/blaze_face_short_range.tflite"

/** detect() の戻り値で利用する最小形 (型は @mediapipe/tasks-vision に準拠)。 */
type MediaPipeFaceDetector = {
  detect: (image: HTMLImageElement) => {
    detections: ReadonlyArray<{
      boundingBox?: { originX: number; originY: number; width: number; height: number }
      categories?: ReadonlyArray<{ score: number }>
    }>
  }
  close?: () => void
}

/**
 * FaceDetector の生成は重い (WASM + モデル取得) ため、モジュール内で 1 度だけ。
 * 失敗時は promise をクリアし、次回の呼び出しで再試行できるようにする。
 */
let faceDetectorPromise: Promise<MediaPipeFaceDetector> | null = null

async function loadMediaPipeFaceDetector(): Promise<MediaPipeFaceDetector> {
  if (faceDetectorPromise) return faceDetectorPromise
  const promise = (async () => {
    // 動的 import: 初回検出時のみ MediaPipe を読み込み、初期バンドルを軽く保つ。
    const vision = await import("@mediapipe/tasks-vision")
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE)
    const detector = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: BLAZE_FACE_MODEL_URL },
      runningMode: "IMAGE",
    })
    return detector as unknown as MediaPipeFaceDetector
  })()
  faceDetectorPromise = promise
  // ロード失敗はキャッシュしない (次回フォールバック後も再試行可能に)
  promise.catch(() => {
    if (faceDetectorPromise === promise) faceDetectorPromise = null
  })
  return promise
}

export function releaseMediaPipeFaceDetector(): void {
  const active = faceDetectorPromise
  faceDetectorPromise = null
  if (!active) return
  void active.then((detector) => detector.close?.()).catch(() => undefined)
}

/**
 * MediaPipe による顔検出。ロード/推論に失敗した場合は throw する
 * (呼び出し側 detectFaces がフォールバックを担う)。
 */
async function detectFacesMediaPipe(
  source: HTMLImageElement,
  imgWidth: number,
  imgHeight: number,
): Promise<DetectedFace[]> {
  if (imgWidth <= 0 || imgHeight <= 0) return []
  const detector = await loadMediaPipeFaceDetector()
  // 推論は端末内 (WASM)。画像データは外部送信しない。
  const result = detector.detect(source)
  const faces: DetectedFace[] = []
  for (const det of result.detections) {
    const box = det.boundingBox
    if (!box) continue
    faces.push({
      x: box.originX / imgWidth,
      y: box.originY / imgHeight,
      width: box.width / imgWidth,
      height: box.height / imgHeight,
      score: det.categories?.[0]?.score,
    })
  }
  return faces
}

/** ネイティブ FaceDetector の有無を判定 (SSR セーフ) */
function hasNativeFaceDetector(): boolean {
  return typeof window !== "undefined" && "FaceDetector" in window
}

/**
 * 顔検出の結果。available が false のときは、この端末で自動の顔検出が使えなかった
 * (顔が無かったのではない)。画面で「指で隠して」と知らせ、確かめてもらってから進める
 */
export interface FaceDetectionResult {
  faces: DetectedFace[]
  available: boolean
}

const UNAVAILABLE: FaceDetectionResult = { faces: [], available: false }

/**
 * ブラウザ標準 (実験的) の FaceDetector によるフォールバック検出。
 * 無い / 失敗しても throw せず、使えなかったことを返す (手動のみで続行)。
 */
async function detectFacesNative(
  source: CanvasImageSource,
  imgWidth: number,
  imgHeight: number,
): Promise<FaceDetectionResult> {
  if (!hasNativeFaceDetector() || imgWidth <= 0 || imgHeight <= 0) return UNAVAILABLE
  try {
    // FaceDetector は実験的 API のため型定義が無い環境を考慮。
    const Ctor = (window as unknown as {
      FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
        detect: (s: CanvasImageSource) => Promise<
          ReadonlyArray<{ boundingBox: { x: number; y: number; width: number; height: number } }>
        >
      }
    }).FaceDetector
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 10 })
    const results = await detector.detect(source)
    return {
      faces: results.map((r) => ({
        x: r.boundingBox.x / imgWidth,
        y: r.boundingBox.y / imgHeight,
        width: r.boundingBox.width / imgWidth,
        height: r.boundingBox.height / imgHeight,
      })),
      available: true,
    }
  } catch {
    // 検出失敗は許容 (手動ぼかしで続行)。顔が無かったのではないので、使えなかったと返す
    return UNAVAILABLE
  }
}

/**
 * オンデバイス顔検出 (検出チェーン)。
 * 1. MediaPipe FaceDetector を第一候補 (端末内推論)。
 * 2. 失敗したら throw せず、ネイティブ FaceDetector にフォールバック。
 * 3. それも無ければ available: false → 画面で「指で隠して」と知らせ、手動矩形のみで続行。
 * いずれの段でも未マスク画像は外部へ送らない。
 */
export async function detectFaces(
  source: HTMLImageElement,
  imgWidth: number,
  imgHeight: number,
): Promise<FaceDetectionResult> {
  if (imgWidth <= 0 || imgHeight <= 0) return UNAVAILABLE
  try {
    return { faces: await detectFacesMediaPipe(source, imgWidth, imgHeight), available: true }
  } catch (error) {
    // MediaPipe のロード/推論失敗は許容し、ネイティブ検出へフォールバック。
    console.warn(
      "MediaPipe 顔検出に失敗したため、ネイティブ FaceDetector にフォールバックします:",
      error,
    )
  }
  return detectFacesNative(source, imgWidth, imgHeight)
}
