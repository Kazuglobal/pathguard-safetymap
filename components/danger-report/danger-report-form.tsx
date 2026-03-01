"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import NextImage from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Upload, Loader2, Camera, ImageIcon, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import ImagePreviewDialog from "./image-preview-dialog"
import type { DangerReport } from "@/lib/types"
import { compressImage, fileToBase64 } from "@/lib/image-utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  promptCategories,
  getPromptById,
  type TargetAudience,
  type DisasterPrompt,
  defaultSituations,
  type DefaultSituation,
} from "@/lib/disaster-scenario-prompts"
import { useVlmAnalysis } from "@/hooks/use-vlm-analysis"
import { VlmAnalysisPanel } from "./vlm-analysis-panel"
import { useAccidentStats } from "@/hooks/use-accident-stats"
import AccidentStatsPanel, { AccidentStatsLoading } from "./accident-stats-panel"
import { enrichReportWithAccidents } from "@/lib/traffic-accident-data"

interface DangerReportFormProps {
  onSubmit: (data: DangerReportSubmitPayload) => Promise<{ reportId: string; imageUrl: string | null }>
  onCancel: () => void
  selectedLocation: [number, number] | null
  locationSource?: "manual" | "gps" | null
  isMobileFullscreen?: boolean
}

export type DangerReportSubmitPayload = Partial<DangerReport> & {
  originalImageFile?: File | null
  processedImageFiles?: File[]
}

type HazardBBox = {
  x?: number
  y?: number
  width?: number
  height?: number
}

type HazardItem = {
  type?: string
  confidence?: number
  bbox?: HazardBBox
}

type RiskAnalysisItem = {
  category: string
  risk: string
  measure: string
}

type GeneratedPromptsState = {
  vizPrompt?: string
  simulationPrompts?: { earthquake: string; typhoon: string; flood: string; fire: string }
  riskObservationTable?: string
}

const AUTO_GEN_DEBOUNCE_MS = 350
const REGEN_COOLDOWN_MS = 1500
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const readFileHeader = async (file: File, length: number) => {
  const buffer = await file.slice(0, length).arrayBuffer()
  return new Uint8Array(buffer)
}

const sniffImageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif"
  }
  return null
}

const validateImageFile = async (file: File) => {
  const header = await readFileHeader(file, 12)
  const sniffed = sniffImageMime(header)
  if (!sniffed || !ALLOWED_IMAGE_MIME_TYPES.has(sniffed)) {
    return {
      ok: false,
      reason: "対応していない画像形式です。JPEG/PNG/WebP/GIFのみ利用できます。",
    }
  }
  return { ok: true, mime: sniffed }
}

