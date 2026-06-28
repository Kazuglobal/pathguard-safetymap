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
// =============================================

import { useCallback, useEffect, useRef, useState } from "react"
import { Eye, RotateCcw, Sparkles, X } from "lucide-react"
import {
  buildBlurRegions,
  type DetectedFace,
} from "@/lib/hunter/masking"
import type { HunterRegion } from "@/lib/hunter/types"
import { Mascot, PrimaryCTA, tokens } from "./theme"

/** 丸ゴシックの親しみフォントスタック（テーマと統一） */
const FONT_FAMILY =
  '"M PLUS Rounded 1c","Zen Maru Gothic","Hiragino Maru Gothic ProN",sans-serif'

export interface MaskConfirmProps {
  /** ユーザーが選んだ元画像 (端末内のみで処理) */
  file: File
  /** マスク済み dataURL のみを返す (未マスクは絶対に渡さない) */
  onConfirm: (maskedDataUrl: string) => void
  /** キャンセル */
  onCancel: () => void
}

/** ぼかしの強さ (ピクセレート時の縮小先サイズ目安・px) */
const PIXELATE_TARGET_PX = 12
/** 表示キャンバスの最大幅 (見やすさ用。出力解像度には影響しない方針で原寸描画) */
const MAX_DISPLAY_WIDTH = 480
/** ドラッグ確定とみなす最小サイズ (相対座標 0..1) */
const MIN_DRAG_SIZE = 0.02

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

