"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import NextImage from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  X,
  Upload,
  Loader2,
  Camera,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Send,
  Check,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import ImagePreviewDialog from "./image-preview-dialog"
import type { DangerReport } from "@/lib/types"
import { compressImage, fileToBase64 } from "@/lib/image-utils"
import { urlOrDataUrlToBlob } from "@/lib/data-url-utils"
import { tankenTokens } from "@/lib/design/tanken"
import {
  TankenButton,
  PaperCard,
  WizardTrail,
  StepSlider,
  DangerTypePicker,
  DangerLevelPicker,
  StepHeading,
  DANGER_TYPES,
} from "./wizard/ui"
import { motion, useReducedMotion } from "framer-motion"
import {
  allPrompts,
  promptCategories,
  getPromptById,
  type TargetAudience,
  type DisasterPrompt,
  ACCIDENT_SITUATION_PROMPT,
  defaultSituations,
  type DefaultSituation,
} from "@/lib/disaster-scenario-prompts"
import { FALLBACK_VIZ_PROMPT } from "@/lib/disaster-image-prompt-fallbacks"
import { buildRegionConstraints } from "@/lib/danger-report/region-constraints"
import { useVlmAnalysis } from "@/hooks/use-vlm-analysis"
import { VlmAnalysisPanel } from "./vlm-analysis-panel"
import { SimulationQuickSummary } from "./simulation-quick-summary"
import { useAccidentStats } from "@/hooks/use-accident-stats"
import AccidentStatsPanel, { AccidentStatsLoading } from "./accident-stats-panel"
import { enrichReportWithAccidents } from "@/lib/traffic-accident-data"
import { handleError } from "@/lib/error-handler"
import { useSupabase } from "@/components/providers/supabase-provider"
import {
  formatHazardDepthLabel,
  getHazardGateMessage,
  queryHazardGate,
  type HazardGateRpcClient,
  type HazardGateVerdict,
} from "@/lib/hazard-zone-gate"
import { buildSystemASimulationJobs } from "@/lib/system-a-simulation"
import {
  extractPreSubmitSimulationQuickSummary,
  extractSimulationQuickSummary,
  selectSimulationQuickSummaryImage,
} from "@/lib/vlm-analysis"

interface DangerReportFormProps {
  onSubmit: (data: DangerReportSubmitPayload) => Promise<{ reportId: string; imageUrl: string | null }>
  onCancel: () => void
  selectedLocation: [number, number] | null
  locationSource?: "manual" | "gps" | null
  selectedRouteId?: string | null
  selectedRouteName?: string | null
  isMobileFullscreen?: boolean
}

export type DangerReportSubmitPayload = Partial<DangerReport> & {
  originalImageFile?: File | null
  processedImageFiles?: File[]
  route_context_id?: string | null
  route_context_name?: string | null
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
  simulationPrompts?: { earthquake: string; typhoon: string; flood: string | null; fire: string }
  riskObservationTable?: string
}

const C = tankenTokens.color

/** ウィザードの あしあと */
const WIZARD_STEPS = ["きけん", "しゃしん", "おくる"] as const

/** 種類ごとの「なまえ」候補(タップで入力) */
const TITLE_SUGGESTIONS: Record<string, string[]> = {
  traffic: ["くるまが おおい みち", "みとおしが わるい こうさてん", "しんごうの ない おうだんほどう"],
  crime: ["くらくて ひとけが ない みち", "こわい こえかけが あった ばしょ", "みまもりが すくない ばしょ"],
  disaster: ["あめで みずが たまる みち", "ふるい ブロックべい", "くずれそうな がけ・かべ"],
  other: ["きになる ばしょ", "あぶないかもしれない ばしょ"],
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
  const blob = file.slice(0, length)
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer())
  }
  // Blob.arrayBuffer 未実装環境(旧Safari等)向けフォールバック
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
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

