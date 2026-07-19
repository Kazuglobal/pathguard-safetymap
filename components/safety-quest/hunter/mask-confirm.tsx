"use client"

// =============================================
// きけんハンター プライバシー前処理UI (Phase 0)
// 子どもの写真をAIに送る「前」に、顔・表札・ナンバーを
// 端末内でぼかす。未マスク画像は絶対に外部へ出さない。
// onConfirm は canvas で生成したマスク済み dataURL のみを返す。
// 顔検出は端末内推論のみ: MediaPipe FaceDetector(動的import) を第一候補、
// 失敗時はネイティブ FaceDetector、それも無ければ手動矩形のみにフォールバック。
// 推論はすべてブラウザ内で完結し、未マスク画像は外部へ送らない
// (CDN からは WASM とモデルのみを取得し、写真は fetch しない)。
//
// UI: 検出待ちの間も見出し・説明・スケルトンを即時表示して
// 「無反応の空白」を作らない(初回は WASM 取得で数秒かかるため)。
// =============================================

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ImageIcon, RotateCcw, Sparkles, X } from "lucide-react"
import {
  buildBlurRegions,
  type DetectedFace,
} from "@/lib/hunter/masking"
import type { HunterRegion } from "@/lib/hunter/types"
import {
  BottomBar,
  Mascot,
  PrimaryCTA,
  SpeechBubble,
  Sticker,
  tokens,
} from "./theme"

const C = tokens.color

export interface MaskConfirmProps {
  /** ユーザーが選んだ元画像 (端末内のみで処理) */
  file: File
  /** マスク済み dataURL のみを返す (未マスクは絶対に渡さない)。第2引数はぼかし数 */
  onConfirm: (maskedDataUrl: string, maskedCount: number) => void
  /** キャンセル */
  onCancel: () => void
}

/** ぼかしの強さ (ピクセレート時の縮小先サイズ目安・px) */
const PIXELATE_TARGET_PX = 12
/** 表示キャンバスの最大幅 (見やすさ用。出力解像度には影響しない方針で原寸描画) */
const MAX_DISPLAY_WIDTH = 480
/**
 * AI送信用画像の長辺上限。
 * Vercel Functions の 4.5MB リクエスト上限に対し、base64/JSON の膨張分を含めても
 * 十分な余白を持たせつつ、危険箇所を判別できる解像度を維持する。
 */
const MAX_MASKED_OUTPUT_LONG_EDGE = 1600
/** ドラッグ確定とみなす最小サイズ (相対座標 0..1) */
const MIN_DRAG_SIZE = 0.02
const PROCESSING_TIMEOUT_MS = 12_000

type DragState = {
  startX: number
  startY: number
  curX: number
  curY: number
}

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

function releaseMediaPipeFaceDetector(): void {
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
 * ブラウザ標準 (実験的) の FaceDetector によるフォールバック検出。
 * 無い / 失敗しても throw せず空配列を返す (手動のみで続行)。
 */
async function detectFacesNative(
  source: CanvasImageSource,
  imgWidth: number,
  imgHeight: number,
): Promise<DetectedFace[]> {
  if (!hasNativeFaceDetector() || imgWidth <= 0 || imgHeight <= 0) return []
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
    return results.map((r) => ({
      x: r.boundingBox.x / imgWidth,
      y: r.boundingBox.y / imgHeight,
      width: r.boundingBox.width / imgWidth,
      height: r.boundingBox.height / imgHeight,
    }))
  } catch {
    // 検出失敗は許容 (手動ぼかしで続行)
    return []
  }
}

/**
 * オンデバイス顔検出 (検出チェーン)。
 * 1. MediaPipe FaceDetector を第一候補 (端末内推論)。
 * 2. 失敗したら throw せず、ネイティブ FaceDetector にフォールバック。
 * 3. それも無ければ空配列 → 手動矩形のみで続行。
 * いずれの段でも未マスク画像は外部へ送らない。
 */