export function MaskConfirm(props: MaskConfirmProps) {
  const { file, onConfirm, onCancel } = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // 元画像を保持 (ぼかしは常に原画像から再描画して累積劣化を防ぐ)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [autoRegions, setAutoRegions] = useState<HunterRegion[]>([])
  const [manualRegions, setManualRegions] = useState<HunterRegion[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  })

  // --- 画像ロード + 自動検出 ---
  useEffect(() => {
    let revoked = false
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

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
          setAutoRegions(buildBlurRegions(faces))
        })
        .finally(() => {
          if (!revoked) setIsLoading(false)
        })
    }

    img.onerror = () => {
      if (revoked) return
      setErrorMessage("しゃしんを よみこめませんでした")
      setIsLoading(false)
    }

    img.src = objectUrl

    return () => {
      revoked = true
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

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
      ctx.strokeStyle = "#2563eb"
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
  }, [redraw])

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
    canvas.width = naturalW
    canvas.height = naturalH
    ctx.clearRect(0, 0, naturalW, naturalH)
    ctx.drawImage(img, 0, 0, naturalW, naturalH)
    for (const region of [...autoRegions, ...manualRegions]) {
      applyBlurRegion(ctx, canvas, region)
    }
    try {
      // マスク済みのみを出力 (未マスク画像は一切外へ出さない)。
      // webp で出力: canvas 再エンコードは EXIF(GPS含む) を引き継がないため、
      // 保存時の EXIF/位置情報の残存をクライアント側でも防ぐ (サーバも webp 限定)。
      const maskedDataUrl = canvas.toDataURL("image/webp", 0.85)
      onConfirm(maskedDataUrl)
    } catch (error) {
      console.error("マスク済み画像の生成に失敗:", error)
      setErrorMessage("しゃしんの ほぞんに しっぱいしました")
    }
  }, [autoRegions, manualRegions, onConfirm])

  const totalRegions = autoRegions.length + manualRegions.length

  const C = tokens.color
  const undoDisabled = manualRegions.length === 0

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0",
        minHeight: 0,
        gap: 12,
        padding: 16,
        borderRadius: tokens.radius.card,
        background: C.surfaceWarm,
        boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}`,
        width: "100%",
        maxWidth: MAX_DISPLAY_WIDTH + 48,
        margin: "0 auto",
        boxSizing: "border-box",
        color: C.ink,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* 見出し＋見守るハンタくん（おうちの人との やくそく 風） */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mascot size="sm" mood="cheer" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.3,
              color: C.ink,
            }}
          >
            しゃしんを かくしてから つかおう
          </h2>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft }}>
            おうちの人との やくそく
          </span>
        </div>
      </div>

      {/* 注意文（warning 面の上は ink 文字固定・白文字禁止） */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          background: "#FFF6DD",
          borderRadius: tokens.radius.chip,
          padding: "12px 14px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 9999,
            background: C.warning,
            color: C.ink,
          }}
        >
          <Eye size={17} strokeWidth={2.4} />
        </span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: C.ink }}>
          <ruby>
            顔<rt>かお</rt>
          </ruby>
          ・
          <ruby>
            名前<rt>なまえ</rt>
          </ruby>
          ・お
          <ruby>
            家<rt>いえ</rt>
          </ruby>
          ・
          <ruby>
            車<rt>くるま</rt>
          </ruby>
          のナンバーが かくれているか かくにんしてね。
          <br />
          かくしたいところを ゆびで なぞって しかくを ついかできるよ。
        </p>
      </div>

      <div
        style={{
          position: "relative",
          flex: "1 1 0",
          minHeight: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="img"
          aria-label="ぼかしを かける しゃしん。ドラッグで かくす しかくを ついか"
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            borderRadius: tokens.radius.thumb,
            border: `3px solid ${C.primary}`,
            touchAction: "none",
            cursor: "crosshair",
            background: "#E2ECF6",
          }}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: tokens.radius.thumb,
              background: "rgba(255,248,239,.86)",
            }}
          >
            <Mascot size="sm" mood="think" />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.primaryStrong }}>
              よみこみちゅう…
            </span>
          </div>
        )}
      </div>

      {/* かくしている ばしょの数（やさしい言い回し） */}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.inkSoft }}>
        かくしている ばしょ:{" "}
        <span style={{ color: C.success, fontSize: 18, fontWeight: 800 }}>
          {totalRegions}
        </span>{" "}
        こ
        {autoRegions.length > 0 && `（じどう ${autoRegions.length} こ）`}
      </p>

      {errorMessage && (
        <p
          role="alert"
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
            color: C.danger,
            background: "#FCEBEB",
            borderRadius: tokens.radius.chip,
            padding: "10px 12px",
          }}
        >
          {errorMessage}
        </p>
      )}

      {/* やりなおし系（副ボタン・タップ領域 48px 以上） */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoDisabled}
          aria-label="さいごに ついかした しかくを けす"
          style={{
            flex: "1 1 0",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 48,
            padding: "0 14px",
            borderRadius: 9999,
            border: `2px solid ${undoDisabled ? "#E2E8F0" : "#CBD8E6"}`,
            background: undoDisabled ? "#F2F5F9" : C.surface,
            color: undoDisabled ? "#9AA8B6" : C.ink,
            fontWeight: 700,
            fontSize: 15,
            fontFamily: FONT_FAMILY,
            cursor: undoDisabled ? "not-allowed" : "pointer",
          }}
        >
          <RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" />
          ひとつ もどす
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ぼかしを やめて とじる"
          style={{
            flex: "1 1 0",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 48,
            padding: "0 14px",
            borderRadius: 9999,
            border: "2px solid #CBD8E6",
            background: C.surface,
            color: C.ink,
            fontWeight: 700,
            fontSize: 15,
            fontFamily: FONT_FAMILY,
            cursor: "pointer",
          }}
        >
          <X size={16} strokeWidth={2.4} aria-hidden="true" />
          やめる
        </button>
      </div>

      {/* 主ボタン（青CTA：この先へ進む安心アクション） */}
      <PrimaryCTA
        onClick={handleConfirm}
        disabled={isLoading}
        className={tokens.cls.ctaBlue}
      >
        <Sparkles size={20} strokeWidth={2.4} aria-hidden="true" />
        この しゃしんを つかう
      </PrimaryCTA>
    </div>
  )
}
