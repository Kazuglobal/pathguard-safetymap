"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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

  const [riskAnalysis, setRiskAnalysis] = useState<any[] | null>(null)

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

    // プレビュー用のURLを作成
    const reader = new FileReader()
    reader.onload = (e) => {
      setOriginalImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 画像選択ハンドラー（加工画像）
  const handleProcessedImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      // プレビューURLを生成して配列に追加
      const newPreviews = files.map((file) => URL.createObjectURL(file))
      setProcessedImageFiles((prev) => [...prev, ...files])
      setProcessedImagePreviews((prev) => [...prev, ...newPreviews])
      // 手動選択時も自動で「加工画像」タブへ切り替え
      setActiveImageTab("processed")
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

  // カメラ起動ハンドラー（元画像）
  const handleOriginalCameraCapture = () => {
    if (originalFileInputRef.current) {
      originalFileInputRef.current.click()
    }
  }

  // カメラ起動ハンドラー（加工画像）
  const handleProcessedCameraCapture = () => {
    if (processedFileInputRef.current) {
      processedFileInputRef.current.click()
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
                    onClick={() => originalFileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    画像を選択
                  </Button>
                  <Button type="button" variant="outline" onClick={handleOriginalCameraCapture} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    カメラで撮影
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleOriginalImageSelect}
                    className="hidden"
                    ref={originalFileInputRef}
                  />
                </div>

                {originalImagePreview ? (
                  <div className="relative mt-2 border rounded-md overflow-hidden">
                    <img
                      src={originalImagePreview || "/placeholder.svg?height=200&width=400"}
                      alt="選択された元画像"
                      className="w-full h-32 object-cover cursor-pointer"
                      onClick={() => handleShowPreview(originalImagePreview)}
                    />
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
                    onClick={() => processedFileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    画像を選択
                  </Button>
                  <Button type="button" variant="outline" onClick={handleProcessedCameraCapture} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    カメラで撮影
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleProcessedImageSelect}
                    className="hidden"
                    ref={processedFileInputRef}
                    multiple
                  />
                </div>

                {processedImagePreviews.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto mt-2">
                    {processedImagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative border rounded-md overflow-hidden min-w-[150px]">
                        <img
                          src={preview}
                          alt={`加工画像 ${idx + 1}`}
                          className="w-full h-32 object-cover cursor-pointer"
                          onClick={() => handleShowPreview(preview)}
                          // ★ ここを追加: 読み込み失敗時にエラートースト＆プレースホルダー表示
                          onError={(e) => {
                            e.currentTarget.onerror = null;  // ループ防止
                            e.currentTarget.src = "/placeholder.svg?height=200&width=400";
                            toast({
                              title: "エラー",
                              description: "加工画像の読み込みに失敗しました",
                              variant: "destructive",
                            });
                          }}
                        />
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