export default function DangerReportForm({ onSubmit, onCancel, selectedLocation, locationSource = null, isMobileFullscreen = false }: DangerReportFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dangerType, setDangerType] = useState<string>("traffic")
  const [dangerLevel, setDangerLevel] = useState<number>(3)
  // ���摜�֘A�̏��
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null)
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null)
  const originalFileInputRef = useRef<HTMLInputElement>(null)

  // ���H�摜�֘A�̏��
  const [processedImageFiles, setProcessedImageFiles] = useState<File[]>([])
  const [processedImagePreviews, setProcessedImagePreviews] = useState<string[]>([])
  const processedFileInputRef = useRef<HTMLInputElement>(null)

  const [activeImageTab, setActiveImageTab] = useState<string>("original")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const isGpsLocation = locationSource === "gps"
  const [isGpsLocationConfirmed, setIsGpsLocationConfirmed] = useState(false)

  useEffect(() => {
    if (isGpsLocation) {
      setIsGpsLocationConfirmed(false)
      return
    }
    setIsGpsLocationConfirmed(true)
  }, [isGpsLocation, selectedLocation?.[0], selectedLocation?.[1]])

  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisItem[] | null>(null)
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [autoGenError, setAutoGenError] = useState<string | null>(null)
  const lastAutoGenKey = useRef<string | null>(null)
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPromptsState | null>(null)
  const [lastHazards, setLastHazards] = useState<HazardItem[]>([])
  type Situation = 'viz' | 'earthquake' | 'typhoon' | 'flood' | 'fire'
  const [situation, setSituation] = useState<Situation>('viz')
  const [regenLoading, setRegenLoading] = useState(false)
  const autoGenRunIdRef = useRef(0)
  const lastRegenAtRef = useRef(0)
  const blobUrlRegistryRef = useRef<Set<string>>(new Set())

  // 防災用カスタムプロンプト関連の状態
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<TargetAudience>("children")
  const [selectedPromptId, setSelectedPromptId] = useState<string>("")
  const [showPromptDetails, setShowPromptDetails] = useState(false)
  // 手動解析トリガー（自動解析を無効化し、ボタンクリックで開始）
  const [manualAnalysisTriggered, setManualAnalysisTriggered] = useState(false)
  const [photoPickerConfig, setPhotoPickerConfig] = useState<{ open: boolean; target: "original" | "processed" }>({ open: false, target: "original" })

  // VLM Analysis Hook
  const {
    status: vlmStatus,
    result: vlmResult,
    error: vlmError,
    startAnalysis: startVlmAnalysis,
    retry: retryVlmAnalysis,
    reset: resetVlmAnalysis,
  } = useVlmAnalysis()

  // Accident Statistics Hook
  const {
    stats: accidentStats,
    status: accidentStatsStatus,
    fetchStats: fetchAccidentStats,
    reset: resetAccidentStats,
  } = useAccidentStats()

  // Fetch accident stats when location changes
  useEffect(() => {
    resetAccidentStats()
    if (!selectedLocation) return
    fetchAccidentStats({
      latitude: selectedLocation[1],
      longitude: selectedLocation[0],
    })
  }, [selectedLocation?.[0], selectedLocation?.[1], fetchAccidentStats, resetAccidentStats])

  // Store submitted report info for VLM analysis
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string | null>(null)

  const registerBlobUrl = (url: string) => {
    if (url.startsWith("blob:")) {
      blobUrlRegistryRef.current.add(url)
    }
  }

  const revokeBlobUrl = (url: string | null | undefined) => {
    if (!url || !url.startsWith("blob:")) return
    if (blobUrlRegistryRef.current.has(url)) {
      URL.revokeObjectURL(url)
      blobUrlRegistryRef.current.delete(url)
    }
  }

  useEffect(() => {
    return () => {
      blobUrlRegistryRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlRegistryRef.current.clear()
    }
  }, [])
  // 元画像が選択されたら自動で処理 API を呼び出す -> ★★★ 削除またはコメントアウト ★★★
  /*
  useEffect(() => {
   if (!originalImageFile) return
    
    const runAnalysis = async () => {
     try {
     const fd = new FormData()
    fd.append("file", originalImageFile)
    
    const res = await fetch("/api/image/process", { method: "POST", body: fd })
    if (!res.ok) {
    const text = await res.text()
    console.error("[runAnalysis] status=", res.status, "body=", text)
    throw new Error(`画像処理APIエラー (status=${res.status})`)
    }
    
     const data = await res.json()
    setRiskAnalysis(data.analysis?.risks || null)
    if (data.processedUrl) {
       setProcessedImagePreviews(prev => [...prev, data.processedUrl])
       setActiveImageTab("processed")  
    }
    } catch (err) {
    console.error(err)
    toast({
     title: "画像解析エラー",
     description: "画像の自動解析に失敗しました",
     variant: "destructive",
    })
    }
    }
    
    runAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageFile])
  */

  // カメラアクセスハンドラー - モバイルではcapture属性でカメラを直接起動
  const handleCameraAccess = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    setCameraError(null)

    if (!inputRef.current) return

    // capture属性を設定してカメラを起動
    // モバイルブラウザでは capture="environment" で背面カメラが起動する
    inputRef.current.setAttribute('capture', 'environment')
    inputRef.current.click()
  }

  // 画像選択ハンドラー（元画像）
  const handleOriginalImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルサイズチェック (10MB以下)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "エラー",
        description: "画像サイズは10MB以下にしてください。",
        variant: "destructive",
      })
      if (originalFileInputRef.current) {
        originalFileInputRef.current.value = ""
      }
      return
    }

    // 画像タイプチェック（MIMEスプーフィング対策）
    let validation
    try {
      validation = await validateImageFile(file)
    } catch {
      toast({
        title: "エラー",
        description: "画像の検証に失敗しました。別の画像をお試しください。",
        variant: "destructive",
      })
      if (originalFileInputRef.current) {
        originalFileInputRef.current.value = ""
      }
      return
    }
    if (!validation.ok) {
      toast({
        title: "エラー",
        description: validation.reason || "画像ファイルを選択してください。",
        variant: "destructive",
      })
      if (originalFileInputRef.current) {
        originalFileInputRef.current.value = ""
      }
      return
    }

    setOriginalImageFile(file)
    setCameraError(null) // エラーをクリア

    // プレビュー用のURLを作成
    const reader = new FileReader()
    reader.onload = (e) => {
      setOriginalImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Utilities for auto-generation
  const dataUrlToFile = async (dataUrl: string, filename: string, signal?: AbortSignal): Promise<File> => {
    const res = await fetch(dataUrl, { signal })
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/png' })
  }

  // Convert a data URL (or any fetchable URL) to a lightweight blob URL for preview.
  // Blob URLs are short reference strings (~60 chars) vs multi-MB base64 data URLs,
  // drastically reducing React state size and re-render cost.
  const dataUrlToBlobUrl = async (dataUrl: string, signal?: AbortSignal): Promise<string> => {
    const res = await fetch(dataUrl, { signal })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    registerBlobUrl(url)
    return url
  }

  // Convert a data URL to both a File and a blob URL in a single fetch,
  // avoiding redundant memory copies.
  const dataUrlToFileAndBlobUrl = async (
    dataUrl: string,
    filename: string,
    signal?: AbortSignal,
  ): Promise<{ file: File; blobUrl: string }> => {
    const res = await fetch(dataUrl, { signal })
    const blob = await res.blob()
    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    const blobUrl = URL.createObjectURL(blob)
    registerBlobUrl(blobUrl)
    return { file, blobUrl }
  }

  const buildRegionConstraints = (hazards: HazardItem[]): string => {
    if (!Array.isArray(hazards) || hazards.length === 0) return ''
    const lines: string[] = []
    lines.push('Region constraints (normalized coordinates 0-1):')
    hazards.forEach((h, i) => {
      const b = h?.bbox
      if (b && typeof b === 'object') {
        const x = Number(b.x ?? 0).toFixed(3)
        const y = Number(b.y ?? 0).toFixed(3)
        const w = Number(b.width ?? 0.25).toFixed(3)
        const hgt = Number(b.height ?? 0.2).toFixed(3)
        lines.push(`${i + 1}) bbox=[${x}, ${y}, ${w}, ${hgt}] label='${h?.type ?? 'hazard'}'`)
      }
    })
    if (lines.length <= 1) return ''
    lines.push('Place overlays/icons near these boxes while keeping the scene photorealistic and consistent.')
    return lines.join(' ')
  }

  const drawOverlayFromHazards = async (imageFile: File, hazards: HazardItem[]): Promise<string> => {
    const imgUrl = URL.createObjectURL(imageFile)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = imgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const colorFor = (t?: string) => {
        const s = (t || '').toLowerCase()
        if (s.includes('冠水') || s.includes('flood')) return 'rgba(37, 99, 235, 0.28)'
        if (s.includes('延焼') || s.includes('fire') || s.includes('炎')) return 'rgba(234, 88, 12, 0.28)'
        if (s.includes('電柱') || s.includes('pole') || s.includes('倒壊') || s.includes('fence')) return 'rgba(220, 38, 38, 0.28)'
        return 'rgba(234, 179, 8, 0.25)'
      }
      const pad = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.01))
      const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.022))
      ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI`
      ctx.textBaseline = 'top'
      let idx = 0
      const rows = Math.max(1, Math.ceil(hazards.length / 2))
      for (const h of hazards) {
        const anyH = h
        let x = 0.05, y = 0.05, w = 0.4, hh = 0.25
        if (anyH?.bbox && typeof anyH.bbox === 'object') {
          x = Math.max(0, Math.min(1, Number(anyH.bbox.x ?? 0)))
          y = Math.max(0, Math.min(1, Number(anyH.bbox.y ?? 0)))
          w = Math.max(0.05, Math.min(1, Number(anyH.bbox.width ?? 0.3)))
          hh = Math.max(0.05, Math.min(1, Number(anyH.bbox.height ?? 0.2)))
        } else {
          const col = idx % 2
          const row = Math.floor(idx / 2)
          const cellW = 0.45
          const cellH = 1 / (rows + 1)
          x = 0.05 + col * (cellW + 0.05)
          y = 0.05 + row * (cellH)
          w = cellW
          hh = cellH * 0.8
        }
        idx++
        const rx = Math.round(x * canvas.width)
        const ry = Math.round(y * canvas.height)
        const rw = Math.round(w * canvas.width)
        const rh = Math.round(hh * canvas.height)
        ctx.fillStyle = colorFor(anyH.type)
        ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004))
        ctx.strokeRect(rx, ry, rw, rh)
        const label = `${anyH.type || '危険'} / ${Math.round((anyH.confidence ?? 0.5) * 100)}%`
        const textW = ctx.measureText(label).width
        const lbPadX = Math.round(fontSize * 0.5)
        const lbPadY = Math.round(fontSize * 0.35)
        const lbW = Math.round(textW + lbPadX * 2)
        const lbH = Math.round(fontSize + lbPadY * 2)
        const lbX = rx + pad
        const lbY = Math.max(pad, ry + pad)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(lbX, lbY, lbW, lbH)
        ctx.fillStyle = 'white'
        ctx.fillText(label, lbX + lbPadX, lbY + lbPadY)
      }
      return canvas.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  const simulateVariant = async (imageFile: File, kind: 'flood' | 'fire' | 'typhoon' | 'earthquake'): Promise<string> => {
    const imgUrl = URL.createObjectURL(imageFile)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = imgUrl
      })
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      if (kind === 'flood') {
        const waterH = Math.round(c.height * 0.2)
        const y = c.height - waterH
        const grad = ctx.createLinearGradient(0, y, 0, c.height)
        grad.addColorStop(0, 'rgba(59,130,246,0.25)')
        grad.addColorStop(1, 'rgba(37,99,235,0.45)')
        ctx.fillStyle = grad
        ctx.fillRect(0, y, c.width, waterH)
      } else if (kind === 'fire') {
        const grad = ctx.createRadialGradient(c.width*0.7, c.height*0.7, 10, c.width*0.7, c.height*0.7, c.height*0.7)
        grad.addColorStop(0, 'rgba(234,88,12,0.45)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0,0,c.width,c.height)
        // light smoke
        ctx.fillStyle = 'rgba(55,65,81,0.18)'
        for(let i=0;i<6;i++){
          const rx=Math.random()*c.width, ry=Math.random()*c.height
          const rw=80+Math.random()*200, rh=40+Math.random()*120
          ctx.beginPath(); ctx.ellipse(rx,ry,rw,rh,0,0,Math.PI*2); ctx.fill()
        }
      } else if (kind === 'typhoon') {
        // wind streaks
        ctx.strokeStyle='rgba(99,102,241,0.35)'
        ctx.lineWidth = Math.max(2, Math.round(Math.min(c.width,c.height)*0.004))
        for(let y=20;y<c.height;y+=Math.round(c.height/12)){
          ctx.beginPath(); ctx.moveTo(10,y); ctx.quadraticCurveTo(c.width*0.4,y-10,c.width-10,y+5); ctx.stroke()
        }
      } else if (kind === 'earthquake') {
        // cracks
        ctx.strokeStyle='rgba(0,0,0,0.5)'
        ctx.lineWidth = Math.max(2, Math.round(Math.min(c.width,c.height)*0.005))
        const cx=c.width*0.5, cy=c.height*0.7
        for(let i=0;i<6;i++){
          const angle = (Math.PI*2*i)/6
          const len = Math.min(c.width,c.height)*0.35
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(angle)*len, cy+Math.sin(angle)*len); ctx.stroke()
        }
      }
      return c.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  // Generate processed images when user clicks the analysis button (manual trigger)
  useEffect(() => {
    if (!originalImageFile) return
    // 手動トリガーが押されていない場合は実行しない
    if (!manualAnalysisTriggered) return
    const key = `${originalImageFile.name}:${originalImageFile.size}:${originalImageFile.lastModified}`
    if (lastAutoGenKey.current === key) {
      // 同じ画像で既に解析済みの場合はトリガーをリセットしてスキップ
      setManualAnalysisTriggered(false)
      return
    }
    lastAutoGenKey.current = key
    // トリガーをリセット
    setManualAnalysisTriggered(false)

    const abortController = new AbortController()
    const runId = ++autoGenRunIdRef.current
    const isActive = () => runId === autoGenRunIdRef.current && !abortController.signal.aborted

    const run = async () => {
      if (!isActive()) return
      setAutoGenError(null)
      setAutoGenLoading(true)
      try {
        // 1) analyze via API (Gemini) to get hazards (and optional bbox)
        const base64 = await fileToBase64(await compressImage(originalImageFile))
        if (!isActive()) return
        const res = await fetch('/api/hazard-game/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
          signal: abortController.signal,
        })
        let hazards: HazardItem[] = []
        if (res.ok) {
          const data = await res.json()
          hazards = Array.isArray(data.hazards) ? data.hazards : []
          if (isActive()) setLastHazards(hazards)
        } else if (isActive()) {
          console.warn('hazard analysis failed, proceeding with heuristics')
        }
        if (!isActive()) return

        // 2) generate prompts (risk observation + viz + simulations)
        let prLocal: {
          vizPrompt?: string
          simulationPrompts?: { earthquake: string; typhoon: string; flood: string; fire: string }
          riskObservation?: { tableMarkdown?: string }
        } | null = null
        try {
          const pRes = await fetch('/api/gemini/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
            signal: abortController.signal,
          })
          if (pRes.ok) {
            const pjson = await pRes.json()
            const pr = pjson?.prompts
            if (pr && isActive()) {
              setGeneratedPrompts({
                vizPrompt: pr.vizPrompt,
                simulationPrompts: pr.simulationPrompts,
                riskObservationTable: pr.riskObservation?.tableMarkdown,
              })
              prLocal = pr
            }
          } else if (isActive()) {
            console.warn('generate-prompts failed', await pRes.text())
          }
        } catch (e) {
          if (isActive()) console.warn('generate-prompts error', e)
        }
        if (!isActive()) return

        // 3) visualization overlay (local fallback always available)
        // Convert data URLs to lightweight blob URLs to avoid storing multi-MB
        // base64 strings in React state, which causes UI freezes on re-render.
        const overlayDataUrl = await drawOverlayFromHazards(originalImageFile, hazards)
        if (!isActive()) return
        const overlay = await dataUrlToFileAndBlobUrl(overlayDataUrl, 'overlay.png', abortController.signal)
        if (!isActive()) return

        // 4) simple local simulations (flood/fire/typhoon/earthquake)
        const [floodDataUrl, fireDataUrl, typhoonDataUrl, quakeDataUrl] = await Promise.all([
          simulateVariant(originalImageFile, 'flood'),
          simulateVariant(originalImageFile, 'fire'),
          simulateVariant(originalImageFile, 'typhoon'),
          simulateVariant(originalImageFile, 'earthquake'),
        ])
        if (!isActive()) return
        const simNames = ['flood', 'fire', 'typhoon', 'earthquake'] as const
        const simDataUrls = [floodDataUrl, fireDataUrl, typhoonDataUrl, quakeDataUrl]
        const simResults = await Promise.all(
          simDataUrls.map((url, i) => dataUrlToFileAndBlobUrl(url, `${simNames[i]}.png`, abortController.signal))
        )
        // Batch a single state update for all local results (overlay + 4 sims)
        if (isActive()) {
          const localFiles = [overlay.file, ...simResults.map(r => r.file)]
          const localPreviews = [overlay.blobUrl, ...simResults.map(r => r.blobUrl)]
          setProcessedImageFiles(prev => [...prev, ...localFiles])
          setProcessedImagePreviews(prev => [...prev, ...localPreviews])
        }
        if (!isActive()) return
        // Yield to main thread so the UI stays responsive
        await new Promise(r => setTimeout(r, 0))

        // 5) Standard scenario image-to-image generation using generated prompts
        try {
          const compressedForGen = await compressImage(originalImageFile, { targetMaxSize: 1.5 * 1024 * 1024 })
          const fd = new FormData()
          fd.append('image', compressedForGen)
          const baseViz =
            prLocal?.vizPrompt ||
            generatedPrompts?.vizPrompt ||
            "Create one 2048x2048 photorealistic hazard-communication infographic based on the uploaded Japanese suburban school-route photo. Preserve the original scene geometry exactly: same camera position, lens, horizon, perspective, building outlines, road markings, and daylight color temperature. Do not alter existing objects and do not add new buildings, people, or vehicles. Add overlays only. Mark four potential hazards with clean civic-design callouts anchored to real locations: (1) fence instability: semi-transparent red polygon + warning triangles + Japanese label \"フェンス倒壊注意\"; (2) utility pole failure risk: red circle/arrow + Japanese label \"電柱倒壊注意\"; (3) flooding-prone low spot: semi-transparent blue wash + droplet icons + Japanese label \"冠水注意\"; (4) fire spread exposure: semi-transparent amber haze + flame icons + Japanese label \"延焼注意\". Add numbered markers 1-4 with short leader lines and include a compact Japanese legend at bottom-left: \"凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意\". Style: realistic, HDR, sharp focus, balanced contrast, mobile-readable annotations. No graphic destruction, no gore, no extra text beyond the specified Japanese labels and legend, no watermark, and no model names."
          const englishPrompt = `${baseViz}\n${buildRegionConstraints(hazards)}`
          fd.append('prompt', englishPrompt)
          fd.append('generationMode', 'standard')
          const genRes = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd, signal: abortController.signal })
          if (genRes.ok) {
            const gen = await genRes.json()
            const imgs = Array.isArray(gen.images) ? gen.images : []
            const ok = imgs.slice(0, 2)
            if (ok.length > 0 && isActive()) {
              // Convert API data URLs to blob URLs to keep state lightweight
              const converted = await Promise.all(
                ok.map((im: { dataUrl: string }, i: number) =>
                  dataUrlToFileAndBlobUrl(im.dataUrl, `nanobanana-${i}.png`, abortController.signal)
                )
              )
              if (isActive()) {
                setProcessedImageFiles(prev => [...prev, ...converted.map(c => c.file)])
                setProcessedImagePreviews(prev => [...prev, ...converted.map(c => c.blobUrl)])
              }
            } else if (gen.warning && isActive()) {
              setAutoGenError(gen.warning)
            } else if (isActive()) {
              setAutoGenError('画像生成に失敗しました。')
            }
          } else if (isActive()) {
            const t = await genRes.text()
            console.warn('gemini generate-image failed', genRes.status, t)
            setAutoGenError(`AI画像生成に失敗しました (${genRes.status})`)
          }
        } catch (e) {
          if (isActive()) console.warn('nanobanana generation skipped due to error', e)
        }
        if (!isActive()) return

        // 6) Post-disaster simulation prompts → AI images
        const simsLocal = prLocal?.simulationPrompts || generatedPrompts?.simulationPrompts
        if (simsLocal) {
          try {
            const compressedForSim = await compressImage(originalImageFile, { targetMaxSize: 1.5 * 1024 * 1024 })
            const make = async (prompt: string, suffix: string) => {
              const fd = new FormData()
              fd.append('image', compressedForSim)
              fd.append('prompt', prompt)
              fd.append('generationMode', 'standard')
              const r = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd, signal: abortController.signal })
              if (!r.ok) {
                const txt = await r.text()
                throw new Error(`image generation failed: ${r.status} ${r.statusText} - ${txt}`)
              }
              const j = await r.json()
              const im = Array.isArray(j.images) && j.images[0] ? j.images[0] : null
              if (!im) {
                if (j.warning && isActive()) setAutoGenError(j.warning)
                return null
              }
              const f = await dataUrlToFile(im.dataUrl, `nanobanana-${suffix}.png`, abortController.signal)
              return { file: f, url: im.dataUrl }
            }
            const sims = simsLocal
            // Run disaster simulations with limited concurrency (2 at a time)
            // to avoid overwhelming the browser with large concurrent payloads
            const simKeys = ['earthquake', 'typhoon', 'flood', 'fire'] as const
            const simPrompts = [sims.earthquake, sims.typhoon, sims.flood, sims.fire]
            const simResultsBatch: { file: File; blobUrl: string }[] = []
            for (let i = 0; i < simKeys.length; i += 2) {
              const batch = simPrompts.slice(i, i + 2).map((p, j) => make(p, simKeys[i + j]))
              const batchResults = await Promise.all(batch)
              for (const r of batchResults) {
                if (!r) continue
                // Convert data URL to blob URL
                const blobUrl = await dataUrlToBlobUrl(r.url, abortController.signal)
                simResultsBatch.push({ file: r.file, blobUrl })
              }
              if (!isActive()) break
              // Yield between batches
              await new Promise(resolve => setTimeout(resolve, 0))
            }
            if (simResultsBatch.length && isActive()) {
              setProcessedImageFiles(prev => [...prev, ...simResultsBatch.map(item => item.file)])
              setProcessedImagePreviews(prev => [...prev, ...simResultsBatch.map(item => item.blobUrl)])
            }
            if (isActive()) setActiveImageTab('processed')
          } catch (e) {
            if (isActive()) {
              console.error('auto-generation failed', e)
              const rawMsg = e instanceof Error ? e.message : 'Unknown error occurred.'
              const displayMsg = /failed to fetch|network/i.test(rawMsg)
                ? 'ネットワークエラーが発生しました。インターネット接続を確認して再度お試しください。'
                : rawMsg
              setAutoGenError(displayMsg)
            }
          }
        }
      } catch (error) {
        if (isActive()) {
          console.error('Error in auto-generation:', error)
          const rawMsg = error instanceof Error ? error.message : 'Unknown error occurred.'
          const displayMsg = /failed to fetch|network/i.test(rawMsg)
            ? 'ネットワークエラーが発生しました。インターネット接続を確認して再度お試しください。'
            : rawMsg
          setAutoGenError(displayMsg)
        }
      } finally {
        if (isActive()) setAutoGenLoading(false)
      }
    }

    const timeoutId = window.setTimeout(() => {
      void run()
    }, AUTO_GEN_DEBOUNCE_MS)

    return () => {
      abortController.abort()
      window.clearTimeout(timeoutId)
      setAutoGenLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageFile, manualAnalysisTriggered])

  // On-demand regenerate using selected situation or custom prompt
  const regenerateSituation = async () => {
    if (!originalImageFile) return

    try {
      const now = Date.now()
      if (now - lastRegenAtRef.current < REGEN_COOLDOWN_MS) {
        toast({
          title: "少し待ってください",
          description: "連続生成を抑制しています。数秒後に再試行してください。",
          variant: "destructive",
        })
        return
      }
      lastRegenAtRef.current = now
      setRegenLoading(true)

      let prompt = ''

      // カスタムプロンプトが選択されている場合
      if (useCustomPrompt && selectedPromptId) {
        const customPrompt = getPromptById(selectedPromptId)
        if (customPrompt) {
          prompt = customPrompt.prompt
        } else {
          setAutoGenError('選択されたプロンプトが見つかりません。')
          return
        }
      } else {
        // 従来のシチュエーション選択
        let pr = generatedPrompts

        if (!pr) {
          const base64 = await fileToBase64(await compressImage(originalImageFile))
          const pRes = await fetch('/api/gemini/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          })
          if (pRes.ok) {
            const pjson = await pRes.json()
            const prompts = pjson?.prompts as
              | {
                  vizPrompt?: string
                  simulationPrompts?: { earthquake: string; typhoon: string; flood: string; fire: string }
                  riskObservation?: { tableMarkdown?: string }
                }
              | undefined
            if (prompts) {
              pr = {
                vizPrompt: prompts.vizPrompt,
                simulationPrompts: prompts.simulationPrompts,
                riskObservationTable: prompts.riskObservation?.tableMarkdown,
              }
              setGeneratedPrompts(pr)
            }
          }
        }

        if (situation === 'viz') prompt = pr?.vizPrompt || ''
        else if (situation === 'earthquake') prompt = pr?.simulationPrompts?.earthquake || ''
        else if (situation === 'typhoon') prompt = pr?.simulationPrompts?.typhoon || ''
        else if (situation === 'flood') prompt = pr?.simulationPrompts?.flood || ''
        else if (situation === 'fire') prompt = pr?.simulationPrompts?.fire || ''
      }

      if (!prompt) {
        setAutoGenError('プロンプトの取得に失敗しました。もう一度お試しください。')
        return
      }

      const compressed = await compressImage(originalImageFile, { targetMaxSize: 1.5 * 1024 * 1024 })
      const fd = new FormData()
      fd.append('image', compressed)
      const withRegions = (!useCustomPrompt && situation === 'viz') ? `${prompt}\n${buildRegionConstraints(lastHazards)}` : prompt
      fd.append('prompt', withRegions)
      fd.append('generationMode', useCustomPrompt ? 'disaster' : 'standard')
      const res = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd })
      if (!res.ok) {
        const errorBody = await res.text()
        const detail = errorBody ? `: ${errorBody.slice(0, 200)}` : ''
        throw new Error(`画像生成に失敗しました (${res.status})${detail}`)
      }

      const json = await res.json()
      const imgs = Array.isArray(json.images) ? (json.images as { dataUrl: string }[]) : []
      const ok = imgs.slice(0, 2)

      if (ok.length) {
        const suffix = useCustomPrompt && selectedPromptId ? selectedPromptId : situation
        // Convert API data URLs to blob URLs to prevent state bloat
        const converted = await Promise.all(
          ok.map((im, idx: number) => dataUrlToFileAndBlobUrl(im.dataUrl, `regen-${suffix}-${idx}.png`)),
        )
        setProcessedImageFiles(prev => [...prev, ...converted.map(c => c.file)])
        setProcessedImagePreviews(prev => [...prev, ...converted.map(c => c.blobUrl)])
      } else {
        setAutoGenError(json.warning || '画像生成に失敗しました。')
      }

      setActiveImageTab('processed')
    } catch (error) {
      setAutoGenError(error instanceof Error ? error.message : '不明なエラーが発生しました。')
    } finally {
      setRegenLoading(false)
    }
  }

  // カテゴリ変更時にプロンプトIDをリセット
  const handleCategoryChange = (category: TargetAudience) => {
    setSelectedCategory(category)
    setSelectedPromptId("")
  }

  // 選択されたプロンプトの情報を取得
  const getSelectedPromptInfo = (): DisasterPrompt | undefined => {
    if (!selectedPromptId) return undefined
    return getPromptById(selectedPromptId)
  }
  const handleProcessedImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // ファイルサイズとタイプの検証
    const validations = await Promise.all(
      files.map(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "エラー",
            description: `${file.name}のサイズが10MBを超えています。`,
            variant: "destructive",
          })
          return { ok: false, file }
        }
        let validation
        try {
          validation = await validateImageFile(file)
        } catch {
          toast({
            title: "エラー",
            description: "画像の検証に失敗しました。別の画像をお試しください。",
            variant: "destructive",
          })
          return { ok: false, file }
        }
        if (!validation.ok) {
          toast({
            title: "エラー",
            description: validation.reason || `${file.name}は画像ファイルではありません。`,
            variant: "destructive",
          })
          return { ok: false, file }
        }
        return { ok: true, file }
      })
    )
    const validFiles = validations.filter((entry) => entry.ok).map((entry) => entry.file)

    if (validFiles.length > 0) {
      // プレビューURLを生成して配列に追加
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file))
      newPreviews.forEach(registerBlobUrl)
      setProcessedImageFiles((prev) => [...prev, ...validFiles])
      setProcessedImagePreviews((prev) => [...prev, ...newPreviews])
      // 手動選択時も自動で「加工画像」タブへ切り替え
      setActiveImageTab("processed")
      setCameraError(null) // エラーをクリア
    }
  }

  // フォーム送信ハンドラー
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLocation) {
      toast({
        title: "エラー",
        description: "地図上で位置を選択してください。",
        variant: "destructive",
      })
      return
    }

    // 入力検証
    if (!title.trim()) {
      toast({
        title: "エラー",
        description: "タイトルを入力してください。",
        variant: "destructive",
      })
      return
    }

    if (isGpsLocation && !isGpsLocationConfirmed) {
      toast({
        title: "確認が必要です",
        description: "現在地の確認チェックを入れてから送信してください。",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      // 送信前に圧縮して親へ渡す（実アップロードは API 側で実施）
      let compressedProcessedFiles: File[] = []
      if (processedImageFiles.length > 0) {
        compressedProcessedFiles = await Promise.all(
          processedImageFiles.map((file) =>
            compressImage(file, { maxDimension: 2048, jpegQuality: 0.82, targetMaxSize: 4.5 * 1024 * 1024 })
          )
        )
      }

      let compressedOriginalFile: File | null = null
      if (originalImageFile) {
        compressedOriginalFile = await compressImage(originalImageFile, {
          maxDimension: 2048,
          jpegQuality: 0.85,
          targetMaxSize: 4.5 * 1024 * 1024,
        })
      }

      const reportData: DangerReportSubmitPayload = {
        title,
        description: description || null,
        danger_type: dangerType,
        danger_level: dangerLevel,
        latitude: selectedLocation[1],
        longitude: selectedLocation[0],
        status: "published",
      }
      if (compressedOriginalFile) {
        reportData.originalImageFile = compressedOriginalFile
      }
      if (compressedProcessedFiles.length > 0) {
        reportData.processedImageFiles = compressedProcessedFiles
      }

      // 親コンポーネントの送信ハンドラーを呼び出し、report IDとimage URLを取得
      const result = await onSubmit(reportData)

      // Validate result before using for VLM analysis
      if (result?.reportId && result?.imageUrl) {
        // Store report metadata for VLM analysis
        setSubmittedReportId(result.reportId)
        setSubmittedImageUrl(result.imageUrl)

        // Trigger VLM analysis with validated data
        const additionalContext = `${title}${description ? ` - ${description}` : ""}`
        startVlmAnalysis({
          reportId: result.reportId,
          imageUrl: result.imageUrl,
          additionalContext,
        }).catch((err) => {
          console.warn("VLM分析は失敗しましたが、レポートは保存されています:", err)
        })
      }

      // Enrich report with accident statistics (fire-and-forget)
      // Call library function directly to avoid mutating hook state post-submit
      if (result?.reportId) {
        enrichReportWithAccidents(result.reportId).catch((err) => {
          console.warn("事故統計の保存に失敗:", err)
        })
      }
    } catch (error) {
      console.error("Error submitting report:", error)
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      toast({
        title: "エラー",
        description: `報告の送信中にエラーが発生しました: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = !!selectedLocation && (!isGpsLocation || isGpsLocationConfirmed)
  const showVlmPanel = vlmStatus !== "idle" || submittedReportId

  // 画像削除ハンドラー（元画像）
  const handleRemoveOriginalImage = () => {
    if (window.confirm("この画像を削除してもよろしいですか？")) {
      setOriginalImageFile(null)
      setOriginalImagePreview(null)
      if (originalFileInputRef.current) {
        originalFileInputRef.current.value = ""
      }
      toast({
        title: "画像を削除しました",
        description: "元画像が削除されました。",
      })
    }
  }

  // 画像削除ハンドラー（加工画像）
  const handleRemoveProcessedImage = (index: number) => {
    if (window.confirm("この加工画像を削除してもよろしいですか？")) {
      const targetUrl = processedImagePreviews[index]
      revokeBlobUrl(targetUrl)
      setProcessedImageFiles((prev) => prev.filter((_, i) => i !== index))
      setProcessedImagePreviews((prev) => prev.filter((_, i) => i !== index))
      if (processedFileInputRef.current) {
        processedFileInputRef.current.value = ""
      }
      toast({
        title: "画像を削除しました",
        description: "加工画像が削除されました。",
      })
    }
  }


  // 画像プレビュー表示
  const handleShowPreview = (imageUrl: string | null) => {
    if (imageUrl) {
      setPreviewImage(imageUrl)
      setIsPreviewOpen(true)
    }
  }

  // 危険度レベル変更ハンドラー
  const handleDangerLevelChange = (value: string) => {
    setDangerLevel(Number.parseInt(value, 10))
  }

  return (
    <div className={isMobileFullscreen ? "px-4 py-2" : "p-3"}>
      {/* ヘッダー - モバイルフルスクリーン時は親で表示するため非表示 */}
      {!isMobileFullscreen && (
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">危険箇所の報告</h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className={isMobileFullscreen ? "space-y-4" : "space-y-3"}>
        <div className="space-y-2">
          <Label htmlFor="title">タイトル</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="危険箇所の名前や特徴"
            maxLength={120}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">詳細説明（任意）</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="危険箇所の詳細な説明や注意点"
            className="resize-none"
            maxLength={1000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="danger_type">危険タイプ</Label>
          <Select value={dangerType} onValueChange={setDangerType}>
            <SelectTrigger id="danger_type">
              <SelectValue placeholder="危険タイプを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="traffic">交通危険</SelectItem>
              <SelectItem value="crime">犯罪危険</SelectItem>
              <SelectItem value="disaster">災害危険</SelectItem>
              <SelectItem value="other">その他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="danger_level">危険度（レベル {dangerLevel}）</Label>
          <Select value={dangerLevel.toString()} onValueChange={handleDangerLevelChange}>
            <SelectTrigger id="danger_level">
              <SelectValue placeholder="危険度を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">レベル1（軽度）</SelectItem>
              <SelectItem value="2">レベル2</SelectItem>
              <SelectItem value="3">レベル3（中度）</SelectItem>
              <SelectItem value="4">レベル4</SelectItem>
              <SelectItem value="5">レベル5（重度）</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">1: 軽度 - 5: 重大</p>
        </div>

        {selectedLocation && accidentStatsStatus !== 'idle' && (
          <div className="mt-4 border-t pt-4">
            {accidentStatsStatus === 'loading' && <AccidentStatsLoading />}
            {accidentStatsStatus === 'error' && (
              <p className="text-xs text-amber-700">事故統計の取得に失敗しました（報告には影響しません）</p>
            )}
            {accidentStatsStatus === 'loaded' && accidentStats && (
              <AccidentStatsPanel stats={accidentStats} mode="compact" />
            )}
          </div>
        )}

        {/* モバイルでは上部に表示して、長いフォームをスクロールせずに結果を確認しやすくする */}
        {isMobileFullscreen && showVlmPanel && (
          <VlmAnalysisPanel
            status={vlmStatus}
            result={vlmResult}
            error={vlmError}
            onRetry={retryVlmAnalysis}
          />
        )}

        <div className="space-y-2">
          <Label>画像（任意）</Label>
          <Tabs value={activeImageTab} onValueChange={setActiveImageTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="original">元画像</TabsTrigger>
              <TabsTrigger value="processed">加工画像</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="mt-2">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (originalFileInputRef.current) {
                        originalFileInputRef.current.removeAttribute('capture');
                        originalFileInputRef.current.click();
                      }
                    }}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    ギャラリー
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleCameraAccess(originalFileInputRef)}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    📸 カメラ撮影
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOriginalImageSelect}
                    className="hidden"
                    ref={originalFileInputRef}
                  />
                </div>

                {cameraError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{cameraError}</p>
                    <p className="text-xs text-red-500 mt-1">ファイルから選択することもできます</p>
                  </div>
                )}

                {originalImagePreview ? (
                  <>
                    <div className="relative mt-2 border rounded-md overflow-hidden group">
                      <div className="relative w-full h-32 cursor-pointer" onClick={() => handleShowPreview(originalImagePreview)}>
                        <NextImage
                          src={originalImagePreview || "/placeholder.svg?height=200&width=400"}
                          alt="選択された元画像"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-90 hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveOriginalImage()
                        }}
                        title="画像を削除"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* 解析開始ボタン */}
                    <Button
                      type="button"
                      variant="default"
                      className="mt-2 w-full min-h-[48px] touch-manipulation bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      onClick={() => {
                        lastAutoGenKey.current = null // 再解析を許可するためにキーをリセット
                        setManualAnalysisTriggered(true)
                        setActiveImageTab('processed')
                      }}
                      disabled={autoGenLoading}
                    >
                      {autoGenLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          解析中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          画像を解析して可視化
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32 bg-gray-100 rounded-md">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-1">元画像がありません</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="processed" className="mt-2">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (processedFileInputRef.current) {
                        processedFileInputRef.current.removeAttribute('capture');
                        processedFileInputRef.current.click();
                      }
                    }}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    ギャラリー
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleCameraAccess(processedFileInputRef)}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    📸 カメラ撮影
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProcessedImageSelect}
                    className="hidden"
                    ref={processedFileInputRef}
                    multiple
                  />
                </div>

                {cameraError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{cameraError}</p>
                    <p className="text-xs text-red-500 mt-1">ファイルから選択することもできます</p>
                  </div>
                )}

                {/* Situation control */}
                <div className="mt-3 p-3 border rounded-md bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">生成モード:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          !useCustomPrompt
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setUseCustomPrompt(false)}
                      >
                        標準シナリオ
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          useCustomPrompt
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setUseCustomPrompt(true)}
                      >
                        防災用プロンプト
                      </button>
                    </div>
                  </div>

                  {!useCustomPrompt ? (
                    // 従来のシチュエーション選択
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm text-gray-700">シチュエーション:</label>
                      <select
                        className="border rounded px-2 py-1 text-sm flex-1 min-w-[140px]"
                        value={situation}
                        onChange={(e) => setSituation(e.target.value as Situation)}
                      >
                        {defaultSituations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    // 防災用カスタムプロンプト選択
                    <div className="space-y-2">
                      {/* カテゴリ選択 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-sm text-gray-700">対象:</label>
                        <div className="flex gap-1 flex-wrap">
                          {promptCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              className={`px-2 py-1 text-xs rounded border transition-colors ${
                                selectedCategory === category.id
                                  ? 'bg-green-100 text-green-800 border-green-400'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                              }`}
                              onClick={() => handleCategoryChange(category.id)}
                            >
                              {category.icon} {category.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* プロンプト選択 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-sm text-gray-700">プロンプト:</label>
                        <select
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-[180px]"
                          value={selectedPromptId}
                          onChange={(e) => setSelectedPromptId(e.target.value)}
                        >
                          <option value="">-- 選択してください --</option>
                          {promptCategories
                            .find((c) => c.id === selectedCategory)
                            ?.prompts.map((prompt) => (
                              <option key={prompt.id} value={prompt.id}>
                                {prompt.shortName}: {prompt.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* 選択されたプロンプトの詳細表示 */}
                      {selectedPromptId && (
                        <div className="bg-white border rounded p-2 text-xs">
                          <button
                            type="button"
                            className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
                            onClick={() => setShowPromptDetails(!showPromptDetails)}
                          >
                            {showPromptDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {getSelectedPromptInfo()?.description}
                          </button>
                          {showPromptDetails && (
                            <div className="mt-2 p-2 bg-gray-50 rounded max-h-32 overflow-y-auto text-gray-600 whitespace-pre-wrap">
                              {getSelectedPromptInfo()?.prompt.slice(0, 500)}
                              {(getSelectedPromptInfo()?.prompt.length || 0) > 500 && '...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 再生成ボタン */}
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={regenerateSituation}
                    disabled={regenLoading || !originalImageFile || (useCustomPrompt && !selectedPromptId)}
                    className="w-full"
                  >
                    {regenLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        {useCustomPrompt ? '選択したプロンプトで生成' : 'この条件で再生成'}
                      </>
                    )}
                  </Button>
                </div>

                {autoGenLoading && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                    解析と可視化候補を生成中...
                  </div>
                )}

                {autoGenError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    自動生成エラー: {autoGenError}
                  </div>
                )}

                {processedImagePreviews.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto mt-2">
                    {processedImagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative border rounded-md overflow-hidden min-w-[150px] group">
                        <div className="relative w-full h-32 cursor-pointer" onClick={() => handleShowPreview(preview)}>
                          {/* Use native <img> for blob/data URLs — NextImage's optimization
                              pipeline adds overhead for non-remote images and can cause jank */}
                          <img
                            src={preview}
                            alt={`加工画像 ${idx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            onError={() => {
                              toast({
                                title: "エラー",
                                description: "加工画像の読み込みに失敗しました",
                                variant: "destructive",
                              });
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-90 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveProcessedImage(idx)
                          }}
                          title="画像を削除"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 bg-gray-100 rounded-md">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-1">加工画像がありません</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* VLM Analysis Panel */}
        {!isMobileFullscreen && showVlmPanel && (
          <VlmAnalysisPanel
            status={vlmStatus}
            result={vlmResult}
            error={vlmError}
            onRetry={retryVlmAnalysis}
          />
        )}

        {/* 選択位置の表示 - モバイルフルスクリーン時は親で表示するため非表示 */}
        {!isMobileFullscreen && (
          selectedLocation ? (
            <div className="text-sm text-blue-600">
              選択位置: 緯度 {selectedLocation[1].toFixed(6)}, 経度 {selectedLocation[0].toFixed(6)}
            </div>
          ) : (
            <div className="text-sm text-red-600">地図上で位置を選択してください</div>
          )
        )}

        {selectedLocation && (
          <p className="text-xs text-gray-500">
            住所推定のため、報告地点の概算座標（約100m精度）を外部ジオコーディングサービス（Mapbox）へ送信します。
          </p>
        )}

        {isGpsLocation && selectedLocation && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">GPS由来の位置は端末の推定値です。送信前に正しい地点か確認してください。</p>
            <label className="flex items-start gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={isGpsLocationConfirmed}
                onChange={(e) => setIsGpsLocationConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>この地点が報告対象であることを確認しました</span>
            </label>
          </div>
        )}

        {/* 解析結果表示 */}
        {riskAnalysis && (
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <h3 className="font-bold text-base">想定リスクと簡易対策</h3>
            {riskAnalysis.map((r, idx) => (
              <p key={idx}>
                • <span className="font-semibold">{r.category}</span> : {r.risk} ─ 対策: {r.measure}
              </p>
            ))}
          </div>
        )}

        {/* 送信ボタン */}
        <div className={isMobileFullscreen
          ? "bg-white border-t border-gray-200 px-4 pt-3 -mx-4 mt-6"
          : "flex justify-end gap-2 pt-2"
        }
          style={isMobileFullscreen ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" } : undefined}
        >
          {isMobileFullscreen ? (
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : "送信中..."}
                </>
              ) : (
                "報告を送信"
              )}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onCancel}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting || !canSubmit} className="min-w-[100px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : "送信中..."}
                  </>
                ) : (
                  "報告を送信"
                )}
              </Button>
            </>
          )}
        </div>
      </form>

      <ImagePreviewDialog isOpen={isPreviewOpen} imageUrl={previewImage} onClose={() => setIsPreviewOpen(false)} />
    </div>
  )
}






