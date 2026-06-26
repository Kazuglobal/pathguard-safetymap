"use client"

// =============================================
// きけんハンター プライバシー前処理UI (Phase 0)
// 子どもの写真をAIに送る「前」に、顔・表札・ナンバーを
// 端末内でぼかす。未マスク画像は絶対に外部へ出さない。
// onConfirm は canvas で生成したマスク済み dataURL のみを返す。
// 重い依存 (MediaPipe 等) は使わず、ネイティブ FaceDetector + 手動矩形のみ。
// =============================================

import { useCallback, useEffect, useRef, useState } from "react"
import {
  buildBlurRegions,
  type DetectedFace,
} from "@/lib/hunter/masking"
import type { HunterRegion } from "@/lib/hunter/types"

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

/** FaceDetector の有無を判定 (SSR セーフ) */
function hasFaceDetector(): boolean {
  return typeof window !== "undefined" && "FaceDetector" in window
}

/**
 * オンデバイス顔検出 (任意)。
 * FaceDetector が無い / 失敗しても throw せず空配列を返す (手動のみで続行)。
 */
async function detectFaces(
  source: CanvasImageSource,
  imgWidth: number,
  imgHeight: number,
): Promise<DetectedFace[]> {
  if (!hasFaceDetector() || imgWidth <= 0 || imgHeight <= 0) return []
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
      // マスク済みのみを出力 (未マスク画像は一切外へ出さない)
      const maskedDataUrl = canvas.toDataURL("image/jpeg", 0.8)
      onConfirm(maskedDataUrl)
    } catch (error) {
      console.error("マスク済み画像の生成に失敗:", error)
      setErrorMessage("しゃしんの ほぞんに しっぱいしました")
    }
  }, [autoRegions, manualRegions, onConfirm])

  const totalRegions = autoRegions.length + manualRegions.length

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        borderRadius: 20,
        background: "#f0f9ff",
        border: "2px solid #bae6fd",
        maxWidth: MAX_DISPLAY_WIDTH + 48,
        margin: "0 auto",
        color: "#0f172a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0369a1" }}>
        しゃしんを かくしてから つかおう
      </h2>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          background: "#fffbeb",
          border: "2px solid #fde68a",
          borderRadius: 12,
          padding: "10px 12px",
        }}
      >
        顔・名前・お家・車のナンバーが かくれているか かくにんしてね。
        <br />
        かくしたいところを ゆびで なぞって しかくを ついかできるよ。
      </p>

      <div
        style={{
          position: "relative",
          alignSelf: "center",
          width: displaySize.w || "100%",
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
            width: "100%",
            height: "auto",
            borderRadius: 12,
            border: "2px solid #7dd3fc",
            touchAction: "none",
            cursor: "crosshair",
            background: "#e2e8f0",
          }}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#0369a1",
            }}
          >
            よみこみちゅう…
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
        かくしている ばしょ: {totalRegions} こ
        {autoRegions.length > 0 && `（じどう ${autoRegions.length} こ）`}
      </p>

      {errorMessage && (
        <p
          role="alert"
          style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#b91c1c" }}
        >
          {errorMessage}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          onClick={handleUndo}
          disabled={manualRegions.length === 0}
          aria-label="さいごに ついかした しかくを けす"
          style={{
            flex: "1 1 120px",
            padding: "10px 14px",
            borderRadius: 999,
            border: "2px solid #cbd5e1",
            background: manualRegions.length === 0 ? "#f1f5f9" : "#ffffff",
            color: manualRegions.length === 0 ? "#94a3b8" : "#334155",
            fontWeight: 700,
            fontSize: 14,
            cursor: manualRegions.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          ひとつ もどす
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ぼかしを やめて とじる"
          style={{
            flex: "1 1 120px",
            padding: "10px 14px",
            borderRadius: 999,
            border: "2px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          やめる
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          aria-label="ぼかした しゃしんを つかう"
          style={{
            flex: "2 1 160px",
            padding: "12px 16px",
            borderRadius: 999,
            border: "none",
            background: isLoading ? "#93c5fd" : "#2563eb",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 16,
            cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
          }}
        >
          このしゃしんを つかう
        </button>
      </div>
    </div>
  )
}