async function detectFaces(
  source: HTMLImageElement,
  imgWidth: number,
  imgHeight: number,
): Promise<DetectedFace[]> {
  if (imgWidth <= 0 || imgHeight <= 0) return []
  try {
    return await detectFacesMediaPipe(source, imgWidth, imgHeight)
  } catch (error) {
    // MediaPipe のロード/推論失敗は許容し、ネイティブ検出へフォールバック。
    console.warn(
      "MediaPipe 顔検出に失敗したため、ネイティブ FaceDetector にフォールバックします:",
      error,
    )
  }
  return detectFacesNative(source, imgWidth, imgHeight)
}

/**
 * 1つのぼかし領域を canvas に適用 (強いピクセレート)。
 * 対象範囲を極小サイズに縮小 → 元範囲へ拡大描画することで判別不能化する。
 */
function applyBlurRegion(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  region: HunterRegion,
): void {
  const sx = Math.round(region.x * canvas.width)
  const sy = Math.round(region.y * canvas.height)
  const sw = Math.round(region.w * canvas.width)
  const sh = Math.round(region.h * canvas.height)
  if (sw <= 0 || sh <= 0) return

  // 縮小先サイズ (アスペクト維持・最低1px)
  const scale = Math.min(1, PIXELATE_TARGET_PX / Math.max(sw, sh))
  const tw = Math.max(1, Math.round(sw * scale))
  const th = Math.max(1, Math.round(sh * scale))

  const tmp = document.createElement("canvas")
  tmp.width = tw
  tmp.height = th
  const tctx = tmp.getContext("2d")
  if (!tctx) return

  // 対象範囲を縮小コピー
  tctx.imageSmoothingEnabled = true
  tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, tw, th)

  // 縮小画像をブロック状に拡大描画 (ピクセレート)
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, sw, sh)

  // さらにブラーで境界をなじませる (対応ブラウザのみ)
  try {
    ctx.save()
    ctx.filter = "blur(4px)"
    ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, sw, sh)
    ctx.restore()
  } catch {
    // ctx.filter 未対応でもピクセレートだけで十分判別不能
  }
  ctx.imageSmoothingEnabled = prevSmoothing
}

/** ドラッグ状態 → 正規化矩形 (0..1) */
function dragToRegion(drag: DragState): HunterRegion {
  const x = Math.min(drag.startX, drag.curX)
  const y = Math.min(drag.startY, drag.curY)
  const w = Math.abs(drag.curX - drag.startX)
  const h = Math.abs(drag.curY - drag.startY)
  return { x, y, w, h }
}

