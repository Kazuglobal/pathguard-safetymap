"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { X, MapPin, Calendar, AlertTriangle, ExternalLink, ImageIcon, Upload, Camera, Loader2, Car, Shield, HelpCircle, Trash2, Eye } from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import { useLongPress } from "@/hooks/use-long-press"
import { isValidCoordinates } from "@/lib/coordinates"
import { ImageZoomOverlay } from "@/components/ui/image-zoom-overlay"
import { AccidentStatsPanel, AccidentStatsLoading } from "@/components/danger-report/accident-stats-panel"
import { useAccidentStats } from "@/hooks/use-accident-stats"

interface ShowImageOptions {
  reportId?: string
  reportTitle?: string | null
  type?: "original" | "processed"
  index?: number
}

interface DangerReportDetailModalProps {
  isOpen: boolean
  onClose: () => void
  report: DangerReport | null
  isAdmin?: boolean
  onShowImage?: (url: string, coords?: [number, number], options?: ShowImageOptions) => void
  onAccidentNavigate?: (coords: [number, number]) => void
}

export default function DangerReportDetailModal({
  isOpen,
  onClose,
  report,
  isAdmin = false,
  onShowImage,
  onAccidentNavigate,
}: DangerReportDetailModalProps) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [activeImageTab, setActiveImageTab] = useState<string>("original")
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null)
  const [originalImageError, setOriginalImageError] = useState(false)
  const [processedImageErrors, setProcessedImageErrors] = useState<boolean[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [newProcessedImageFile, setNewProcessedImageFile] = useState<File | null>(null)
  const [newProcessedImagePreview, setNewProcessedImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 差し替え用の入力
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number | null>(null)

  // 長押し拡大表示用
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

  // 事故統計データ取得
  const { stats, status: statsStatus, fetchStats, error: statsError, reset: resetAccidentStats } = useAccidentStats()

  // report.processed_image_urls を直接利用するヘルパー
  const currentProcessedUrls = report?.processed_image_urls || []

  // 報告データが変更されたときに画像URL等を更新
  useEffect(() => {
    if (report) {
      setOriginalImageSrc(report.image_url)
      setOriginalImageError(false)

      // processedImageUrls のエラー状態配列を初期化
      setProcessedImageErrors((report.processed_image_urls || []).map(() => false));

      setNewProcessedImageFile(null)
      setNewProcessedImagePreview(null)

      // 利用可能な画像に基づいてデフォルトのタブを設定
      if (report.image_url) {
        setActiveImageTab("original")
      } else if ((report.processed_image_urls || []).length > 0) {
        setActiveImageTab("processed")
      }
    }
  }, [report])

  // 事故統計を取得
  useEffect(() => {
    // Clear stale stats whenever the report target changes.
    resetAccidentStats()
    if (report?.latitude == null || report?.longitude == null) return

    fetchStats({
      latitude: report.latitude,
      longitude: report.longitude,
      radius_meters: 300,  // 300m radius
      years: 5,            // Past 5 years
    })
  }, [report?.id, report?.latitude, report?.longitude, fetchStats, resetAccidentStats])

  if (!report) return null

  // 画像選択ハンドラー
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setNewProcessedImageFile(file)

    // プレビュー用のURLを作成
    const reader = new FileReader()
    reader.onload = (e) => {
      setNewProcessedImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 画像アップロード処理
  const uploadProcessedImage = async () => {
    if (!newProcessedImageFile || !report || !supabase) return

    setIsUploading(true)
    setUploadProgress(0) // 進捗表示が必要な場合は別途実装

    try {
      const timestamp = Date.now()
      const fileExt = newProcessedImageFile.name.split(".").pop()
      const fileName = `${report.id}-${timestamp}-${Math.random().toString(36).substring(2, 15)}-processed.${fileExt}`
      const filePath = `danger-reports/${fileName}`

      // 画像をストレージにアップロード
      const { error: uploadError } = await supabase.storage
        .from("danger-reports")
        .upload(filePath, newProcessedImageFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 公開URLを取得
      const { data: publicUrlData } = supabase.storage
        .from("danger-reports")
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl

      // API ルート /api/image/process を呼び出してDBを更新
      // formData を作成
      const formData = new FormData();
      formData.append('file', newProcessedImageFile); // ファイル情報も送る（API側で利用する場合）
      formData.append('reportId', report.id);

      const response = await fetch('/api/image/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update report with processed image');
      }

      const result = await response.json();

      // 成功メッセージ
      toast({
        title: "アップロード成功",
        description: "加工画像がアップロードされ、レポートが更新されました。",
      })

      // 状態をクリア（親コンポーネントからの report 更新に任せる）
      setNewProcessedImageFile(null)
      setNewProcessedImagePreview(null)
      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
      // 必要であれば onClose() を呼び出してモーダルを閉じるか、
      // 親コンポーネントに更新を通知して report を再取得させる
      // 例: onClose(); // または親の更新関数を呼ぶ

    } catch (error: any) {
      console.error("Error uploading/updating processed image:", error)
      toast({
        title: "画像アップロード/更新エラー",
        description: error.message || "画像の処理中にエラーが発生しました。",
        variant: "destructive",
      })
      // エラー発生時もフォームをクリア
       setNewProcessedImageFile(null)
       setNewProcessedImagePreview(null)
       if (fileInputRef.current) {
          fileInputRef.current.value = "";
       }
    } finally {
      setIsUploading(false)
    }
  }

  // 既存の加工画像を削除する関数 (管理者用)
  const deleteProcessedImage = async (imageUrlToDelete: string) => {
    if (!report || !supabase || !isAdmin) return;

    const confirmation = confirm("この加工画像を削除してもよろしいですか？この操作は元に戻せません。");
    if (!confirmation) return;

    setIsUploading(true); // 処理中表示を利用

    try {
      // 1. DBからURLを削除
      const currentUrls = report.processed_image_urls || [];
      const updatedUrls = currentUrls.filter(url => url !== imageUrlToDelete);

      const { error: updateDbError } = await supabase
        .from('danger_reports')
        .update({ processed_image_urls: updatedUrls, updated_at: new Date().toISOString() })
        .eq('id', report.id);

      if (updateDbError) throw updateDbError;

      // 2. ストレージからファイルを削除 (URLからファイルパスを抽出)
      try {
        const urlParts = new URL(imageUrlToDelete);
        // パス名の先頭のスラッシュを除去し、デコードする
        const storagePath = decodeURIComponent(urlParts.pathname.substring(1));
        // パスが `storage/v1/object/public/` で始まる場合、それ以降の部分を取得
        const pathSegments = storagePath.split('/');
        if (pathSegments.length > 4 && pathSegments[3] === 'public') {
            const bucketName = pathSegments[4];
            const filePath = pathSegments.slice(5).join('/');

            if (bucketName === 'danger-reports') {
               console.log(`Attempting to delete from storage: ${filePath}`);
               const { error: storageError } = await supabase.storage
                 .from(bucketName)
                 .remove([filePath]);
               if (storageError) {
                 // ストレージ削除エラーはログに残すが、処理は続行（DB更新は成功しているため）
                 console.error("Error deleting image from storage:", storageError);
                 toast({
                    title: "ストレージ削除エラー",
                    description: `DBの更新は成功しましたが、ストレージからのファイル削除に失敗しました: ${storageError.message}`,
                    variant: "default",
                 });
               } else {
                 console.log(`Successfully deleted from storage: ${filePath}`);
               }
            } else {
                 console.warn(`Skipping storage deletion for bucket: ${bucketName}`);
            }
        } else {
             console.warn("Could not determine storage path from URL:", imageUrlToDelete);
        }
      } catch (e) {
        console.error("Error processing URL for storage deletion:", e);
      }

      toast({ title: "削除成功", description: "加工画像が削除されました。" });
      // 状態更新は親コンポーネントからの report 更新に任せる
       // 必要であれば onClose();

    } catch (error: any) {
      console.error("Error deleting processed image:", error);
      toast({
        title: "削除エラー",
        description: error.message || "画像の削除中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
       setIsUploading(false);
    }
  };

  const getDangerTypeLabel = (type: string) => {
    switch (type) {
      case "traffic":
        return "交通危険"
      case "crime":
        return "犯罪危険"
      case "disaster":
        return "災害危険"
      case "other":
        return "その他"
      default:
        return type
    }
  }

  const getDangerLevelClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-green-100 text-green-800 border-green-200"
      case 2:
        return "bg-lime-100 text-lime-800 border-lime-200"
      case 3:
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case 4:
        return "bg-orange-100 text-orange-800 border-orange-200"
      case 5:
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const hasImages = report.image_url || currentProcessedUrls.length > 0 || newProcessedImagePreview

  // 画像URLにキャッシュバスターを追加する関数
  const addCacheBuster = (url: string | null) => {
    if (!url) return null
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}t=${Date.now()}`
  }

  // カメラ起動ハンドラー
  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // 画像削除ハンドラー
  const handleRemoveNewImage = () => {
    setNewProcessedImageFile(null)
    setNewProcessedImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* 種類アイコン表示 */}
            {report.danger_type === 'traffic' && <Car className="h-5 w-5 text-gray-600" />}
            {report.danger_type === 'crime' && <Shield className="h-5 w-5 text-gray-600" />}
            {report.danger_type === 'disaster' && <AlertTriangle className="h-5 w-5 text-gray-600" />}
            {report.danger_type === 'other' && <HelpCircle className="h-5 w-5 text-gray-600" />}
            {/* 危険度カラー */}
            <div
              className={`w-4 h-4 rounded-full ${
                report.danger_level === 1
                  ? "bg-green-400"
                  : report.danger_level === 2
                    ? "bg-lime-400"
                    : report.danger_level === 3
                      ? "bg-yellow-400"
                      : report.danger_level === 4
                        ? "bg-orange-400"
                        : "bg-red-400"
              }`}
            />
            <DialogTitle className="text-xl">{report.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">危険箇所レポートの詳細情報と画像</DialogDescription>
          <DialogClose asChild>
             <Button variant="ghost" size="icon" className="h-8 w-8">
               <X className="h-4 w-4" />
             </Button>
           </DialogClose>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="md:col-span-2 space-y-4">
            {/* 説明 */}
            {report.description && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                </CardContent>
              </Card>
            )}

            {/* 画像表示エリア */}
            {hasImages ? (
              <Card>
                <CardContent className="p-4">
                  <Tabs
                    value={activeImageTab}
                    onValueChange={setActiveImageTab}
                    defaultValue={report.image_url ? "original" : "processed"}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="original" disabled={!report.image_url}>
                        元画像
                      </TabsTrigger>
                      <TabsTrigger value="processed" disabled={!isAdmin && currentProcessedUrls.length === 0 && !newProcessedImagePreview}>
                        加工画像 {currentProcessedUrls.length > 0 && `(${currentProcessedUrls.length})`}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="original" className="mt-4">
                      {originalImageSrc && !originalImageError ? (
                        <OriginalImageWithLongPress
                          src={addCacheBuster(originalImageSrc) || "/placeholder.svg"}
                          onZoom={() => setZoomImageUrl(addCacheBuster(originalImageSrc) || originalImageSrc!)}
                          onError={() => setOriginalImageError(true)}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 md:h-80 bg-gray-100 rounded-md">
                          <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">
                            {originalImageError ? "元画像の読み込み失敗" : "元画像はありません"}
                          </p>
                          {originalImageError && originalImageSrc && (
                            <Button
                              variant="outline" size="sm" className="mt-2"
                              onClick={() => setOriginalImageError(false)} // 再試行はエラーフラグをリセット
                            >
                              再試行
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="processed" className="mt-4">
                      {/* --- ▼▼▼ AI生成注意書きを修正 ▼▼▼ --- */}
                      <p className="text-xs text-gray-600 mb-3">注: 加工画像は生成AIによって作成されており、実際の状況と異なる場合もございます。</p>
                      {/* --- ▲▲▲ AI生成注意書きを修正 ▲▲▲ --- */}
                      {/* 既存の加工画像 + 新規プレビュー */}
                      {(currentProcessedUrls.length > 0 || newProcessedImagePreview) ? (
                        <div className="space-y-3">
                          {/* 既存画像のリスト */}
                          {currentProcessedUrls.map((url, idx) => (
                             <div key={url} className="relative group border rounded-md p-2">
                                {!processedImageErrors[idx] ? (
                                  <ProcessedImageWithLongPress
                                    src={addCacheBuster(url) || "/placeholder.svg"}
                                    idx={idx}
                                    onZoom={() => setZoomImageUrl(addCacheBuster(url) || url)}
                                    onError={() => setProcessedImageErrors(prev => {
                                        const next = [...prev];
                                        next[idx] = true;
                                        return next;
                                    })}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-40 bg-gray-100 rounded">
                                     <ImageIcon className="h-8 w-8 text-gray-400" />
                                     <p className="text-xs text-gray-500 mt-1">読み込み失敗</p>
                                     <Button
                                        variant="outline" size="sm" className="mt-1"
                                        onClick={() => setProcessedImageErrors(prev => {
                                            const next = [...prev];
                                            next[idx] = false;
                                            return next;
                                        })}
                                     >
                                        再試行
                                     </Button>
                                  </div>
                                )}
                                {/* 管理者用の削除ボタン */}
                                <div className="absolute top-1 right-16 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      if (onShowImage && report) {
                                        onShowImage(url, [report.longitude, report.latitude], {
                                          reportId: report.id,
                                          reportTitle: report.title ?? null,
                                          type: "processed",
                                          index: idx,
                                        })
                                      }
                                    }}
                                    title="地図で表示"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                                {isAdmin && (
                                  <div className="absolute top-1 right-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        setReplaceTargetIndex(idx)
                                        replaceInputRef.current?.click()
                                      }}
                                      disabled={isUploading}
                                      title="画像を差し替え"
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {isAdmin && (
                                    <Button
                                       variant="destructive"
                                       size="icon"
                                       className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                       onClick={() => deleteProcessedImage(url)}
                                       disabled={isUploading}
                                     >
                                       <Trash2 className="h-4 w-4" />
                                     </Button>
                                )}
                             </div>
                           ))}
                           {/* 新規追加プレビュー */}
                           {newProcessedImagePreview && (
                              <div className="relative group border border-dashed border-blue-500 rounded-md p-2">
                                <div className="relative w-full max-h-80">
                                  <Image
                                    src={newProcessedImagePreview}
                                    alt="新規加工画像プレビュー"
                                    width={800}
                                    height={320}
                                    className="w-full h-auto max-h-80 object-contain rounded"
                                  />
                                </div>
                                <p className="text-xs text-center text-blue-600 mt-1">新規追加プレビュー</p>
                                <Button
                                   variant="ghost"
                                   size="icon"
                                   className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                   onClick={handleRemoveNewImage}
                                   disabled={isUploading}
                                 >
                                   <X className="h-4 w-4" />
                                 </Button>
                              </div>
                           )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 md:h-80 bg-gray-100 rounded-md">
                          <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">加工画像はありません</p>
                        </div>
                      )}

                      {/* 管理者用の加工画像アップロード */}
                      {isAdmin && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium mb-2">加工画像を追加</h4>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              ファイルを選択
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCameraCapture}
                              disabled={isUploading}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              カメラで撮影
                            </Button>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment" // モバイルで背面カメラを優先
                              ref={fileInputRef}
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                            {/* 差し替え用の隠しinput */}
                            <input
                              type="file"
                              accept="image/*"
                              ref={replaceInputRef}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file && replaceTargetIndex !== null) {
                                  ;(async () => {
                                    if (!report || !supabase || !isAdmin) return
                                    if (file.size > 10 * 1024 * 1024) { toast({ title: "エラー", description: "画像サイズは10MB以下にしてください。", variant: "destructive" }); return }
                                    if (!file.type.startsWith("image/")) { toast({ title: "エラー", description: "画像ファイルを選択してください。", variant: "destructive" }); return }
                                    setIsUploading(true)
                                    try {
                                      const ts = Date.now()
                                      const ext = file.name.split('.').pop()
                                      const name = `${report.id}-${ts}-${Math.random().toString(36).substring(2,15)}-processed.${ext}`
                                      const path = `danger-reports/${name}`
                                      const { error: upErr } = await supabase.storage.from('danger-reports').upload(path, file, { cacheControl: '3600', upsert: false })
                                      if (upErr) throw upErr
                                      const { data: pub } = supabase.storage.from('danger-reports').getPublicUrl(path)
                                      const newUrl = pub?.publicUrl
                                      if (!newUrl) throw new Error('公開URLの取得に失敗しました')
                                      const current = report.processed_image_urls || []
                                      const oldUrl = current[replaceTargetIndex]
                                      const next = [...current]; next[replaceTargetIndex] = newUrl
                                      const { error: dbErr } = await supabase.from('danger_reports').update({ processed_image_urls: next, updated_at: new Date().toISOString() }).eq('id', report.id)
                                      if (dbErr) throw dbErr
                                      try {
                                        const u = new URL(oldUrl)
                                        const sp = decodeURIComponent(u.pathname.substring(1))
                                        const seg = sp.split('/')
                                        if (seg.length > 4 && seg[3] === 'public') {
                                          const bucket = seg[4]
                                          const oldPath = seg.slice(5).join('/')
                                          if (bucket === 'danger-reports' && oldPath) { await supabase.storage.from(bucket).remove([oldPath]) }
                                        }
                                      } catch {}
                                      toast({ title: '差し替え完了', description: '画像を変更しました。' })
                                    } catch (err: any) {
                                      console.error('replace error:', err)
                                      toast({ title: '差し替えエラー', description: err?.message || '画像の差し替えに失敗しました', variant: 'destructive' })
                                    } finally {
                                      setIsUploading(false)
                                      setReplaceTargetIndex(null)
                                      if (replaceInputRef.current) replaceInputRef.current.value = ''
                                    }
                                  })()
                                }
                              }}
                              className="hidden"
                            />
                            {newProcessedImageFile && (
                              <Button
                                size="sm"
                                onClick={uploadProcessedImage}
                                disabled={isUploading || !newProcessedImageFile}
                              >
                                {isUploading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-2" />
                                )}
                                アップロード
                              </Button>
                            )}
                          </div>
                           {/* アップロード中のプログレスバー（必要なら） */}
                           {/* {isUploading && <Progress value={uploadProgress} className="mt-2 h-2" />} */}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                  <p className="text-gray-500">この報告には画像が添付されていません</p>

                  {/* 管理者用の加工画像アップロードコントロール */}
                  {isAdmin && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        加工画像を追加
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCameraCapture}
                        className="flex-1"
                        disabled={isUploading}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        カメラで撮影
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageSelect}
                        className="hidden"
                        ref={fileInputRef}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 事故統計パネル */}
            {report && (
              <Card>
                <CardContent className="p-4">
                  {statsStatus === 'loading' && <AccidentStatsLoading />}

                  {statsStatus === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm text-red-800">
                        ⚠️ 事故統計の取得に失敗しました
                      </p>
                      {statsError && (
                        <p className="text-xs text-red-600 mt-1">{statsError}</p>
                      )}
                    </div>
                  )}

                  {statsStatus === 'loaded' && stats && (
                    <AccidentStatsPanel
                      stats={stats}
                      mode="full"
                      onAccidentClick={(accident) => {
                        if (!onAccidentNavigate) return
                        if (typeof accident.latitude !== "number" || typeof accident.longitude !== "number") return
                        if (!isValidCoordinates(accident.latitude, accident.longitude)) return
                        onAccidentNavigate([accident.longitude, accident.latitude])
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* 地図上の位置を表示するリンク */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose()
                // 地図を該当位置に移動させる処理は親コンポーネントで実装
              }}
            >
              <MapPin className="mr-2 h-4 w-4" />
              地図上で位置を確認
            </Button>
          </div>

          {/* 詳細情報サイドバー */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">危険タイプ</h3>
                  <Badge variant="outline" className="bg-gray-100">
                    {getDangerTypeLabel(report.danger_type)}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">危険度</h3>
                  <Badge variant="outline" className={getDangerLevelClass(report.danger_level)}>
                    レベル {report.danger_level}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">報告日時</h3>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                    {formatDate(report.created_at)}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">座標</h3>
                  <div className="text-sm font-mono">
                    {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">ステータス</h3>
                  <Badge
                    variant="outline"
                    className={
                      report.status === "approved"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-yellow-100 text-yellow-800 border-yellow-200"
                    }
                  >
                    {report.status === "approved" ? "承認済み" : "審査中"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 注意事項 */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">注意事項</p>
                  <p>この情報は一般ユーザーからの報告に基づいています。状況は変化している可能性があります。</p>
                </div>
              </div>
            </div>

            {/* 外部リンク（例：Google Mapsで見る） */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Google Mapsで見る
            </a>
          </div>
        </div>
      </DialogContent>
      <ImageZoomOverlay
        src={zoomImageUrl || ""}
        alt="拡大画像"
        isOpen={!!zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
      />
    </Dialog>
  )
}

/** Helper: original image with long-press zoom */
function OriginalImageWithLongPress({
  src,
  onZoom,
  onError,
}: {
  src: string
  onZoom: () => void
  onError: () => void
}) {
  const handlers = useLongPress({ delay: 400, onLongPress: onZoom })
  return (
    <div
      className="relative w-full h-64 md:h-80 bg-gray-50 rounded-md overflow-hidden"
      {...handlers}
      style={{ WebkitTouchCallout: "none", userSelect: "none", touchAction: "manipulation" }}
    >
      <Image
        src={src}
        alt="危険箇所の元画像"
        fill
        className="object-contain"
        draggable={false}
        onError={onError}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] pointer-events-none">
        長押しで拡大
      </div>
    </div>
  )
}

/** Helper: processed image with long-press zoom */
function ProcessedImageWithLongPress({
  src,
  idx,
  onZoom,
  onError,
}: {
  src: string
  idx: number
  onZoom: () => void
  onError: () => void
}) {
  const handlers = useLongPress({ delay: 400, onLongPress: onZoom })
  return (
    <div
      className="relative w-full max-h-80"
      {...handlers}
      style={{ WebkitTouchCallout: "none", userSelect: "none", touchAction: "manipulation" }}
    >
      <Image
        src={src}
        alt={`加工画像 ${idx + 1}`}
        width={800}
        height={320}
        className="w-full h-auto max-h-80 object-contain rounded"
        draggable={false}
        onError={onError}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] pointer-events-none">
        長押しで拡大
      </div>
    </div>
  )
}
