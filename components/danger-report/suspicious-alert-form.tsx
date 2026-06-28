"use client"

// =============================================
// 不審者アラート 専用入力フォーム（軽量）
// 学校配信の不審者情報を「最速で地図化」するための軽量フォーム。
// 既存の重い danger-report-form.tsx とは別物。
// - 住所/エリア検索（/api/mapbox/geocode）
// - 一言メモ（任意）
// - 半径選択（200/300/500/1000m、既定300m）
// - 写真添付（任意・MIMEスニッフ検証）
// 設計書: docs/plans/2026-06-28-suspicious-alert-map-visualization-plan.md §2
// =============================================

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, MapPin, Loader2, X, UserX, ImagePlus, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ALERT_RADIUS_OPTIONS,
  DEFAULT_ALERT_RADIUS_M,
  resolveAlertRadius,
} from "@/lib/suspicious-alert"

export interface SuspiciousAlertFormPayload {
  memo: string
  radiusM: number
  originalImageFile: File | null
}

interface SuspiciousAlertFormProps {
  selectedLocation: [number, number] | null
  onLocationPick: (coords: [number, number]) => void
  onRadiusChange?: (radiusM: number) => void
  onSubmit: (payload: SuspiciousAlertFormPayload) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

interface GeoResult {
  name: string
  lon: number
  lat: number
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return "image/gif"
  return null
}

async function validateImageFile(file: File): Promise<{ ok: boolean; reason?: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "画像サイズが大きすぎます（10MBまで）。" }
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const sniffed = sniffImageMime(header)
  if (!sniffed || !ALLOWED_IMAGE_MIME_TYPES.has(sniffed)) {
    return { ok: false, reason: "対応していない画像形式です。JPEG/PNG/WebP/GIFのみ利用できます。" }
  }
  return { ok: true }
}

function parseGeoFeature(feature: unknown): GeoResult | null {
  if (!feature || typeof feature !== "object") return null
  const f = feature as { place_name_ja?: string; place_name?: string; text?: string; center?: unknown }
  if (!Array.isArray(f.center) || f.center.length < 2) return null
  const lon = Number(f.center[0])
  const lat = Number(f.center[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return { name: f.place_name_ja ?? f.place_name ?? f.text ?? "不明", lon, lat }
}

export default function SuspiciousAlertForm({
  selectedLocation,
  onLocationPick,
  onRadiusChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: SuspiciousAlertFormProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeoResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [memo, setMemo] = useState("")
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_ALERT_RADIUS_M)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      abortRef.current?.abort()
      setResults([])
      setShowDropdown(false)
      setIsSearching(false)
      return
    }
    const requestId = ++requestIdRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSearching(true)
    try {
      const res = await fetch(
        `/api/mapbox/geocode?query=${encodeURIComponent(q)}&language=ja&country=jp&limit=5`,
        { signal: controller.signal },
      )
      if (!res.ok) throw new Error("Search failed")
      const data: unknown = await res.json()
      const parsed = Array.isArray(data)
        ? data.map(parseGeoFeature).filter((f): f is GeoResult => f !== null)
        : []
      if (requestId !== requestIdRef.current) return
      setResults(parsed)
      setShowDropdown(parsed.length > 0)
    } catch {
      if (controller.signal.aborted) return
      if (requestId !== requestIdRef.current) return
      setResults([])
      setShowDropdown(false)
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false)
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 350)
  }

  const handleSelectResult = (result: GeoResult) => {
    setQuery(result.name)
    setShowDropdown(false)
    onLocationPick([result.lon, result.lat])
  }

  const handleRadiusChange = (value: number) => {
    const resolved = resolveAlertRadius(value)
    setRadiusM(resolved)
    onRadiusChange?.(resolved)
  }

  const handleUseCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setImageError(null)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        const { longitude, latitude } = position.coords
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
          setQuery("現在地")
          onLocationPick([longitude, latitude])
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    const validation = await validateImageFile(file)
    if (!validation.ok) {
      setImageError(validation.reason ?? "画像を読み込めませんでした。")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setImageFile(file)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async () => {
    if (!selectedLocation) return
    await onSubmit({ memo: memo.trim(), radiusM, originalImageFile: imageFile })
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Revoke preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasLocation = Boolean(selectedLocation)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <UserX className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">不審者アラートを地図化</h2>
          <p className="text-xs text-gray-500">住所や場所を入れて、危険エリアをすぐに共有しましょう</p>
        </div>
      </div>

      {/* 住所/エリア検索 */}
      <div className="relative">
        <label className="mb-1 block text-xs font-medium text-gray-700">場所・住所</label>
        <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus-within:border-orange-400">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="例: ○○町、△△小学校 付近"
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          {isSearching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />}
        </div>

        {showDropdown && results.length > 0 && (
          <ul className="absolute top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            {results.map((r) => (
              <li key={`${r.name}-${r.lon.toFixed(6)}-${r.lat.toFixed(6)}`} className="border-b border-gray-100 last:border-b-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(r)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-orange-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="text-xs leading-snug text-gray-800">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            現在地を使う
          </button>
          <span className={`text-xs ${hasLocation ? "text-emerald-600" : "text-gray-400"}`}>
            {hasLocation ? "地点を選択済み（地図をタップして変更も可）" : "地図をタップしても選べます"}
          </span>
        </div>
      </div>

      {/* 一言メモ */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">一言メモ（任意）</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="例: 下校時間に声かけ事案。電話番号や個人名は書かないでください。"
          className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 placeholder:text-gray-400"
        />
      </div>

      {/* 半径選択 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">危険エリアの半径</label>
        <div className="grid grid-cols-4 gap-2">
          {ALERT_RADIUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleRadiusChange(option)}
              className={`rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
                radiusM === option
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-orange-300"
              }`}
            >
              {option >= 1000 ? `${option / 1000}km` : `${option}m`}
            </button>
          ))}
        </div>
      </div>

      {/* 写真添付 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">写真（任意）</label>
        {imagePreview ? (
          <div className="relative overflow-hidden rounded-xl border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="添付写真プレビュー" className="max-h-48 w-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="写真を削除"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600"
          >
            <ImagePlus className="h-4 w-4" />
            写真を選ぶ
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageChange}
        />
        {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
        <p className="mt-1 text-xs text-gray-400">
          写真を添付すると公開前に内容確認が入ります（顔・ナンバー・表札の写り込み防止のため）。
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
          キャンセル
        </Button>
        <Button
          className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
          onClick={handleSubmit}
          disabled={!hasLocation || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          地図にアラートを表示
        </Button>
      </div>
    </div>
  )
}
