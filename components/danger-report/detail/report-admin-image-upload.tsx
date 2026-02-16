"use client"

import type React from "react"
import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Camera, Loader2, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import type { DangerReport } from "@/lib/types"

interface ReportAdminImageUploadProps {
  report: DangerReport
  isAdmin: boolean
  onProcessedUrlsChange?: (urls: string[]) => void
}

/**
 * Admin-only collapsible section for uploading, replacing, and deleting processed images.
 * Extracted from the main modal to reduce its complexity.
 */
export function ReportAdminImageUpload({
  report,
  isAdmin,
  onProcessedUrlsChange,
}: ReportAdminImageUploadProps) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newPreview, setNewPreview] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number | null>(null)

  if (!isAdmin) return null

  const validateFile = (file: File): boolean => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "エラー",
        description: "画像サイズは10MB以下にしてください。",
        variant: "destructive",
      })
      return false
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "エラー",
        description: "画像ファイルを選択してください。",
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !validateFile(file)) return

    setNewFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setNewPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveNewImage = () => {
    setNewFile(null)
    setNewPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadProcessedImage = async () => {
    if (!newFile || !supabase) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", newFile)
      formData.append("reportId", report.id)

      const response = await fetch("/api/image/process", {
        method: "POST",
        body: formData,
      })

      let responseData: { message?: string; updatedUrls?: string[] } = {}
      try {
        responseData = await response.json()
      } catch {
        responseData = {}
      }

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to update report with processed image")
      }

      if (Array.isArray(responseData.updatedUrls)) {
        onProcessedUrlsChange?.(responseData.updatedUrls)
      }

      toast({
        title: "アップロード成功",
        description: "加工画像がアップロードされ、レポートが更新されました。",
      })

      setNewFile(null)
      setNewPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "画像の処理中にエラーが発生しました。"
      toast({
        title: "画像アップロード/更新エラー",
        description: message,
        variant: "destructive",
      })
      setNewFile(null)
      setNewPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } finally {
      setIsUploading(false)
    }
  }

  const deleteProcessedImage = async (imageUrlToDelete: string) => {
    if (!supabase) return

    const confirmation = confirm("この加工画像を削除してもよろしいですか？この操作は元に戻せません。")
    if (!confirmation) return

    setIsUploading(true)
    try {
      const currentUrls = report.processed_image_urls ?? []
      const updatedUrls = currentUrls.filter((url) => url !== imageUrlToDelete)

      const { error: updateDbError } = await supabase
        .from("danger_reports")
        .update({
          processed_image_urls: updatedUrls,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id)

      if (updateDbError) throw updateDbError

      onProcessedUrlsChange?.(updatedUrls)

      // Attempt storage cleanup
      try {
        const urlParts = new URL(imageUrlToDelete)
        const storagePath = decodeURIComponent(urlParts.pathname.substring(1))
        const pathSegments = storagePath.split("/")
        if (pathSegments.length > 4 && pathSegments[3] === "public") {
          const bucketName = pathSegments[4]
          const filePath = pathSegments.slice(5).join("/")
          if (bucketName === "danger-reports" && filePath) {
            await supabase.storage.from(bucketName).remove([filePath])
          }
        }
      } catch {
        // Storage cleanup failure is non-critical
      }

      toast({ title: "削除成功", description: "加工画像が削除されました。" })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "画像の削除中にエラーが発生しました。"
      toast({
        title: "削除エラー",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleReplaceImage = async (file: File) => {
    if (replaceTargetIndex === null || !supabase) return
    if (!validateFile(file)) return

    setIsUploading(true)
    try {
      const ts = Date.now()
      const ext = file.name.split(".").pop()
      const name = `${report.id}-${ts}-${Math.random().toString(36).substring(2, 15)}-processed.${ext}`
      const path = `danger-reports/${name}`

      const { error: upErr } = await supabase.storage
        .from("danger-reports")
        .upload(path, file, { cacheControl: "3600", upsert: false })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from("danger-reports").getPublicUrl(path)
      const newUrl = pub?.publicUrl
      if (!newUrl) throw new Error("公開URLの取得に失敗しました")

      const current = report.processed_image_urls ?? []
      const oldUrl = current[replaceTargetIndex]
      const next = [...current]
      next[replaceTargetIndex] = newUrl

      const { error: dbErr } = await supabase
        .from("danger_reports")
        .update({
          processed_image_urls: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id)
      if (dbErr) throw dbErr

      onProcessedUrlsChange?.(next)

      // Clean up old file from storage
      try {
        const u = new URL(oldUrl)
        const sp = decodeURIComponent(u.pathname.substring(1))
        const seg = sp.split("/")
        if (seg.length > 4 && seg[3] === "public") {
          const bucket = seg[4]
          const oldPath = seg.slice(5).join("/")
          if (bucket === "danger-reports" && oldPath) {
            await supabase.storage.from(bucket).remove([oldPath])
          }
        }
      } catch {
        // Old file cleanup failure is non-critical
      }

      toast({ title: "差し替え完了", description: "画像を変更しました。" })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "画像の差し替えに失敗しました"
      toast({
        title: "差し替えエラー",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setReplaceTargetIndex(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ""
    }
  }

  const currentProcessedUrls = report.processed_image_urls ?? []

  return (
    <div className="px-4 md:px-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-gray-500 hover:text-gray-700">
            <span className="text-xs">管理者: 画像を管理</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Existing processed images management */}
          {currentProcessedUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">登録済み加工画像 ({currentProcessedUrls.length})</p>
              {currentProcessedUrls.map((url, idx) => (
                <div key={url} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  <span className="text-xs text-gray-600 shrink-0">#{idx + 1}</span>
                  <span className="text-xs text-gray-500 truncate flex-1">{url.split("/").pop()}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setReplaceTargetIndex(idx)
                      replaceInputRef.current?.click()
                    }}
                    disabled={isUploading}
                    title="画像を差し替え"
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => deleteProcessedImage(url)}
                    disabled={isUploading}
                    title="削除"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* New image preview */}
          {newPreview && (
            <div className="relative border border-dashed border-blue-400 rounded-md p-2">
              <Image
                src={newPreview}
                alt="新規加工画像プレビュー"
                width={400}
                height={200}
                className="w-full h-auto max-h-40 object-contain rounded"
              />
              <p className="text-xs text-center text-blue-600 mt-1">新規追加プレビュー</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-5 w-5"
                onClick={handleRemoveNewImage}
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Upload controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              ファイル選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs"
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              カメラ撮影
            </Button>
            {newFile && (
              <Button
                size="sm"
                onClick={uploadProcessedImage}
                disabled={isUploading || !newFile}
                className="text-xs"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                アップロード
              </Button>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={replaceInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleReplaceImage(file)
            }}
            className="hidden"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
