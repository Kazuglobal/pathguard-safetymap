"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, ImageIcon } from "lucide-react"

/* ===== 型定義 ===== */
interface SubmittedReportPreviewProps {
  isOpen: boolean
  onClose: () => void
  originalImage: string | null
  processedImages: string[] // ← 複数 URL を受け取る
}

/* ===== コンポーネント ===== */
export default function SubmittedReportPreview({
  isOpen,
  onClose,
  originalImage,
  processedImages,
}: SubmittedReportPreviewProps) {
  /* --- タブ状態 --- */
  const [activeTab, setActiveTab] = useState<string>("original")

  /* --- 元画像用 state --- */
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [originalError, setOriginalError] = useState(false)

  /* --- 加工画像用 state（複数） --- */
  const [procSrcs, setProcSrcs] = useState<string[]>([])
  const [procErrors, setProcErrors] = useState<boolean[]>([])

  /* ===== URL 変更時の初期化 ===== */
  useEffect(() => {
    setOriginalSrc(originalImage)
    setOriginalError(false)

    setProcSrcs(processedImages)
    setProcErrors(processedImages.map(() => false))

    if (originalImage) setActiveTab("original")
    else if (processedImages.length > 0) setActiveTab("processed")
  }, [originalImage, processedImages])

  /* ===== キャッシュバスター ===== */
  const addCacheBuster = (url: string | null) => {
    if (!url) return null
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}t=${Date.now()}`
  }

  /* ===== JSX ===== */
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl">報告画像プレビュー</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="mt-4">
          {originalImage || procSrcs.length > 0 ? (
            <Tabs
              defaultValue={originalImage ? "original" : "processed"}
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="original" disabled={!originalImage}>
                  元画像
                </TabsTrigger>
                <TabsTrigger value="processed" disabled={procSrcs.length === 0}>
                  加工画像
                </TabsTrigger>
              </TabsList>

              {/* ------- 元画像 ------- */}
              <TabsContent value="original" className="mt-2">
                {originalImage && !originalError ? (
                  <div className="relative w-full h-80 bg-gray-50 rounded-md overflow-hidden">
                    <img
                      src={addCacheBuster(originalSrc) || "/placeholder.svg"}
                      alt="報告の元画像"
                      className="w-full h-full object-contain"
                      onError={() => setOriginalError(true)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 bg-gray-100 rounded-md">
                    <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-gray-500">
                      {originalError
                        ? "画像の読み込みに失敗しました"
                        : "元画像はありません"}
                    </p>
                    {originalError && originalImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setOriginalSrc(addCacheBuster(originalImage))
                          setOriginalError(false)
                        }}
                      >
                        再読み込み
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ------- 加工画像（複数） ------- */}
              <TabsContent value="processed" className="mt-2">
                {procSrcs.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {procSrcs.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative border rounded-md overflow-hidden min-w-[150px]"
                      >
                        {!procErrors[idx] ? (
                          <img
                            src={addCacheBuster(url) || "/placeholder.svg"}
                            alt={`加工画像 ${idx + 1}`}
                            className="w-full h-32 md:h-80 object-contain"
                            onError={() =>
                              setProcErrors((errs) => {
                                const copy = [...errs]
                                copy[idx] = true
                                return copy
                              })
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-32 md:h-80 bg-gray-100">
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                            <p className="text-xs text-gray-500 mt-1">
                              読み込み失敗
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1"
                              onClick={() =>
                                setProcErrors((errs) => {
                                  const copy = [...errs]
                                  copy[idx] = false
                                  return copy
                                })
                              }
                            >
                              再試行
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 bg-gray-100 rounded-md">
                    <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-gray-500">加工画像はありません</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-100 rounded-md">
              <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-gray-500">この報告には画像が添付されていません</p>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              報告が送信されました。管理者の承認後に地図上に表示されます。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}