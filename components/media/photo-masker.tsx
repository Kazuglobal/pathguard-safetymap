"use client"

/**
 * 写真の顔・ナンバーなどを、端末の中でぼかしてから使う画面(報告・不審者アラート。UIUX改装 項目57)。
 *
 * - 顔は自動でぼかす(端末内の顔検出。lib/media/face-detection.ts)
 * - ナンバープレート・表札・名札などは、写真の上を指でなぞって四角で隠す
 * - 出力はぼかした写真だけ(canvas で描き直すので、撮影場所などの EXIF も残らない)。
 *   ぼかす前の写真は、この画面の外へ出さない
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RotateCcw, ShieldCheck } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"
import { applyBlurRegion } from "@/lib/media/canvas-mask"
import { detectFaces, releaseMediaPipeFaceDetector } from "@/lib/media/face-detection"
import {
  buildBlurRegions,
  calculateMaskedOutputSize,
  dragToRegion,
  MIN_DRAG_SIZE,
  type DragState,
  type MaskRegion,
} from "@/lib/media/masking"

const t = tankenTokens
const PROCESSING_TIMEOUT_MS = 12_000
const OUTPUT_QUALITY = 0.85

export interface MaskedPhoto {
  file: File
  /** 自動でぼかした顔の数 */
  faces: number
  /** 指で隠した範囲の数 */
  manual: number
}

export interface PhotoMaskerProps {
  file: File
  onConfirm: (photo: MaskedPhoto) => void
  onCancel: () => void
}

/** ぼかした canvas を WebP(使えなければ JPEG)にする。どちらも EXIF は付かない */
async function canvasToMaskedFile(canvas: HTMLCanvasElement): Promise<File> {
  const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp")
  const type = supportsWebp ? "image/webp" : "image/jpeg"
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("toBlob failed"))), type, OUTPUT_QUALITY)
  })
  return new File([blob], supportsWebp ? "masked.webp" : "masked.jpg", { type, lastModified: Date.now() })
}

