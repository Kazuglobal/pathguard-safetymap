"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload,
  Loader2,
} from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { pgTextArrayToJs } from "@/lib/arrayLiteral"
import { useToast } from "@/components/ui/use-toast"

interface ReportDetailModalProps {
  isOpen: boolean
  onClose: () => void
  report: DangerReport | null
  onApprove: (reportId: string) => Promise<void>
  onReject: (reportId: string) => Promise<void>
  onResolve?: (reportId: string) => Promise<void>
  onReportUpdate?: () => void // 報告が更新されたときに親コンポーネントに通知するコールバック
}

export default function ReportDetailModal({
  isOpen,
  onClose,
  report,
  onApprove,
  onReject,
  onResolve,
  onReportUpdate,
}: ReportDetailModalProps) {
  const [activeImageTab, setActiveImageTab] = useState<string>("original")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // useEffect の依存配列用に、report の有無を確認しつつ値を取得
  const reportImageUrl = report?.image_url;
  const reportProcessedUrls = report?.processed_image_urls;

  useEffect(() => { // フック 3 (無条件呼び出し)
    // Effect 内で report が存在するか再度確認しても良い
    if (reportImageUrl) {
      setActiveImageTab("original");
    } else if ((reportProcessedUrls || []).length > 0) {
      setActiveImageTab("processed");
    }
  }, [reportImageUrl, reportProcessedUrls]); // 依存配列を修正

  // --- ▼▼▼ 早期リターンをフック呼び出しの後に移動 ▼▼▼ ---
  if (!report) return null

  // --- report が存在することが確定した後に、レンダリングに必要な値を計算 ---
  const processedUrls: string[] = report.processed_image_urls || [];
  const hasImages = !!report.image_url || processedUrls.length > 0;

  // 加工画像アップロード処理
  const handleProcessedImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('reportId', report.id)

      const response = await fetch('/api/image/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '画像のアップロードに失敗しました')
      }

      const data = await response.json()
      toast({
        title: "加工画像をアップロードしました",
        description: "加工画像が正常にアップロードされました。",
      })

      // 親コンポーネントに報告が更新されたことを通知
      if (onReportUpdate) {
        onReportUpdate()
      }
    } catch (error) {
      console.error('画像アップロードエラー:', error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "画像のアップロードに失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            審査中
          </Badge>
        )
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            承認済み
          </Badge>
        )
      case "resolved":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            解決済み
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await onApprove(report.id)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }
  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await onReject(report.id)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }
  const handleResolve = async () => {
    if (!onResolve) return
    setIsProcessing(true)
    try {
      await onResolve(report.id)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
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
            {getStatusBadge(report.status)}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-2 space-y-4">
            {report.description && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    詳細説明
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">
                    {report.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {hasImages && (
              <Card>
                <CardContent className="p-4">
                  <Tabs
                    defaultValue={report.image_url ? "original" : "processed"}
                    value={activeImageTab}
                    onValueChange={setActiveImageTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="original"
                        disabled={!report.image_url}
                      >
                        元画像
                      </TabsTrigger>
                      <TabsTrigger
                        value="processed"
                        disabled={processedUrls.length === 0}
                      >
                        加工画像
                      </TabsTrigger>
                    </TabsList>

                    {/* 元画像 */}
                    <TabsContent value="original" className="mt-2">
                      {report.image_url ? (
                        <div className="relative w-full h-64 md:h-96">
                          <img
                            src={report.image_url}
                            alt="危険箇所の元画像"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.onerror = null
                              e.currentTarget.src = "/placeholder.svg"
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-md">
                          <p className="text-gray-500">元画像はありません</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* 加工画像群 */}
                    <TabsContent value="processed" className="mt-2">
                      {/* 加工画像アップロード部分 */}
                      {report.status !== "rejected" && (
                        <div className="mb-4 border-b border-gray-200 pb-4">
                          <h4 className="text-sm font-medium mb-2">加工画像をアップロード</h4>
                          <div className="flex items-center space-x-2">
                            <input
                              type="file"
                              id="processed-image"
                              className="hidden"
                              accept="image/*"
                              onChange={handleProcessedImageUpload}
                              ref={fileInputRef}
                              disabled={isUploading}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  アップロード中...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  画像を選択
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-gray-500">
                              JPEG, PNG, GIF形式の画像（最大5MB）
                            </p>
                          </div>
                        </div>
                      )}

                      {processedUrls.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto">
                          {processedUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative border rounded-md overflow-hidden min-w-[150px]"
                            >
                              <img
                                src={url}
                                alt={`加工画像 ${idx + 1}`}
                                className="w-full h-32 md:h-96 object-contain"
                                onError={(e) => {
                                  e.currentTarget.onerror = null
                                  e.currentTarget.src = "/placeholder.svg"
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-md">
                          <p className="text-gray-500">加工画像はありません</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {report.status === "pending" && (
              <div className="flex space-x-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  承認する
                </Button>
                <Button
                  onClick={handleReject}
                  variant="destructive"
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  拒否する
                </Button>
              </div>
            )}

            {report.status === "approved" && onResolve && (
              <Button
                onClick={handleResolve}
                variant="outline"
                className="w-full"
                disabled={isProcessing}
              >
                解決済みにする
              </Button>
            )}
          </div>

          {/* サイドバー */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    危険タイプ
                  </h3>
                  <Badge variant="outline" className="bg-gray-100">
                    {getDangerTypeLabel(report.danger_type)}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    危険度
                  </h3>
                  <Badge
                    variant="outline"
                    className={getDangerLevelClass(report.danger_level)}
                  >
                    レベル {report.danger_level}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    報告日時
                  </h3>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                    {formatDate(report.created_at)}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    座標
                  </h3>
                  <div className="flex	items-center text-sm">
                    <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                    <span className="font-mono">
                      {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    ステータス
                  </h3>
                  {getStatusBadge(report.status)}
                </div>
              </CardContent>
            </Card>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">管理者向け注意事項</p>
                  <p>
                    承認すると、この報告は一般ユーザーに公開されます。内容を十分に確認してください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}