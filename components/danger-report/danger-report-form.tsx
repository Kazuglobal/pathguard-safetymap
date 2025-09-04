"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import NextImage from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Upload, Loader2, Camera, ImageIcon } from "lucide-react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import ImagePreviewDialog from "./image-preview-dialog"
import type { DangerReport } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DangerReportFormProps {
  onSubmit: (data: Partial<DangerReport>) => void
  onCancel: () => void
  selectedLocation: [number, number] | null
}

export default function DangerReportForm({ onSubmit, onCancel, selectedLocation }: DangerReportFormProps) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dangerType, setDangerType] = useState<string>("traffic")
  const [dangerLevel, setDangerLevel] = useState<number>(3)

  // 元画像関連の状態
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null)
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null)
  const originalFileInputRef = useRef<HTMLInputElement>(null)

  // 加工画像関連の状態
  const [processedImageFiles, setProcessedImageFiles] = useState<File[]>([])
  const [processedImagePreviews, setProcessedImagePreviews] = useState<string[]>([])
  const processedFileInputRef = useRef<HTMLInputElement>(null)

  const [activeImageTab, setActiveImageTab] = useState<string>("original")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const [riskAnalysis, setRiskAnalysis] = useState<any[] | null>(null)
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [autoGenError, setAutoGenError] = useState<string | null>(null)
  const lastAutoGenKey = useRef<string | null>(null)
  const [generatedPrompts, setGeneratedPrompts] = useState<{
    vizPrompt?: string
    simulationPrompts?: { earthquake: string; typhoon: string; flood: string; fire: string }
    riskObservationTable?: string
  } | null>(null)
  const [lastHazards, setLastHazards] = useState<any[]>([])
  type Situation = 'viz' | 'earthquake' | 'typhoon' | 'flood' | 'fire'
  const [situation, setSituation] = useState<Situation>('viz')
  const [regenLoading, setRegenLoading] = useState(false)

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

  // カメラアクセスハンドラー
  const handleCameraAccess = async (inputRef: React.RefObject<HTMLInputElement | null>, type: 'original' | 'processed') => {
    setIsCameraLoading(true)
    setCameraError(null)
    
    try {
      // カメラアクセス許可をチェック
      if ('mediaDevices' in navigator) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        stream.getTracks().forEach(track => track.stop()) // ストリームを停止
        
        // カメラアクセスが成功した場合、ファイル入力を開く
        if (inputRef.current) {
          inputRef.current.setAttribute('capture', 'environment')
          inputRef.current.click()
        }
      } else {
        throw new Error('カメラはサポートされていません')
      }
    } catch (error) {
      console.error('Camera access error:', error)
      setCameraError('カメラへのアクセスが拒否されました')
      toast({
        title: "カメラエラー",
        description: "カメラへのアクセスが拒否されました。設定からカメラ権限を許可してください。",
        variant: "destructive",
      })
      
      // フォールバック：ファイル選択を開く
      if (inputRef.current) {
        inputRef.current.removeAttribute('capture')
        inputRef.current.click()
      }
    } finally {
      setIsCameraLoading(false)
    }
  }

  // 画像選択ハンドラー（元画像）
  const handleOriginalImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルサイズチェック (10MB以下)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "エラー",
        description: "画像サイズは10MB以下にしてください。",
        variant: "destructive",
      })
      return
    }

    // 画像タイプチェック
    if (!file.type.startsWith("image/")) {
      toast({
        title: "エラー",
        description: "画像ファイルを選択してください。",
        variant: "destructive",
      })
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
  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/png' })
  }

  // Compress large images client-side to avoid 413 from server
  const compressImage = async (
    file: File,
    maxDimension: number = 1600,
    quality: number = 0.8,
  ): Promise<File> => {
    try {
      const objectUrl = URL.createObjectURL(file)
      const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = objectUrl
      })
      URL.revokeObjectURL(objectUrl)

      const { width, height } = img
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const targetW = Math.max(1, Math.round(width * scale))
      const targetH = Math.max(1, Math.round(height * scale))

      if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
        return file
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error('Failed to create blob from canvas'))),
          'image/jpeg',
          quality,
        )
      })

      return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-compressed.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } catch {
      return file
    }
  }

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const result = String(fr.result || '')
      const base64 = result.startsWith('data:') ? result.split(',')[1] : result
      resolve(base64)
    }
    fr.onerror = reject
    fr.readAsDataURL(file)
  })

  const buildRegionConstraints = (hazards: any[]): string => {
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

  const drawOverlayFromHazards = async (imageFile: File, hazards: any[]): Promise<string> => {
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

      const colorFor = (t: string) => {
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
        const anyH: any = h
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

  // Auto-generate processed images when original image selected
  useEffect(() => {
    const run = async () => {
      if (!originalImageFile) return
      const key = `${originalImageFile.name}:${originalImageFile.size}:${originalImageFile.lastModified}`
      if (lastAutoGenKey.current === key) return
      lastAutoGenKey.current = key
      setAutoGenError(null)
      setAutoGenLoading(true)
      try {
        // 1) analyze via API (Gemini) to get hazards (and optional bbox)
        const base64 = await fileToBase64(await compressImage(originalImageFile))
        const res = await fetch('/api/hazard-game/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
        })
        let hazards: any[] = []
        if (res.ok) {
          const data = await res.json()
          hazards = Array.isArray(data.hazards) ? data.hazards : []
          setLastHazards(hazards)
        } else {
          console.warn('hazard analysis failed, proceeding with heuristics')
        }

        // 2) generate prompts (risk observation + viz + simulations)
        let prLocal: { vizPrompt?: string; simulationPrompts?: any; riskObservation?: any } | null = null
        try {
          const pRes = await fetch('/api/gemini/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 })
          })
          if (pRes.ok) {
            const pjson = await pRes.json()
            const pr = pjson?.prompts
            if (pr) {
              setGeneratedPrompts({
                vizPrompt: pr.vizPrompt,
                simulationPrompts: pr.simulationPrompts,
                riskObservationTable: pr.riskObservation?.tableMarkdown,
              })
              prLocal = pr
            }
          } else {
            console.warn('generate-prompts failed', await pRes.text())
          }
        } catch (e) {
          console.warn('generate-prompts error', e)
        }

        // 3) visualization overlay (local fallback always available)
        const overlayUrl = await drawOverlayFromHazards(originalImageFile, hazards)
        const overlayFile = await dataUrlToFile(overlayUrl, 'overlay.png')
        setProcessedImageFiles(prev => [...prev, overlayFile])
        setProcessedImagePreviews(prev => [...prev, overlayUrl])

        // 4) simple local simulations (flood/fire/typhoon/earthquake)
        const [floodUrl, fireUrl, typhoonUrl, quakeUrl] = await Promise.all([
          simulateVariant(originalImageFile, 'flood'),
          simulateVariant(originalImageFile, 'fire'),
          simulateVariant(originalImageFile, 'typhoon'),
          simulateVariant(originalImageFile, 'earthquake'),
        ])
        const toFiles = await Promise.all([
          dataUrlToFile(floodUrl, 'flood.png'),
          dataUrlToFile(fireUrl, 'fire.png'),
          dataUrlToFile(typhoonUrl, 'typhoon.png'),
          dataUrlToFile(quakeUrl, 'earthquake.png'),
        ])
        setProcessedImageFiles(prev => [...prev, ...toFiles])
        setProcessedImagePreviews(prev => [...prev, floodUrl, fireUrl, typhoonUrl, quakeUrl])

        // 5) NanoBanana (Gemini 2.5 Flash) image-to-image generation using generated prompts
        try {
          const fd = new FormData()
          fd.append('image', originalImageFile)
          const baseViz = prLocal?.vizPrompt || generatedPrompts?.vizPrompt || "Photorealistic 2K infographic from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo. Overlay semi-transparent hazard markings and Japanese labels: collapsed fence (red shade + exclamation icons, label 'フェンス倒壊'), fallen utility pole (red circle + arrow, label '電柱倒壊'), flooding (blue shade + droplet icon, label '冠水'), fire spread (orange flame icon, label '延焼'). Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names."
          const englishPrompt = `${baseViz}\n${buildRegionConstraints(hazards)}`
          fd.append('prompt', englishPrompt)
          const genRes = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd })
          if (genRes.ok) {
            const gen = await genRes.json()
            const imgs = Array.isArray(gen.images) ? gen.images : []
            if (imgs.length > 0) {
              const files = await Promise.all(
                imgs.slice(0, 2).map(async (im: any, i: number) => dataUrlToFile(im.dataUrl, `nanobanana-${i}.png`))
              )
              setProcessedImageFiles(prev => [...prev, ...files])
              setProcessedImagePreviews(prev => [...prev, ...imgs.slice(0, 2).map((im: any) => im.dataUrl)])
            }
          } else {
            const t = await genRes.text()
            console.warn('gemini generate-image failed', genRes.status, t)
          }
        } catch (e) {
          console.warn('nanobanana generation skipped due to error', e)
        }

        // 6) Post-disaster simulation prompts → AI images
        const simsLocal = prLocal?.simulationPrompts || generatedPrompts?.simulationPrompts
        if (simsLocal) {
          try {
            const make = async (prompt: string, suffix: string) => {
              const fd = new FormData()
              fd.append('image', originalImageFile)
              fd.append('prompt', prompt)
              const r = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd })
              if (!r.ok) return null
              const j = await r.json()
              const im = Array.isArray(j.images) && j.images[0] ? j.images[0] : null
              if (!im) return null
              const f = await dataUrlToFile(im.dataUrl, `nanobanana-${suffix}.png`)
              return { file: f, url: im.dataUrl }
            }
            const sims = simsLocal
            const results = await Promise.all([
              make(sims.earthquake, 'earthquake'),
              make(sims.typhoon, 'typhoon'),
              make(sims.flood, 'flood'),
              make(sims.fire, 'fire'),
            ])
            const ok = results.filter(Boolean) as { file: File; url: string }[]
            if (ok.length) {
              setProcessedImageFiles(prev => [...prev, ...ok.map(o => o.file)])
              setProcessedImagePreviews(prev => [...prev, ...ok.map(o => o.url)])
            }
          } catch (e) {
            console.warn('simulation AI generation error', e)
          }
        }
      
        // Switch to processed tab for user to pick
        setActiveImageTab('processed')
      } catch (e) {
        console.error('auto-generation failed', e)
        setAutoGenError(e instanceof Error ? e.message : '不明なエラー')
      } finally {
        setAutoGenLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageFile])

  // On-demand regenerate using selected situation
  const regenerateSituation = async () => {
    if (!originalImageFile) return
    try {
      setRegenLoading(true)
      let prompt = ''
      let pr: any = generatedPrompts
      if (!pr) {
        // lazily fetch prompts
        const base64 = await fileToBase64(await compressImage(originalImageFile))
        const pRes = await fetch('/api/gemini/generate-prompts', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ imageBase64: base64 })
        })
        if (pRes.ok) {
          const pjson = await pRes.json()
          pr = pjson?.prompts
          if (pr) {
            setGeneratedPrompts({
              vizPrompt: pr.vizPrompt,
              simulationPrompts: pr.simulationPrompts,
              riskObservationTable: pr.riskObservation?.tableMarkdown,
            })
          }
        }
      }
      if (situation === 'viz') prompt = pr?.vizPrompt || ''
      else if (situation === 'earthquake') prompt = pr?.simulationPrompts?.earthquake || ''
      else if (situation === 'typhoon') prompt = pr?.simulationPrompts?.typhoon || ''
      else if (situation === 'flood') prompt = pr?.simulationPrompts?.flood || ''
      else if (situation === 'fire') prompt = pr?.simulationPrompts?.fire || ''

      if (!prompt) {
        setAutoGenError('プロンプト生成に失敗しました。再度お試しください。')
        return
      }

      const fd = new FormData()
      fd.append('image', originalImageFile)
      const withRegions = situation === 'viz' ? `${prompt}\n${buildRegionConstraints(lastHazards)}` : prompt
      fd.append('prompt', withRegions)
      const res = await fetch('/api/gemini/generate-image', { method: 'POST', body: fd })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`再生成に失敗しました: ${res.status} ${res.statusText} - ${t}`)
      }
      const j = await res.json()
      const imgs = Array.isArray(j.images) ? j.images : []
      const ok = imgs.slice(0, 2)
      if (ok.length) {
        const files = await Promise.all(ok.map((im: any, idx: number) => dataUrlToFile(im.dataUrl, `regen-${situation}-${idx}.png`)))
        setProcessedImageFiles(prev => [...prev, ...files])
        setProcessedImagePreviews(prev => [...prev, ...ok.map((im: any) => im.dataUrl)])
      }
      setActiveImageTab('processed')
    } catch (e) {
      setAutoGenError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setRegenLoading(false)
    }
  }

  // 画像選択ハンドラー（加工画像）
  const handleProcessedImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // ファイルサイズとタイプの検証
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "エラー",
          description: `${file.name}のサイズが10MBを超えています。`,
          variant: "destructive",
        })
        return false
      }
      if (!file.type.startsWith("image/")) {
        toast({
          title: "エラー",
          description: `${file.name}は画像ファイルではありません。`,
          variant: "destructive",
        })
        return false
      }
      return true
    })

    if (validFiles.length > 0) {
      // プレビューURLを生成して配列に追加
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file))
      setProcessedImageFiles((prev) => [...prev, ...validFiles])
      setProcessedImagePreviews((prev) => [...prev, ...newPreviews])
      // 手動選択時も自動で「加工画像」タブへ切り替え
      setActiveImageTab("processed")
      setCameraError(null) // エラーをクリア
    }
  }

  // 画像アップロード処理
  const uploadImage = async (file: File, type: "original" | "processed"): Promise<string | null> => {
    try {
      // ファイル名を一意にするために現在のタイムスタンプを追加
      const timestamp = Date.now()
      const fileExt = file.name.split(".").pop()
      const fileName = `${timestamp}-${Math.random().toString(36).substring(2, 15)}-${type}.${fileExt}`
      const filePath = `danger-reports/${fileName}`

      // アップロードの進捗を監視するためのコールバック
      const onUploadProgress = (progress: number) => {
        setUploadProgress(progress)
      }

      // 画像をアップロード
      const { data, error } = await supabase.storage.from("danger-reports").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        console.error(`Error uploading ${type} image:`, error)
        toast({
          title: "画像アップロードエラー",
          description: error.message,
          variant: "destructive",
        })
        return null
      }

      // 公開URLを取得
      const { data: publicUrlData } = supabase.storage.from("danger-reports").getPublicUrl(filePath)

      // キャッシュバスターを追加
      const publicUrl = `${publicUrlData.publicUrl}?t=${timestamp}`

      console.log(`${type} image uploaded successfully:`, publicUrl)
      return publicUrl
    } catch (error) {
      console.error(`Error in upload${type}Image:`, error)
      toast({
        title: "画像アップロードエラー",
        description: "画像のアップロード中にエラーが発生しました。",
        variant: "destructive",
      })
      return null
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

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      // 報告データの準備
      let uploadedProcessedImageUrls: (string | null)[] = []
      if (processedImageFiles.length > 0) {
        uploadedProcessedImageUrls = await Promise.all(
          processedImageFiles.map((file) => uploadImage(file, "processed"))
        )
      }

      const reportData: Partial<DangerReport> = {
        title,
        description: description || null,
        danger_type: dangerType,
        danger_level: dangerLevel,
        latitude: selectedLocation[1],
        longitude: selectedLocation[0],
        status: "pending", // 初期ステータスは審査中
        processed_image_urls: uploadedProcessedImageUrls.filter(Boolean) as string[],
      }

      // 元画像がある場合はアップロード
      if (originalImageFile) {
        const imageUrl = await uploadImage(originalImageFile, "original")
        if (imageUrl) {
          reportData.image_url = imageUrl
        }
      }

      // 親コンポーネントの送信ハンドラーを呼び出し
      onSubmit(reportData)
    } catch (error) {
      console.error("Error submitting report:", error)
      toast({
        title: "エラー",
        description: "報告の送信中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 画像削除ハンドラー（元画像）
  const handleRemoveOriginalImage = () => {
    setOriginalImageFile(null)
    setOriginalImagePreview(null)
    if (originalFileInputRef.current) {
      originalFileInputRef.current.value = ""
    }
  }

  // 画像削除ハンドラー（加工画像）
  const handleRemoveProcessedImage = (index: number) => {
    setProcessedImageFiles((prev) => prev.filter((_, i) => i !== index))
    setProcessedImagePreviews((prev) => prev.filter((_, i) => i !== index))
    if (processedFileInputRef.current) {
      processedFileInputRef.current.value = ""
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
    <div className="p-3">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">危険箇所の報告</h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="title">タイトル</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="危険箇所の名前や特徴"
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
                    onClick={() => handleCameraAccess(originalFileInputRef, 'original')}
                    disabled={isCameraLoading}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    {isCameraLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
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
                  <div className="relative mt-2 border rounded-md overflow-hidden">
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
                      className="absolute top-2 right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveOriginalImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
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
                    onClick={() => handleCameraAccess(processedFileInputRef, 'processed')}
                    disabled={isCameraLoading}
                    className="flex-1 min-h-[48px] touch-manipulation"
                  >
                    {isCameraLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
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
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <label className="text-sm text-gray-700">シチュエーション:</label>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={situation}
                    onChange={(e) => setSituation(e.target.value as any)}
                  >
                    <option value="viz">ハザード可視化</option>
                    <option value="earthquake">地震後</option>
                    <option value="typhoon">台風後（強風）</option>
                    <option value="flood">冠水</option>
                    <option value="fire">火災後</option>
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={regenerateSituation} disabled={regenLoading || !originalImageFile}>
                    {regenLoading ? '再生成中...' : 'この条件で再生成'}
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
                      <div key={idx} className="relative border rounded-md overflow-hidden min-w-[150px]">
                        <div className="relative w-full h-32 cursor-pointer" onClick={() => handleShowPreview(preview)}>
                          <NextImage
                            src={preview}
                            alt={`加工画像 ${idx + 1}`}
                            fill
                            className="object-cover"
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
                          className="absolute top-2 right-2 h-6 w-6 rounded-full"
                          onClick={() => handleRemoveProcessedImage(idx)}
                        >
                          <X className="h-3 w-3" />
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

        {selectedLocation ? (
          <div className="text-sm text-blue-600">
            選択位置: 緯度 {selectedLocation[1].toFixed(6)}, 経度 {selectedLocation[0].toFixed(6)}
          </div>
        ) : (
          <div className="text-sm text-red-600">地図上で位置を選択してください</div>
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting || !selectedLocation} className="min-w-[100px]">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : "送信中..."}
              </>
            ) : (
              "報告を送信"
            )}
          </Button>
        </div>
      </form>

      <ImagePreviewDialog isOpen={isPreviewOpen} imageUrl={previewImage} onClose={() => setIsPreviewOpen(false)} />
    </div>
  )
}