export function PhotoMasker({ file, onConfirm, onCancel }: PhotoMaskerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [autoRegions, setAutoRegions] = useState<MaskRegion[]>([])
  const [manualRegions, setManualRegions] = useState<MaskRegion[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed" | "slow">("loading")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // この端末で自動の顔検出が使えなかったとき(顔が無かったのではない)は、指で隠したことを確かめてから進める
  const [detectionAvailable, setDetectionAvailable] = useState(true)
  const [manualFaceCheck, setManualFaceCheck] = useState(false)

  useEffect(() => {
    let cancelled = false
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    setStatus("loading")
    setError(null)
    setAutoRegions([])
    setManualRegions([])
    setDetectionAvailable(true)
    setManualFaceCheck(false)
    imageRef.current = null
    const timeoutId = window.setTimeout(() => { if (!cancelled) setStatus("slow") }, PROCESSING_TIMEOUT_MS)

    image.onload = () => {
      if (cancelled) return
      imageRef.current = image
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      void detectFaces(image, width, height)
        .then((result) => {
          if (cancelled) return
          setAutoRegions(buildBlurRegions(result.faces))
          setDetectionAvailable(result.available)
        })
        .catch(() => { if (!cancelled) setDetectionAvailable(false) })
        .finally(() => {
          if (cancelled) return
          window.clearTimeout(timeoutId)
          setStatus("ready")
        })
    }
    image.onerror = () => {
      if (cancelled) return
      window.clearTimeout(timeoutId)
      setStatus("failed")
    }
    image.src = objectUrl

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
    }
  }, [file, retryKey])

  useEffect(() => releaseMediaPipeFaceDetector, [])

  // 原画像 → すべてのぼかしの順に描き直す(ぼかしを重ねて劣化させない)。表示は CSS で縮める
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const size = calculateMaskedOutputSize(image.naturalWidth || image.width, image.naturalHeight || image.height)
    if (canvas.width !== size.width) canvas.width = size.width
    if (canvas.height !== size.height) canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const region of [...autoRegions, ...manualRegions]) applyBlurRegion(context, canvas, region)
    if (drag) {
      const region = dragToRegion(drag)
      context.save()
      context.strokeStyle = t.color.primary
      context.lineWidth = Math.max(2, canvas.width / 240)
      context.setLineDash([canvas.width / 60, canvas.width / 120])
      context.strokeRect(region.x * canvas.width, region.y * canvas.height, region.w * canvas.width, region.h * canvas.height)
      context.restore()
    }
  }, [autoRegions, manualRegions, drag])

  useEffect(() => { redraw() }, [redraw, status])

  const toRelative = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1),
    }
  }

  const confirm = async () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return
    setSaving(true)
    setError(null)
    setDrag(null)
    try {
      // ドラッグ中の枠を残さないよう、ぼかしだけを描き直してから書き出す
      const context = canvas.getContext("2d")
      if (!context) throw new Error("no context")
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height)
      for (const region of [...autoRegions, ...manualRegions]) applyBlurRegion(context, canvas, region)
      onConfirm({ file: await canvasToMaskedFile(canvas), faces: autoRegions.length, manual: manualRegions.length })
    } catch {
      setError("写真を書き出せませんでした。もう一度お試しいただくか、別の写真を選んでください。")
    } finally {
      setSaving(false)
    }
  }

  const buttonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold ${t.cls.focus}`

  if (status === "failed") {
    return (
      <div className="space-y-3" data-testid="photo-masker">
        <p role="alert" className="text-sm font-bold text-red-700">この写真は開けませんでした。</p>
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          JPEG・PNG・WebP の写真を選んでください。iPhone の写真は、写真アプリから選ぶと自動で開ける形式になります。
        </p>
        <button type="button" onClick={onCancel} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
          写真を選び直す
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="photo-masker">
      {status === "ready" && !detectionAvailable ? (
        <p role="status" className="rounded-xl border px-3 py-2 text-sm font-bold leading-relaxed" style={{ borderColor: t.color.accent, background: t.color.accentSoft }} data-testid="photo-masker-detection-unavailable">
          この端末では、顔の自動ぼかしが使えませんでした。写っている顔は、ナンバープレート・表札・名札などと同じように、写真の上を指でなぞって四角で隠してください。
        </p>
      ) : (
        <p className="text-sm leading-relaxed">
          {status === "ready"
            ? `顔は自動でぼかしました(${autoRegions.length}か所)。遠くの人や小さく写った顔は見つからないことがあるので、写っている顔を確かめてください。ナンバープレート・表札・名札なども、写真の上を指でなぞって四角で隠せます。`
            : "写真の中の顔をさがしています…(この端末の中だけで行います)"}
        </p>
      )}
      <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: t.border.soft, background: t.color.paperDeep }}>
        {status !== "ready" && (
          <div className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm" style={{ color: t.color.inkSoft }} role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {status === "slow" ? "準備に時間がかかっています" : "準備しています"}
          </div>
        )}
        <canvas
          ref={canvasRef}
          aria-label="ぼかした写真。指でなぞると、その四角の中を隠せます"
          className={`block h-auto w-full touch-none ${status === "ready" ? "" : "hidden"}`}
          onPointerDown={(event) => {
            if (status !== "ready") return
            event.preventDefault()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const { x, y } = toRelative(event.clientX, event.clientY)
            setDrag({ startX: x, startY: y, curX: x, curY: y })
          }}
          onPointerMove={(event) => {
            if (!drag) return
            const { x, y } = toRelative(event.clientX, event.clientY)
            setDrag((current) => (current ? { ...current, curX: x, curY: y } : current))
          }}
          onPointerUp={(event) => {
            if (!drag) return
            event.currentTarget.releasePointerCapture?.(event.pointerId)
            const region = dragToRegion(drag)
            setDrag(null)
            if (region.w >= MIN_DRAG_SIZE && region.h >= MIN_DRAG_SIZE) setManualRegions((current) => [...current, region])
          }}
        />
      </div>
      {status === "slow" && (
        <button type="button" onClick={() => setRetryKey((value) => value + 1)} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
          もう一度ためす
        </button>
      )}
      <p className="flex gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: t.color.primarySoft, color: t.color.ink }} data-testid="photo-masker-ai-notice">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: t.color.primaryStrong }} aria-hidden="true" />
        この加工した写真だけを保存し、AI(Google Gemini・Anthropic Claude・OpenAI)による確認にも送ります。元の写真は端末の外に出しません。
      </p>
      {status === "ready" && !detectionAvailable && (
        <label className="flex items-start gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={manualFaceCheck}
            onChange={(event) => setManualFaceCheck(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          写っている顔は、すべて指で隠しました(顔は写っていません)
        </label>
      )}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { void confirm() }}
          disabled={status !== "ready" || saving || (!detectionAvailable && !manualFaceCheck)}
          className={`${buttonClass} text-white disabled:opacity-50`}
          style={{ background: t.color.primaryStrong }}
        >
          {saving ? "書き出し中…" : "この写真で進む"}
        </button>
        <button
          type="button"
          onClick={() => setManualRegions((current) => current.slice(0, -1))}
          disabled={manualRegions.length === 0}
          className={`${buttonClass} border disabled:opacity-50`}
          style={{ borderColor: t.border.soft }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ひとつ戻す
        </button>
        <button type="button" onClick={onCancel} className={`${buttonClass} border`} style={{ borderColor: t.border.soft }}>
          写真を選び直す
        </button>
      </div>
    </div>
  )
}