export default function DangerReportForm({
  onSubmit,
  onCancel,
  selectedLocation,
  locationSource = null,
  selectedRouteId = null,
  selectedRouteName = null,
  isMobileFullscreen = false,
}: DangerReportFormProps) {
  const { toast } = useToast()
  const { supabase } = useSupabase()
  const pathname = usePathname()
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
  type Situation = DefaultSituation
  const [situation, setSituation] = useState<Situation>('viz')
  const [floodGateVerdict, setFloodGateVerdict] = useState<HazardGateVerdict | null>(null)
  const [floodGateLoading, setFloodGateLoading] = useState(false)
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

  // ウィザード進行状態(0:きけん 1:しゃしん 2:おくる 3:かんりょう)
  const [step, setStep] = useState(0)
  const [stepDir, setStepDir] = useState<1 | -1>(1)
  const reduceMotion = useReducedMotion()

  // 一括生成用の状態
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentName: string } | null>(null)
  const [batchImages, setBatchImages] = useState<Array<{ promptId: string; name: string; shortName: string; targetAudience: TargetAudience; blobUrl: string; file: File }>>([])
  const [showBatchResults, setShowBatchResults] = useState(false)
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

  useEffect(() => {
    let active = true
    setFloodGateVerdict(null)
    if (!selectedLocation) {
      setFloodGateLoading(false)
      return () => { active = false }
    }

    setFloodGateLoading(true)
    void queryHazardGate(
      supabase as unknown as HazardGateRpcClient,
      { longitude: selectedLocation[0], latitude: selectedLocation[1] },
      "flood",
      { toleranceMeters: 0 },
    ).then((verdict) => {
      if (!active) return
      setFloodGateVerdict(verdict)
      if (verdict.kind !== "inside") {
        setSituation((current) => current === "flood" ? "viz" : current)
      }
    }).finally(() => {
      if (active) setFloodGateLoading(false)
    })

    return () => { active = false }
  }, [selectedLocation?.[0], selectedLocation?.[1], supabase])

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

  const appendImageGenerationContext = (
    formData: FormData,
    imageSituation: Situation | "custom",
  ) => {
    formData.append("situation", imageSituation)
    if (selectedLocation) {
      formData.append("longitude", String(selectedLocation[0]))
      formData.append("latitude", String(selectedLocation[1]))
    }
  }

  const floodSimulationEnabled = floodGateVerdict?.kind === "inside"
  const accidentSimulationEnabled =
    accidentStatsStatus === "loaded" &&
    Boolean(accidentStats && accidentStats.total_accidents > 0)
  const accidentSimulationDisabledReason = "この地点周辺の事故統計データはありません"
  const floodGateDisabledReason =
    floodGateVerdict && floodGateVerdict.kind !== "inside"
      ? getHazardGateMessage(floodGateVerdict, "flood")
      : floodGateLoading
        ? "浸水想定を確認しています"
        : undefined
  const floodMaximumDepthLabel =
    floodGateVerdict?.kind === "inside"
      ? floodGateVerdict.zone.depthMaxMeters !== null
        ? `${floodGateVerdict.zone.depthMaxMeters.toFixed(1)}m`
        : formatHazardDepthLabel(floodGateVerdict.zone)
      : null

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
    const blob = await urlOrDataUrlToBlob(dataUrl, signal)
    return new File([blob], filename, { type: blob.type || 'image/png' })
  }

  // Convert a data URL (or any fetchable URL) to a lightweight blob URL for preview.
  // Blob URLs are short reference strings (~60 chars) vs multi-MB base64 data URLs,
  // drastically reducing React state size and re-render cost.
  const dataUrlToBlobUrl = async (dataUrl: string, signal?: AbortSignal): Promise<string> => {
    const blob = await urlOrDataUrlToBlob(dataUrl, signal)
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
    const blob = await urlOrDataUrlToBlob(dataUrl, signal)
    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    const blobUrl = URL.createObjectURL(blob)
    registerBlobUrl(blobUrl)
    return { file, blobUrl }
  }

  const fileToBlobUrl = (file: File): string => {
    const blobUrl = URL.createObjectURL(file)
    registerBlobUrl(blobUrl)
    return blobUrl
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
          simulationPrompts?: { earthquake: string; typhoon: string; flood: string | null; fire: string }
          riskObservation?: { tableMarkdown?: string }
        } | null = null
        try {
          const pRes = await fetch('/api/gemini/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              ...(selectedLocation
                ? { longitude: selectedLocation[0], latitude: selectedLocation[1] }
                : {}),
            }),
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

        // 4) simple local simulations. Flood is built only after a positive zone verdict.
        const localSimulationKinds: Array<'flood' | 'fire' | 'typhoon' | 'earthquake'> = [
          'fire',
          'typhoon',
          'earthquake',
        ]
        if (floodSimulationEnabled) localSimulationKinds.unshift('flood')
        const simDataUrls = await Promise.all(
          localSimulationKinds.map((kind) => simulateVariant(originalImageFile, kind)),
        )
        if (!isActive()) return
        const simResults = await Promise.all(
          simDataUrls.map((url, i) => dataUrlToFileAndBlobUrl(url, `${localSimulationKinds[i]}.png`, abortController.signal))
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
            FALLBACK_VIZ_PROMPT
          const englishPrompt = `${baseViz}\n${buildRegionConstraints(hazards)}`
          fd.append('prompt', englishPrompt)
          fd.append('generationMode', 'standard')
          appendImageGenerationContext(fd, 'viz')
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
            const make = async (prompt: string, suffix: Situation) => {
              const fd = new FormData()
              fd.append('image', compressedForSim)
              fd.append('prompt', prompt)
              fd.append('generationMode', 'standard')
              appendImageGenerationContext(fd, suffix)
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
            const simulationJobs = buildSystemASimulationJobs(sims)
            const simResultsBatch: { file: File; blobUrl: string }[] = []
            for (let i = 0; i < simulationJobs.length; i += 2) {
              const batch = simulationJobs.slice(i, i + 2).map((job) =>
                make(job.prompt, job.situation),
              )
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
              setAutoGenError(handleError(e, '自動生成に失敗しました。時間をおいて再度お試しください。'))
            }
          }
        }
      } catch (error) {
        if (isActive()) {
          console.error('Error in auto-generation:', error)
          setAutoGenError(handleError(error, '自動生成に失敗しました。時間をおいて再度お試しください。'))
        }
      } finally {
        if (isActive()) {
          setAutoGenLoading(false)
          // 実行完了後に戻す。開始直後に戻すと effect cleanup が予約処理を中断する。
          setManualAnalysisTriggered(false)
        }
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
      } else if (situation === 'accident') {
        prompt = ACCIDENT_SITUATION_PROMPT
      } else {
        // 従来のシチュエーション選択
        let pr = generatedPrompts

        if (!pr) {
          const base64 = await fileToBase64(await compressImage(originalImageFile))
          const pRes = await fetch('/api/gemini/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              ...(selectedLocation
                ? { longitude: selectedLocation[0], latitude: selectedLocation[1] }
                : {}),
            }),
          })
          if (pRes.ok) {
            const pjson = await pRes.json()
            const prompts = pjson?.prompts as
              | {
                  vizPrompt?: string
                  simulationPrompts?: { earthquake: string; typhoon: string; flood: string | null; fire: string }
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
      appendImageGenerationContext(fd, useCustomPrompt ? 'custom' : situation)
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
      setAutoGenError(handleError(error, '不明なエラーが発生しました。'))
    } finally {
      setRegenLoading(false)
    }
  }

  // 全プロンプトを一括生成
  const batchGenerateAll = async () => {
    if (!originalImageFile) {
      toast({
        title: '元写真をアップロードしてください',
        description: '「元写真」タブから通学路の写真を撮影またはアップロードしてください。',
        variant: 'destructive',
      })
      return
    }
    setBatchLoading(true)
    setBatchImages([])
    setShowBatchResults(true)

    try {
      const compressed = await compressImage(originalImageFile, { targetMaxSize: 1.5 * 1024 * 1024 })
      const results: Array<{ promptId: string; name: string; shortName: string; targetAudience: TargetAudience; blobUrl: string; file: File }> = []

      for (let i = 0; i < allPrompts.length; i++) {
        const p = allPrompts[i]
        setBatchProgress({ current: i + 1, total: allPrompts.length, currentName: p.name })
        try {
          const fd = new FormData()
          fd.append('image', compressed)
          fd.append('prompt', p.prompt)
          fd.append('generationMode', 'disaster')
          appendImageGenerationContext(fd, 'custom')
          const res = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd })
          if (res.ok) {
            const json = await res.json()
            const imgs = Array.isArray(json.images) ? (json.images as { dataUrl: string }[]) : []
            if (imgs[0]) {
              const { file, blobUrl } = await dataUrlToFileAndBlobUrl(imgs[0].dataUrl, `batch-${p.id}.png`)
              results.push({ promptId: p.id, name: p.name, shortName: p.shortName, targetAudience: p.targetAudience, blobUrl, file })
              setBatchImages([...results])
            }
          }
        } catch {
          // 失敗したプロンプトはスキップして続行
        }
        if (i < allPrompts.length - 1) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    } catch (error) {
      toast({
        title: '一括生成に失敗しました',
        description: handleError(error, '時間をおいて再度お試しください。'),
        variant: 'destructive',
      })
    } finally {
      setBatchProgress(null)
      setBatchLoading(false)
    }
  }

  // バッチ生成結果をレポートの加工画像に追加
  const addBatchImageToReport = (img: { file: File; blobUrl: string }) => {
    setProcessedImageFiles(prev => [...prev, img.file])
    setProcessedImagePreviews(prev => [...prev, fileToBlobUrl(img.file)])
    setActiveImageTab('processed')
    toast({ title: '追加しました', description: '加工画像に追加されました' })
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
        route_context_id: selectedRouteId,
        route_context_name: selectedRouteName,
      }
      if (compressedOriginalFile) {
        reportData.originalImageFile = compressedOriginalFile
      }
      if (compressedProcessedFiles.length > 0) {
        reportData.processedImageFiles = compressedProcessedFiles
      }

      // 親コンポーネントの送信ハンドラーを呼び出し、report IDとimage URLを取得
      const result = await onSubmit(reportData)

      // 送信成功: かんりょう画面へ
      setStepDir(1)
      setStep(3)

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
  const extractedQuickSummary = extractSimulationQuickSummary(vlmResult)
  const preSubmitQuickSummary = extractPreSubmitSimulationQuickSummary(
    generatedPrompts?.riskObservationTable
  )
  const riskAnalysisFallback = riskAnalysis?.[0]
  const simulationQuickSummary =
    extractedQuickSummary ||
    preSubmitQuickSummary ||
    (riskAnalysisFallback
      ? {
          summary: riskAnalysisFallback.risk,
          action: riskAnalysisFallback.measure,
        }
      : null)
  const preferredSimulationHazardKey = extractedQuickSummary ? null : preSubmitQuickSummary?.hazardKey
  const previewSimulationImage = selectSimulationQuickSummaryImage(
    processedImageFiles,
    processedImagePreviews,
    preferredSimulationHazardKey
  )

  // 画像削除ハンドラー（元画像）— 再選択でやり直せるため確認ダイアログは出さない
  const handleRemoveOriginalImage = () => {
    setOriginalImageFile(null)
    setOriginalImagePreview(null)
    if (originalFileInputRef.current) {
      originalFileInputRef.current.value = ""
    }
    toast({ title: "しゃしんを けしたよ" })
  }

  // 画像削除ハンドラー（加工画像）
  const handleRemoveProcessedImage = (index: number) => {
    const targetUrl = processedImagePreviews[index]
    revokeBlobUrl(targetUrl)
    setProcessedImageFiles((prev) => prev.filter((_, i) => i !== index))
    setProcessedImagePreviews((prev) => prev.filter((_, i) => i !== index))
    if (processedFileInputRef.current) {
      processedFileInputRef.current.value = ""
    }
    toast({ title: "かこう画像を けしたよ" })
  }

  // ウィザードの前後移動
  const goBack = () => {
    setStepDir(-1)
    setStep((s) => Math.max(s - 1, 0))
  }

  const goNext = () => {
    if (step === 0) {
      if (!selectedLocation) {
        toast({
          title: "ばしょが えらばれていないよ",
          description: "ちずを タップして ばしょを えらんでね。",
          variant: "destructive",
        })
        return
      }
      if (isGpsLocation && !isGpsLocationConfirmed) {
        toast({
          title: "ばしょの かくにんを してね",
          description: "「この ばしょで OK」を おしてから すすんでね。",
          variant: "destructive",
        })
        return
      }
    }
    setStepDir(1)
    setStep((s) => Math.min(s + 1, 2))
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

  const selectedTypeInfo = DANGER_TYPES.find((t) => t.id === dangerType)
  const titleSuggestions = TITLE_SUGGESTIONS[dangerType] ?? TITLE_SUGGESTIONS.other

  return (
    <div
      className={
        isMobileFullscreen ? "flex min-h-full flex-col px-4 pb-2 pt-3" : "flex flex-col p-4"
      }
      style={{ fontFamily: tankenTokens.font.family, wordBreak: "keep-all", overflowWrap: "break-word" }}
      data-testid="danger-report-wizard"
    >
      {/* ヘッダー - モバイルフルスクリーン時は親で表示するため非表示 */}
      {!isMobileFullscreen && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black" style={{ color: C.ink }}>
            危険箇所を報告
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="とじる"
            className={`grid h-10 w-10 place-items-center rounded-full border-2 bg-white ${tankenTokens.cls.focus}`}
            style={{ borderColor: tankenTokens.border.soft, color: C.inkSoft, boxShadow: tankenTokens.shadow.pressPaper }}
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      )}

      {/* あしあと(進捗) */}
      {step < 3 && (
        <div className="mb-4">
          <WizardTrail steps={WIZARD_STEPS} current={step} />
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <StepSlider stepKey={step} direction={stepDir}>
            {/* ------------------------------------------------------ *
             * STEP 0: どんな きけん？
             * ------------------------------------------------------ */}
            {step === 0 && (
              <div className="space-y-4">
                {selectedRouteName && (
                  <div
                    data-testid="route-report-context"
                    className="rounded-[14px] border px-3 py-2"
                    style={{ background: C.skySoft, borderColor: "rgba(62,143,184,.25)" }}
                  >
                    <p className="text-[12.5px] font-black" style={{ color: "#2A6B8C" }}>
                      通学路「{selectedRouteName}」の報告として共有されるよ
                    </p>
                  </div>
                )}

                {/* ばしょ */}
                {selectedLocation ? (
                  <PaperCard tone="green" className="flex items-center gap-3 p-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-white"
                      style={{ borderColor: "rgba(21,158,114,.4)" }}
                    >
                      <MapPin className="h-5 w-5" style={{ color: C.primary }} strokeWidth={2.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-black leading-tight" style={{ color: C.ink }}>
                        ちずに ピンを たてたよ
                      </p>
                      <p className="mt-0.5 text-[11.5px] font-bold leading-snug" style={{ color: C.inkSoft }}>
                        ばしょを かえたいときは「地点を変更」からね
                      </p>
                    </div>
                  </PaperCard>
                ) : (
                  <PaperCard tone="accent" className="flex items-center gap-3 p-3">
                    <MapPin className="h-5 w-5 shrink-0" style={{ color: C.accentStrong }} />
                    <p className="text-[13px] font-black" style={{ color: C.accentStrong }}>
                      ちずを タップして ばしょを えらんでね
                    </p>
                  </PaperCard>
                )}

                {/* GPS確認(現在地由来のとき) */}
                {isGpsLocation && selectedLocation && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isGpsLocationConfirmed}
                    data-testid="gps-confirm-toggle"
                    onClick={() => setIsGpsLocationConfirmed(!isGpsLocationConfirmed)}
                    className={`flex w-full items-center gap-3 rounded-[16px] border-2 p-3 text-left ${tankenTokens.cls.focus}`}
                    style={{
                      background: isGpsLocationConfirmed ? C.primarySoft : C.sunSoft,
                      borderColor: isGpsLocationConfirmed ? "rgba(21,158,114,.5)" : "rgba(226,168,18,.5)",
                    }}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors"
                      style={{
                        background: isGpsLocationConfirmed ? C.primary : "#fff",
                        borderColor: isGpsLocationConfirmed ? C.primaryStrong : "rgba(67,57,43,.25)",
                      }}
                    >
                      {isGpsLocationConfirmed && <Check className="h-4 w-4 text-white" strokeWidth={3.4} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black leading-tight" style={{ color: C.ink }}>
                        いまいる ばしょで OK！
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-bold leading-snug" style={{ color: C.inkSoft }}>
                        GPSの ばしょは すこし ずれることがあるよ。ちずの ピンを みてね。
                      </span>
                    </span>
                  </button>
                )}

                <div>
                  <StepHeading hint="ちかいものを 1つ えらんでね">どんな きけん？</StepHeading>
                  <DangerTypePicker value={dangerType} onChange={setDangerType} />
                </div>

                <div>
                  <StepHeading hint="こどもに とっての あぶなさで えらぼう">どれくらい あぶない？</StepHeading>
                  <DangerLevelPicker value={dangerLevel} onChange={setDangerLevel} />
                </div>
              </div>
            )}

            {/* ------------------------------------------------------ *
             * STEP 1: しゃしん (任意)
             * ------------------------------------------------------ */}
            {step === 1 && (
              <div className="space-y-4">
                <StepHeading hint="なくても OK。あると みんなに つたわりやすいよ">
                  ばしょの しゃしんを とろう
                </StepHeading>

                <div className="flex gap-2">
                  <TankenButton
                    variant="paper"
                    className="flex-1"
                    onClick={() => {
                      if (originalFileInputRef.current) {
                        originalFileInputRef.current.removeAttribute("capture")
                        originalFileInputRef.current.click()
                      }
                    }}
                  >
                    <Upload className="h-4 w-4" strokeWidth={2.6} />
                    アルバム
                  </TankenButton>
                  <TankenButton
                    variant="green"
                    className="flex-[1.4]"
                    onClick={() => handleCameraAccess(originalFileInputRef)}
                  >
                    <Camera className="h-5 w-5" strokeWidth={2.6} />
                    カメラで パチリ
                  </TankenButton>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOriginalImageSelect}
                    className="hidden"
                    ref={originalFileInputRef}
                  />
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
                  <PaperCard tone="danger" className="p-3">
                    <p className="text-[12.5px] font-bold" style={{ color: C.danger }}>{cameraError}</p>
                    <p className="mt-1 text-[11.5px] font-bold" style={{ color: C.inkSoft }}>
                      アルバムから えらぶことも できるよ
                    </p>
                  </PaperCard>
                )}

                {originalImagePreview ? (
                  <div>
                    {/* ノートに貼った しゃしん */}
                    <motion.div
                      initial={reduceMotion ? false : { scale: 0.96, rotate: -1.6, opacity: 0 }}
                      animate={{ scale: 1, rotate: -0.8, opacity: 1 }}
                      transition={tankenTokens.spring}
                      className="relative mx-auto w-full max-w-[340px] rounded-[16px] border bg-white p-2 pb-3"
                      style={{ borderColor: tankenTokens.border.faint, boxShadow: tankenTokens.shadow.card }}
                    >
                      <div
                        className="relative h-44 w-full cursor-pointer overflow-hidden rounded-[10px]"
                        onClick={() => handleShowPreview(originalImagePreview)}
                      >
                        <NextImage
                          src={originalImagePreview}
                          alt="えらんだ しゃしん"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="しゃしんを けす"
                        className={`absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full border-2 ${tankenTokens.cls.focus}`}
                        style={{ background: C.danger, borderColor: "#fff", color: "#fff", boxShadow: tankenTokens.shadow.soft }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveOriginalImage()
                        }}
                      >
                        <X className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </motion.div>

                    {/* AI 可視化 */}
                    <div className="mt-3">
                      <TankenButton
                        variant="sun"
                        className="w-full"
                        disabled={autoGenLoading}
                        testId="analyze-photo"
                        onClick={() => {
                          lastAutoGenKey.current = null
                          setManualAnalysisTriggered(true)
                        }}
                      >
                        {autoGenLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            ルペが しらべてるよ…
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5" strokeWidth={2.6} />
                            AIで きけんを みつける
                          </>
                        )}
                      </TankenButton>
                    </div>
                  </div>
                ) : (
                  <PaperCard className="flex h-32 items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8" style={{ color: C.inkFaint }} />
                      <p className="mt-1 text-[12.5px] font-bold" style={{ color: C.inkFaint }}>
                        まだ しゃしんが ないよ
                      </p>
                    </div>
                  </PaperCard>
                )}

                {autoGenError && (
                  <PaperCard tone="danger" className="p-3">
                    <p className="text-[12.5px] font-bold" style={{ color: C.danger }}>
                      うまく いかなかったみたい: {autoGenError}
                    </p>
                  </PaperCard>
                )}

                {/* 加工画像(AIが つくった「もしも」のしゃしん) */}
                {processedImagePreviews.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[13px] font-black" style={{ color: C.ink }}>
                      AIが つくった「もしも」のしゃしん
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {processedImagePreviews.map((preview, idx) => (
                        <div
                          key={idx}
                          className="relative min-w-[140px] overflow-hidden rounded-[12px] border bg-white p-1"
                          style={{ borderColor: tankenTokens.border.faint, boxShadow: tankenTokens.shadow.soft }}
                        >
                          <div
                            className="relative h-28 w-full cursor-pointer overflow-hidden rounded-[8px]"
                            onClick={() => handleShowPreview(preview)}
                          >
                            {/* blob/data URL のため native img を使用(NextImage 最適化を回避) */}
                            <img
                              src={preview}
                              alt={`かこう画像 ${idx + 1}`}
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                              onError={() => {
                                toast({
                                  title: "エラー",
                                  description: "加工画像の読み込みに失敗しました",
                                  variant: "destructive",
                                })
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="この画像を けす"
                            className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-2 ${tankenTokens.cls.focus}`}
                            style={{ background: C.danger, borderColor: "#fff", color: "#fff" }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveProcessedImage(idx)
                            }}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* シチュエーション(「もしも」の条件) */}
                {originalImagePreview && (
                  <PaperCard className="space-y-3 p-3">
                    <p className="text-[13px] font-black" style={{ color: C.ink }}>
                      「もしも」を えらんで つくりなおす
                    </p>
                    {floodGateVerdict?.kind === "inside" && (
                      <div
                        className="space-y-1 rounded-xl border-2 px-3 py-2 text-[12px] font-black"
                        style={{
                          background: "rgba(59,130,246,.08)",
                          borderColor: "rgba(37,99,235,.24)",
                          color: C.ink,
                        }}
                      >
                        <p className="flex items-center gap-1.5">
                          <span aria-hidden="true">🌊</span>
                          <span>{getHazardGateMessage(floodGateVerdict, "flood")}</span>
                        </p>
                        <p className="text-[11px] font-bold" style={{ color: C.inkSoft }}>
                          {`この地点の想定最大浸水深: ${floodMaximumDepthLabel}（出典: ${floodGateVerdict.zone.sourceLayer}）※画像は表現を抑えたイメージです`}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {defaultSituations.map((s) => {
                        const active = !useCustomPrompt && situation === s.id
                        const floodDisabled = s.id === "flood" && !floodSimulationEnabled
                        const accidentDisabled = s.id === "accident" && !accidentSimulationEnabled
                        const disabled = floodDisabled || accidentDisabled
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={active}
                            disabled={disabled}
                            title={
                              floodDisabled
                                ? floodGateDisabledReason
                                : accidentDisabled
                                  ? accidentSimulationDisabledReason
                                  : undefined
                            }
                            onClick={() => {
                              setUseCustomPrompt(false)
                              setSituation(s.id as Situation)
                            }}
                            className={`rounded-full border-2 px-3 py-1.5 text-[12px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tankenTokens.cls.focus}`}
                            style={{
                              background: active ? C.primary : "#fff",
                              color: active ? "#fff" : C.inkSoft,
                              borderColor: active ? C.primaryStrong : "rgba(67,57,43,.14)",
                            }}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>

                    <TankenButton
                      variant="paper"
                      className="w-full min-h-[46px]"
                      onClick={regenerateSituation}
                      disabled={
                        regenLoading ||
                        !originalImageFile ||
                        (useCustomPrompt && !selectedPromptId) ||
                        (!useCustomPrompt && situation === "flood" && !floodSimulationEnabled) ||
                        (!useCustomPrompt && situation === "accident" && !accidentSimulationEnabled)
                      }
                    >
                      {regenLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          つくっているよ…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {useCustomPrompt ? "えらんだ おだいで つくる" : "この「もしも」で つくる"}
                        </>
                      )}
                    </TankenButton>

                    {/* くわしい設定(おうちの人・行政向け) */}
                    <div className="border-t pt-2" style={{ borderColor: tankenTokens.border.faint }}>
                      <button
                        type="button"
                        className={`flex items-center gap-1 text-[12px] font-black ${tankenTokens.cls.focus}`}
                        style={{ color: C.inkSoft }}
                        onClick={() => setUseCustomPrompt(!useCustomPrompt)}
                        aria-expanded={useCustomPrompt}
                      >
                        {useCustomPrompt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        くわしい設定（おうちの人向け: 防災プロンプト・一括生成）
                      </button>

                      {useCustomPrompt && (
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {promptCategories.map((category) => (
                              <button
                                key={category.id}
                                type="button"
                                className={`rounded-full border-2 px-2.5 py-1 text-[11.5px] font-black ${tankenTokens.cls.focus}`}
                                style={{
                                  background: selectedCategory === category.id ? C.primarySoft : "#fff",
                                  color: selectedCategory === category.id ? C.primaryStrong : C.inkSoft,
                                  borderColor:
                                    selectedCategory === category.id ? "rgba(21,158,114,.45)" : "rgba(67,57,43,.14)",
                                }}
                                onClick={() => handleCategoryChange(category.id)}
                              >
                                {category.icon} {category.name}
                              </button>
                            ))}
                          </div>

                          <select
                            className="w-full rounded-[12px] border-2 bg-white px-2 py-2 text-[13px] font-bold"
                            style={{ borderColor: tankenTokens.border.soft, color: C.ink }}
                            value={selectedPromptId}
                            onChange={(e) => setSelectedPromptId(e.target.value)}
                            aria-label="防災プロンプトを選択"
                          >
                            <option value="">-- おだいを えらぶ --</option>
                            {promptCategories
                              .find((c) => c.id === selectedCategory)
                              ?.prompts.map((prompt) => (
                                <option key={prompt.id} value={prompt.id}>
                                  {prompt.shortName}: {prompt.name}
                                </option>
                              ))}
                          </select>

                          {selectedPromptId && (
                            <div
                              className="rounded-[12px] border bg-white p-2 text-[11.5px] font-bold"
                              style={{ borderColor: tankenTokens.border.faint, color: C.inkSoft }}
                            >
                              <button
                                type="button"
                                className="flex items-center gap-1"
                                onClick={() => setShowPromptDetails(!showPromptDetails)}
                              >
                                {showPromptDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {getSelectedPromptInfo()?.description}
                              </button>
                              {showPromptDetails && (
                                <div
                                  className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded p-2"
                                  style={{ background: C.paperDeep }}
                                >
                                  {getSelectedPromptInfo()?.prompt.slice(0, 500)}
                                  {(getSelectedPromptInfo()?.prompt.length || 0) > 500 && "..."}
                                </div>
                              )}
                            </div>
                          )}

                          <TankenButton
                            variant="paper"
                            className="w-full min-h-[44px] text-[13px]"
                            onClick={batchGenerateAll}
                            disabled={batchLoading}
                          >
                            {batchLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {batchProgress
                                  ? `つくっているよ ${batchProgress.current}/${batchProgress.total} — ${batchProgress.currentName}`
                                  : "じゅんびちゅう..."}
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                全プロンプト一括生成（{allPrompts.length}件）
                              </>
                            )}
                          </TankenButton>

                          {batchImages.length > 0 && (
                            <div className="border-t pt-2" style={{ borderColor: tankenTokens.border.faint }}>
                              <button
                                type="button"
                                className="mb-2 flex items-center gap-1 text-[11.5px] font-black"
                                style={{ color: C.inkSoft }}
                                onClick={() => setShowBatchResults((v) => !v)}
                              >
                                {showBatchResults ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                一括生成結果（{batchImages.length}/{allPrompts.length}件）
                              </button>
                              {showBatchResults && (
                                <div className="space-y-3">
                                  {promptCategories.map((cat) => {
                                    const catImgs = batchImages.filter((img) => img.targetAudience === cat.id)
                                    if (catImgs.length === 0) return null
                                    return (
                                      <div key={cat.id}>
                                        <p className="mb-1 text-[11px] font-bold" style={{ color: C.inkFaint }}>
                                          {cat.name}
                                        </p>
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                          {catImgs.map((img) => (
                                            <div key={img.promptId} className="w-24 flex-none">
                                              <div
                                                className="group relative h-20 cursor-pointer overflow-hidden rounded-[10px] border"
                                                style={{ borderColor: tankenTokens.border.faint }}
                                                onClick={() => addBatchImageToReport(img)}
                                                title={`${img.name} — タップしてレポートに追加`}
                                              >
                                                <img src={img.blobUrl} alt={img.name} className="h-full w-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                                  <span className="text-xs font-black text-white">ついか</span>
                                                </div>
                                              </div>
                                              <p className="mt-0.5 truncate text-[10.5px] font-bold" style={{ color: C.inkFaint }}>
                                                {img.shortName}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </PaperCard>
                )}

                {/* 解析結果(想定リスク) */}
                {riskAnalysis && (
                  <PaperCard tone="sun" className="space-y-1.5 p-3">
                    <p className="text-[13.5px] font-black" style={{ color: C.ink }}>
                      ルペの はっけんメモ
                    </p>
                    {riskAnalysis.map((r, idx) => (
                      <p key={idx} className="text-[12.5px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
                        <span className="font-black" style={{ color: C.accentStrong }}>{r.category}</span>
                        ：{r.risk} ─ どうする？: {r.measure}
                      </p>
                    ))}
                  </PaperCard>
                )}

                {simulationQuickSummary && (
                  <SimulationQuickSummary
                    summary={simulationQuickSummary.summary}
                    action={simulationQuickSummary.action}
                    imageUrl={previewSimulationImage}
                  />
                )}
              </div>
            )}

            {/* ------------------------------------------------------ *
             * STEP 2: なまえを つけて おくる
             * ------------------------------------------------------ */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <StepHeading hint="タップでも えらべるよ">この ばしょに なまえを つけよう</StepHeading>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {titleSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTitle(s)}
                        className={`rounded-full border-2 px-3 py-1.5 text-[12px] font-black ${tankenTokens.cls.focus}`}
                        style={{
                          background: title === s ? C.primarySoft : "#fff",
                          color: title === s ? C.primaryStrong : C.inkSoft,
                          borderColor: title === s ? "rgba(21,158,114,.45)" : "rgba(67,57,43,.14)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="title" className="sr-only">
                    この場所の名前
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="れい: みとおしが わるい こうさてん"
                    maxLength={120}
                    required
                    data-testid="report-title"
                    className="h-12 rounded-[14px] border-2 bg-white text-[15px] font-bold"
                    style={{ borderColor: tankenTokens.border.soft, color: C.ink }}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="mb-1 block text-[13px] font-black" style={{ color: C.ink }}>
                    くわしい メモ（なくても OK）
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="れい: 夕方は くるまが スピードを だしていて こわい"
                    className="min-h-[84px] resize-none rounded-[14px] border-2 bg-white text-[14px] font-bold"
                    style={{ borderColor: tankenTokens.border.soft, color: C.ink }}
                    maxLength={1000}
                  />
                </div>

                {/* まとめカード */}
                <PaperCard className="space-y-2.5 p-3.5">
                  <p className="text-[13px] font-black" style={{ color: C.inkFaint }}>
                    おくる ないよう
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTypeInfo && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12.5px] font-black"
                        style={{
                          background: selectedTypeInfo.soft,
                          borderColor: selectedTypeInfo.color,
                          color: C.ink,
                        }}
                      >
                        <selectedTypeInfo.icon className="h-3.5 w-3.5" style={{ color: selectedTypeInfo.color }} />
                        {selectedTypeInfo.label}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center rounded-full border-2 px-3 py-1 text-[12.5px] font-black"
                      style={{ background: C.sunSoft, borderColor: C.sunDeep, color: C.ink }}
                    >
                      あぶなさ レベル{dangerLevel}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-[12.5px] font-black"
                      style={{ background: "#fff", borderColor: tankenTokens.border.soft, color: C.inkSoft }}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      しゃしん {originalImagePreview ? 1 + processedImagePreviews.length : processedImagePreviews.length}まい
                    </span>
                  </div>
                  {!selectedLocation && (
                    <p className="text-[12px] font-black" style={{ color: C.danger }}>
                      ばしょが えらばれていないよ。「地点を変更」から えらんでね。
                    </p>
                  )}
                </PaperCard>

                {/* 交通事故データ(この場所の周辺情報) */}
                {selectedLocation && accidentStatsStatus !== "idle" && (
                  <div>
                    {accidentStatsStatus === "loading" && <AccidentStatsLoading />}
                    {accidentStatsStatus === "error" && (
                      <p className="text-[11.5px] font-bold" style={{ color: C.accentStrong }}>
                        事故統計の取得に失敗しました（報告には影響しません）
                      </p>
                    )}
                    {accidentStatsStatus === "loaded" && accidentStats && (
                      <AccidentStatsPanel stats={accidentStats} mode="compact" />
                    )}
                  </div>
                )}

                <p className="text-[11px] font-bold leading-relaxed" style={{ color: C.inkFaint }}>
                  住所推定のため、報告地点の概算座標（約100m精度）を外部ジオコーディングサービス（Mapbox）へ送信します。
                  投稿した写真は危険度のAI分析のため、外部AIサービス（Anthropic Claude / Google Gemini）へ送信されます。
                  おくった ないようは おとなの かくにんの あとに ちずへ のるよ。
                </p>
              </div>
            )}

            {/* ------------------------------------------------------ *
             * STEP 3: かんりょう
             * ------------------------------------------------------ */}
            {step === 3 && (
              <div className="space-y-4 pb-4">
                <div className="flex flex-col items-center pt-4 text-center">
                  <motion.div
                    initial={reduceMotion ? false : { scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="grid h-24 w-24 place-items-center rounded-full border-4"
                    style={{
                      background: C.primary,
                      borderColor: "rgba(67,57,43,.2)",
                      boxShadow: `0 5px 0 ${C.primaryStrong}, 0 18px 36px -16px rgba(12,122,85,.6)`,
                    }}
                  >
                    <Check className="h-12 w-12 text-white" strokeWidth={3.6} />
                  </motion.div>
                  <motion.h3
                    initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...tankenTokens.springSoft, delay: 0.12 }}
                    className="mt-4 text-[20px] font-black"
                    style={{ color: C.ink }}
                  >
                    報告できたよ！
                  </motion.h3>
                  <motion.p
                    initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...tankenTokens.springSoft, delay: 0.2 }}
                    className="mt-1.5 max-w-[300px] text-[13px] font-bold leading-relaxed"
                    style={{ color: C.inkSoft }}
                  >
                    ありがとう！ おとなの かくにんが おわると、ちずに のるよ。
                  </motion.p>
                  {submittedReportId && (
                    <div
                      className="mt-4 w-full rounded-[16px] border p-3 text-left"
                      style={{ background: C.primarySoft, borderColor: "rgba(21,158,114,.3)" }}
                      aria-live="polite"
                    >
                      <p className="text-[12px] font-black" style={{ color: C.primaryStrong }}>受付番号</p>
                      <p className="mt-0.5 break-all text-[13px] font-bold" style={{ color: C.ink }}>{submittedReportId}</p>
                      <p className="mt-2 text-[12px] font-bold" style={{ color: C.inkSoft }}>状態: おとなが確認しています</p>
                    </div>
                  )}
                </div>

                {simulationQuickSummary && (
                  <SimulationQuickSummary
                    summary={simulationQuickSummary.summary}
                    action={simulationQuickSummary.action}
                    imageUrl={previewSimulationImage}
                  />
                )}

                {showVlmPanel && (
                  <VlmAnalysisPanel
                    status={vlmStatus}
                    result={vlmResult}
                    error={vlmError}
                    onRetry={retryVlmAnalysis}
                  />
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* /map 上のウィザードでは同一ルートへの Link は何も起こさないため、
                      フォームを閉じて地図へ戻る。それ以外(/report 等)では /map へ遷移する */}
                  {pathname === "/map" ? (
                    <button
                      type="button"
                      onClick={onCancel}
                      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black text-white ${tankenTokens.cls.focus}`}
                      style={{ background: C.primary, boxShadow: tankenTokens.shadow.pressGreen }}
                    >
                      ちずで見る
                    </button>
                  ) : (
                    <Link
                      href="/map"
                      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black text-white ${tankenTokens.cls.focus}`}
                      style={{ background: C.primary, boxShadow: tankenTokens.shadow.pressGreen }}
                    >
                      ちずで見る
                    </Link>
                  )}
                  <Link
                    href="/mypage"
                    className={`inline-flex min-h-12 items-center justify-center rounded-full border-2 px-5 text-sm font-black ${tankenTokens.cls.focus}`}
                    style={{ background: C.card, borderColor: tankenTokens.border.soft, color: C.ink, boxShadow: tankenTokens.shadow.pressPaper }}
                  >
                    履歴を見る
                  </Link>
                </div>
                <TankenButton variant="paper" className="w-full" onClick={onCancel} testId="wizard-done-close">
                  とじる
                </TankenButton>
              </div>
            )}
          </StepSlider>
        </div>

        {/* フッターナビ */}
        {step < 3 && (
          <div
            className="sticky bottom-0 z-10 -mx-4 mt-5 px-4 pt-3"
            style={{
              background: "linear-gradient(180deg, rgba(251,245,233,0) 0%, #FBF5E9 34%)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.6rem)",
            }}
          >
            <div className="flex gap-2">
              {step > 0 && (
                <TankenButton variant="paper" onClick={goBack} className="flex-1" testId="wizard-back">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2.8} />
                  もどる
                </TankenButton>
              )}
              {step < 2 ? (
                <TankenButton variant="green" onClick={goNext} className="flex-[2]" testId="wizard-next">
                  つぎへ
                  <ArrowRight className="h-5 w-5" strokeWidth={2.8} />
                </TankenButton>
              ) : (
                <TankenButton
                  variant="accent"
                  type="submit"
                  disabled={isSubmitting || !canSubmit || !title.trim()}
                  className="flex-[2]"
                  testId="wizard-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : "おくっているよ..."}
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" strokeWidth={2.6} />
                      おくる
                    </>
                  )}
                </TankenButton>
              )}
            </div>
          </div>
        )}
      </form>

      <ImagePreviewDialog isOpen={isPreviewOpen} imageUrl={previewImage} onClose={() => setIsPreviewOpen(false)} />
    </div>
  )
}