export function calculateMaskedOutputSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const scale = Math.min(1, MAX_MASKED_OUTPUT_LONG_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function MaskConfirm(props: MaskConfirmProps) {
  const { file, onConfirm, onCancel } = props
  const reduce = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // 元画像を保持 (ぼかしは常に原画像から再描画して累積劣化を防ぐ)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [autoRegions, setAutoRegions] = useState<HunterRegion[]>([])
  const [manualRegions, setManualRegions] = useState<HunterRegion[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  // 画像自体が壊れている等で読み込めなかった(先へ進ませない)
  const [loadFailed, setLoadFailed] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [processingTimedOut, setProcessingTimedOut] = useState(false)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // --- 画像ロード + 自動検出 ---
  useEffect(() => {
    let revoked = false
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    setPreviewObjectUrl(objectUrl)
    setIsLoading(true)
    setLoadFailed(false)
    setProcessingTimedOut(false)
    setErrorMessage(null)

    const timeoutId = window.setTimeout(() => {
      if (revoked) return
      setProcessingTimedOut(true)
      setIsLoading(false)
      setErrorMessage("しゃしんの じゅんびに じかんが かかっています。やりなおすか、べつの写真をえらんでね。")
    }, PROCESSING_TIMEOUT_MS)

    img.onload = () => {
      if (revoked) return
      imageRef.current = img
      const naturalW = img.naturalWidth || img.width
      const naturalH = img.naturalHeight || img.height
      const ratio = naturalH > 0 ? naturalH / naturalW : 1
      const dispW = Math.min(MAX_DISPLAY_WIDTH, naturalW || MAX_DISPLAY_WIDTH)
      setDisplaySize({ w: dispW, h: Math.round(dispW * ratio) })

      // 自動検出 (失敗しても続行)
      void detectFaces(img, naturalW, naturalH)
        .then((faces) => {
          if (revoked) return
          window.clearTimeout(timeoutId)
          setAutoRegions(buildBlurRegions(faces))
          // タイムアウト表示後に検出が完了した場合はUIを回復させる
          // (回復させないと、実際は準備完了なのに「やりなおしてね」で固定される)
          setProcessingTimedOut(false)
          setErrorMessage(null)
        })
        .finally(() => {
          if (!revoked) {
            window.clearTimeout(timeoutId)
            setIsLoading(false)
          }
        })
    }

    img.onerror = () => {
      if (revoked) return
      window.clearTimeout(timeoutId)
      setLoadFailed(true)
      setIsLoading(false)
    }

    img.src = objectUrl

    return () => {
      revoked = true
      window.clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
      setPreviewObjectUrl((current) => (current === objectUrl ? null : current))
    }
  }, [file, retryKey])

  // 検出器の解放はアンマウント時のみ。file/retryKey 変更ごとに解放すると、
  // モジュール内キャッシュの意図(WASM+モデルのロードはセッション中1度)が壊れ、
  // 写真の選び直し・やりなおしのたびにフル再ダウンロードが走る。
  useEffect(() => releaseMediaPipeFaceDetector, [])

  // --- canvas 再描画 (原画像 → 全ぼかし領域) ---
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    const naturalW = img.naturalWidth || img.width
    const naturalH = img.naturalHeight || img.height
    if (naturalW <= 0 || naturalH <= 0) return

    // 出力品質確保のため原寸でレンダリング (表示は CSS で縮小)
    if (canvas.width !== naturalW) canvas.width = naturalW
    if (canvas.height !== naturalH) canvas.height = naturalH

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, naturalW, naturalH)

    const regions = [...autoRegions, ...manualRegions]
    for (const region of regions) {
      applyBlurRegion(ctx, canvas, region)
    }

    // ドラッグ中のプレビュー枠 (出力には残らない: confirm 時は再描画される)
    if (drag) {
      const r = dragToRegion(drag)
      ctx.save()
      ctx.strokeStyle = "#159E72"
      ctx.lineWidth = Math.max(2, canvas.width / 240)
      ctx.setLineDash([canvas.width / 60, canvas.width / 120])
      ctx.strokeRect(
        r.x * canvas.width,
        r.y * canvas.height,
        r.w * canvas.width,
        r.h * canvas.height,
      )
      ctx.restore()
    }
  }, [autoRegions, manualRegions, drag])

  useEffect(() => {
    redraw()
  }, [redraw, isLoading])

  // --- ポインタ → 相対座標 (0..1) ---
  const toRelative = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
      const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
      return {
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1),
      }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const { x, y } = toRelative(e.clientX, e.clientY)
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDrag({ startX: x, startY: y, curX: x, curY: y })
    },
    [toRelative],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drag) return
      const { x, y } = toRelative(e.clientX, e.clientY)
      setDrag((prev) => (prev ? { ...prev, curX: x, curY: y } : prev))
    },
    [drag, toRelative],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drag) return
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      const region = dragToRegion(drag)
      setDrag(null)
      if (region.w >= MIN_DRAG_SIZE && region.h >= MIN_DRAG_SIZE) {
        setManualRegions((prev) => [...prev, region])
      }
    },
    [drag],
  )

  const handleUndo = useCallback(() => {
    setManualRegions((prev) => prev.slice(0, -1))
  }, [])

  const handleRetry = useCallback(() => {
    setAutoRegions([])
    setManualRegions([])
    setDrag(null)
    imageRef.current = null
    setRetryKey((value) => value + 1)
  }, [])

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) {
      setErrorMessage("しゃしんの じゅんびが できていません")
      return
    }
    // ドラッグ枠を残さないよう確定再描画
    setDrag(null)
    // 直近 state を反映した最終フレームを生成
    const ctx = canvas.getContext("2d")
    const img = imageRef.current
    if (!ctx) return
    const naturalW = img.naturalWidth || img.width
    const naturalH = img.naturalHeight || img.height
    const outputSize = calculateMaskedOutputSize(naturalW, naturalH)
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    ctx.clearRect(0, 0, outputSize.width, outputSize.height)
    ctx.drawImage(img, 0, 0, outputSize.width, outputSize.height)
    for (const region of [...autoRegions, ...manualRegions]) {
      applyBlurRegion(ctx, canvas, region)
    }
    try {
      // マスク済みのみを出力 (未マスク画像は一切外へ出さない)。
      // webp で出力: canvas 再エンコードは EXIF(GPS含む) を引き継がないため、
      // 保存時の EXIF/位置情報の残存をクライアント側でも防ぐ (サーバも webp 限定)。
      const maskedDataUrl = canvas.toDataURL("image/webp", 0.85)
      onConfirm(maskedDataUrl, autoRegions.length + manualRegions.length)
    } catch (error) {
      console.error("マスク済み画像の生成に失敗:", error)
      setErrorMessage("しゃしんの ほぞんに しっぱいしました")
    }
  }, [autoRegions, manualRegions, onConfirm])

  const totalRegions = autoRegions.length + manualRegions.length
  const undoDisabled = manualRegions.length === 0

  return (
    <div className="mx-auto flex w-full max-w-md min-h-full flex-1 flex-col px-5 pt-2">
      <div className="flex flex-1 flex-col gap-3.5">
        <SpeechBubble mood={isLoading || processingTimedOut ? "think" : "cheer"}>
          {isLoading || processingTimedOut ? (
            <>かおや なまえを かくしています。しゃしんは この端末の中で じゅんびするよ。</>
          ) : (
            <>かお・なまえ・おうち・くるまの ナンバーを もやもやに かくしたよ。かくしたい ところは <b>ゆびで なぞって</b> ついかしてね。</>
          )}
        </SpeechBubble>

        {/* 写真(白フレーム)。ロード中もスケルトンを出して空白を作らない */}
        <div
          className="relative mx-auto w-full rounded-[18px] border bg-white p-2"
          style={{ borderColor: "rgba(67,57,43,.09)", boxShadow: tokens.shadow.card, maxWidth: MAX_DISPLAY_WIDTH + 16 }}
        >
          <div
            className="relative overflow-hidden rounded-[12px]"
            style={{ background: C.paperDeep, minHeight: isLoading ? undefined : 120 }}
          >
            {/* 読み込み失敗(壊れた画像など): 先へ進ませず、えらび直しへ誘導 */}
            {loadFailed && (
              <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Mascot size="md" mood="think" />
                <p className="text-[14.5px] font-black leading-relaxed" style={{ color: "#D9E5DE" }}>
                  この しゃしんは よみこめなかったよ。
                  <br />
                  「やめる」から べつの 1まいを えらんでね。
                </p>
              </div>
            )}

            {/* ロード中スケルトン(4:3) */}
            {(isLoading || processingTimedOut) && !loadFailed && (
              <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden">
                {previewObjectUrl && (
                  <div
                    className="absolute -inset-6 scale-110 bg-cover bg-center opacity-55"
                    style={{ backgroundImage: `url(${previewObjectUrl})`, filter: "blur(22px) saturate(.7)" }}
                    aria-hidden="true"
                  />
                )}
                {!reduce && (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-y-0 w-1/3"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent)",
                    }}
                    initial={{ left: "-35%" }}
                    animate={{ left: ["-35%", "105%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <div className="relative z-10 rounded-[18px] border bg-[#FFFDF7]/95 px-5 py-4 text-center shadow-lg" style={{ borderColor: "rgba(67,57,43,.14)" }}>
                  <p className="text-[15px] font-black" style={{ color: C.ink }}>しゃしんを じゅんび中 2/3</p>
                  <p className="mt-1 text-[12.5px] font-bold" style={{ color: C.inkSoft }}>かおや なまえを かくしています</p>
                  <div className="mt-3 flex justify-center gap-3" aria-hidden="true">
                    {[1, 2, 3].map((step) => <span key={step} className="h-3 w-3 rounded-full" style={{ background: step <= 2 ? C.primary : C.inkFaint }} />)}
                  </div>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              role="img"
              aria-label="ぼかしを かける しゃしん。ドラッグで かくす しかくを ついか"
              className={isLoading || loadFailed || processingTimedOut ? "hidden" : "block"}
              style={{
                maxWidth: "100%",
                width: "100%",
                height: "auto",
                touchAction: "none",
                cursor: "crosshair",
              }}
            />
          </div>

          {/* かくしている数(シール) */}
          {!isLoading && !loadFailed && !processingTimedOut && (
            <div className="absolute -top-3 left-3 z-10">
              <Sticker tone={totalRegions > 0 ? "green" : "paper"} tilt={-3}>
                かくした ばしょ {totalRegions}こ
                {autoRegions.length > 0 && `（じどう ${autoRegions.length}）`}
              </Sticker>
            </div>
          )}
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-[14px] px-4 py-3 text-[13.5px] font-black"
            style={{ background: C.dangerSoft, color: C.danger }}
          >
            {errorMessage}
          </p>
        )}

        {/* やりなおし系(副ボタン・タップ領域 48px 以上) */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleRetry}
            aria-label="しゃしんの じゅんびを やりなおす"
            className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full border-2 bg-white px-4 text-[14px] font-black transition-transform active:translate-y-[2px] ${tokens.cls.focus}`}
            style={{
              borderColor: "rgba(67,57,43,.14)",
              color: C.ink,
              boxShadow: tokens.shadow.pressPaper,
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            やりなおす
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label="べつの写真をえらぶ"
            className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full border-2 bg-white px-3 text-[13px] font-black transition-transform active:translate-y-[2px] ${tokens.cls.focus}`}
            style={{
              borderColor: "rgba(67,57,43,.14)",
              color: C.ink,
              boxShadow: tokens.shadow.pressPaper,
            }}
          >
            <ImageIcon className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            べつの写真をえらぶ
          </button>
          {!isLoading && !loadFailed && !processingTimedOut && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoDisabled}
              className={`col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 bg-white px-4 text-[13px] font-black ${undoDisabled ? "opacity-45" : "active:translate-y-[2px]"} ${tokens.cls.focus}`}
              style={{ borderColor: "rgba(67,57,43,.14)", color: C.inkSoft }}
            >
              <X className="h-4 w-4" aria-hidden="true" /> さいごの しかくを けす
            </button>
          )}
        </div>

        {/* 自動検出の結果をやさしく知らせる */}
        <AnimatePresence>
          {!isLoading && !loadFailed && !processingTimedOut && autoRegions.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-[12.5px] font-bold"
              style={{ color: C.inkSoft }}
            >
              かおは 見つからなかったよ。かくしたいところが あれば なぞってね。
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 主ボタン(みどり: この先へ進む安心アクション)。読み込み失敗時は進ませない */}
      <BottomBar className="-mx-5 px-5">
        <PrimaryCTA onClick={handleConfirm} disabled={isLoading || loadFailed || processingTimedOut} variant="green">
          <Sparkles className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          {isLoading ? "もうすこし まってね" : loadFailed || processingTimedOut ? "やりなおしてね" : "この しゃしんを つかう"}
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}
