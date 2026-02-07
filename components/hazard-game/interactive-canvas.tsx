"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Check, X, MousePointer2, Trash2, SkipForward } from "lucide-react"
import type { UserMarker, UserMarkerCategory } from "@/lib/hazard-game-types"

interface InteractiveCanvasProps {
  readonly imageFile: File
  readonly onComplete: (markers: readonly UserMarker[]) => void
  readonly onSkip: () => void
  readonly maxMarkers?: number
}

const MARKER_COLORS: Record<UserMarkerCategory, string> = {
  hazard: "rgba(239, 68, 68, 0.35)",
  safety: "rgba(34, 197, 94, 0.35)",
  traffic: "rgba(59, 130, 246, 0.35)",
  obstruction: "rgba(249, 115, 22, 0.35)",
  unknown: "rgba(234, 179, 8, 0.35)",
}

const MARKER_BORDER: Record<UserMarkerCategory, string> = {
  hazard: "rgba(239, 68, 68, 0.85)",
  safety: "rgba(34, 197, 94, 0.85)",
  traffic: "rgba(59, 130, 246, 0.85)",
  obstruction: "rgba(249, 115, 22, 0.85)",
  unknown: "rgba(234, 179, 8, 0.85)",
}

const CATEGORY_LABELS: Record<UserMarkerCategory, string> = {
  hazard: "危険",
  safety: "安全設備",
  traffic: "交通",
  obstruction: "障害物",
  unknown: "不明",
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function InteractiveCanvas({
  imageFile,
  onComplete,
  onSkip,
  maxMarkers = 10,
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [markers, setMarkers] = useState<readonly UserMarker[]>([])
  const [currentCategory, setCurrentCategory] = useState<UserMarkerCategory>("hazard")
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Load and draw image
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    const objectUrl = URL.createObjectURL(imageFile)

    img.onload = () => {
      const maxWidth = container.clientWidth
      const maxHeight = 500
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)

      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      imageRef.current = img
      setImageLoaded(true)
    }

    img.src = objectUrl

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile])

  // Redraw canvas whenever markers or drag state changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !imageLoaded) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const fontSize = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * 0.025))
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`
    ctx.textBaseline = "top"

    // Draw existing markers
    markers.forEach((marker, index) => {
      const rx = Math.round(marker.x * canvas.width)
      const ry = Math.round(marker.y * canvas.height)
      const rw = Math.round(marker.width * canvas.width)
      const rh = Math.round(marker.height * canvas.height)

      ctx.fillStyle = MARKER_COLORS[marker.category]
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = MARKER_BORDER[marker.category]
      ctx.lineWidth = 3
      ctx.strokeRect(rx, ry, rw, rh)

      // Label
      const labelText = `${index + 1}. ${CATEGORY_LABELS[marker.category]}`
      const textW = ctx.measureText(labelText).width
      const padX = 4
      const padY = 2
      const lbX = rx
      const lbY = Math.max(0, ry - fontSize - padY * 2)

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(lbX, lbY, textW + padX * 2, fontSize + padY * 2)
      ctx.fillStyle = "white"
      ctx.fillText(labelText, lbX + padX, lbY + padY)
    })

    // Draw current drag rectangle
    if (isDragging && dragStart && dragEnd) {
      const rx = Math.min(dragStart.x, dragEnd.x)
      const ry = Math.min(dragStart.y, dragEnd.y)
      const rw = Math.abs(dragEnd.x - dragStart.x)
      const rh = Math.abs(dragEnd.y - dragStart.y)

      ctx.fillStyle = MARKER_COLORS[currentCategory]
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = MARKER_BORDER[currentCategory]
      ctx.lineWidth = 3
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
    }
  }, [imageLoaded, markers, isDragging, dragStart, dragEnd, currentCategory])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  // Get normalized canvas coordinates from pointer event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      let clientX: number
      let clientY: number

      if ("touches" in e) {
        const touch = e.touches[0] || (e as React.TouchEvent).changedTouches[0]
        clientX = touch.clientX
        clientY = touch.clientY
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    },
    []
  )

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (markers.length >= maxMarkers) return
      if ("touches" in e) e.preventDefault()

      const coords = getCanvasCoords(e)
      setIsDragging(true)
      setDragStart(coords)
      setDragEnd(coords)
    },
    [markers.length, maxMarkers, getCanvasCoords]
  )

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDragging) return
      if ("touches" in e) e.preventDefault()

      const coords = getCanvasCoords(e)
      setDragEnd(coords)
    },
    [isDragging, getCanvasCoords]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) return

    const canvas = canvasRef.current
    if (!canvas) return

    const x = Math.min(dragStart.x, dragEnd.x) / canvas.width
    const y = Math.min(dragStart.y, dragEnd.y) / canvas.height
    const width = Math.abs(dragEnd.x - dragStart.x) / canvas.width
    const height = Math.abs(dragEnd.y - dragStart.y) / canvas.height

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)

    // Ignore tiny markers (< 3% of image dimension)
    if (width < 0.03 || height < 0.03) return

    const newMarker: UserMarker = {
      id: generateId(),
      x,
      y,
      width,
      height,
      label: `${CATEGORY_LABELS[currentCategory]} ${markers.length + 1}`,
      category: currentCategory,
      timestamp: Date.now(),
    }

    setMarkers((prev) => [...prev, newMarker])
  }, [isDragging, dragStart, dragEnd, currentCategory, markers.length])

  const handleRemoveMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const handleClearAll = useCallback(() => {
    setMarkers([])
  }, [])

  const handleComplete = useCallback(() => {
    onComplete(markers)
  }, [markers, onComplete])

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center">
            <MousePointer2 className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0" />
            危険箇所をマーキング
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <p className="text-xs sm:text-sm text-gray-600">
            写真上で危険だと思う箇所をドラッグして囲んでください（最大{maxMarkers}箇所）。
            AIの分析前にあなたの予測を記録し、後で結果と比較します。
          </p>

          {/* Category selector */}
          <div>
            <Label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">カテゴリを選択</Label>
            <RadioGroup
              value={currentCategory}
              onValueChange={(v) => setCurrentCategory(v as UserMarkerCategory)}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2"
            >
              {(Object.entries(CATEGORY_LABELS) as [UserMarkerCategory, string][]).map(
                ([cat, label]) => (
                  <div
                    key={cat}
                    className="flex items-center space-x-1 sm:space-x-1.5 p-1.5 sm:p-2 rounded border hover:bg-gray-50 cursor-pointer"
                  >
                    <RadioGroupItem value={cat} id={`cat-${cat}`} className="flex-shrink-0" />
                    <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-xs sm:text-sm flex items-center min-w-0">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm mr-1 flex-shrink-0"
                        style={{ backgroundColor: MARKER_BORDER[cat] }}
                      />
                      <span className="truncate">{label}</span>
                    </Label>
                  </div>
                )
              )}
            </RadioGroup>
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-100"
          >
            {!imageLoaded && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                画像を読み込み中...
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-auto cursor-crosshair touch-none"
              style={{ display: imageLoaded ? "block" : "none" }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false)
                  setDragStart(null)
                  setDragEnd(null)
                }
              }}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>

          {/* Marker list */}
          <div>
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-700">
                マーキング済み ({markers.length}/{maxMarkers})
              </span>
              {markers.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-red-500 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  全削除
                </Button>
              )}
            </div>
            {markers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">
                写真上をドラッグしてマーキングしてください
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {markers.map((marker, index) => (
                  <div
                    key={marker.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded border text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge
                        className="text-xs font-mono"
                        style={{
                          backgroundColor: MARKER_BORDER[marker.category],
                          color: "white",
                        }}
                      >
                        {index + 1}
                      </Badge>
                      <span>{CATEGORY_LABELS[marker.category]}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMarker(marker.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <Button
              onClick={handleComplete}
              disabled={markers.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
              <span className="truncate">マーキング完了 ({markers.length}件)</span>
            </Button>
            <Button onClick={onSkip} variant="outline" className="flex-1">
              <SkipForward className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
              <span className="truncate">スキップして分析</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
