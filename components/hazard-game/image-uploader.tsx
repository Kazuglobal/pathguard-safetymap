"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import { Camera, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useMaskedPhotoPicker } from "@/components/media/use-masked-photo-picker"

interface ImageUploaderProps {
  onImageSelect: (file: File) => void
  disabled?: boolean
}

export function ImageUploader({ onImageSelect, disabled = false }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{
    name: string
    size: number
    type: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 写真は端末でぼかしてから AI の確認に送る(UIUX改装 項目57)
  const { requestMaskedPhoto, photoMaskerDialog } = useMaskedPhotoPicker({
    description: "ゲームに使う前に、写っている人や車が分からないようにします。",
    notice: "この加工した写真だけを、AI(Google Gemini)による危険さがしに送ります。元の写真は端末の外に出しません。",
  })

  const handleFileSelect = async (file: File) => {
    setError(null)
    if (file && file.type.startsWith("image/")) {
      // ファイルサイズチェック（20MB制限）
      const maxSizeInBytes = 20 * 1024 * 1024
      if (file.size > maxSizeInBytes) {
        setError(`写真が大きすぎます(${(file.size / 1024 / 1024).toFixed(1)}MB)。20MBまでの写真を選んでください。`)
        return
      }

      const masked = await requestMaskedPhoto(file)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (!masked) return

      const imageUrl = URL.createObjectURL(masked.file)
      setSelectedImage(imageUrl)
      setFileInfo({
        name: masked.file.name,
        size: masked.file.size,
        type: masked.file.type
      })
      onImageSelect(masked.file)
    } else {
      setError("写真を選んでください(JPEG・PNG・WebP)。")
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFileSelect(file)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const file = event.dataTransfer.files[0]
    if (file) {
      void handleFileSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const openCamera = () => {
    // For mobile devices, this will open the camera
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment")
      fileInputRef.current.click()
    }
  }

  const clearImage = () => {
    setSelectedImage(null)
    setFileInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      {error && <p role="alert" className="mb-2 text-sm font-bold text-red-700">{error}</p>}
      {photoMaskerDialog}

      {!selectedImage ? (
        <Card
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={!disabled ? openFileDialog : undefined}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Upload className="h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              写真をアップロード
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              ドラッグ&ドロップ、またはクリックして写真を選択
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  openCamera()
                }}
                disabled={disabled}
              >
                <Camera className="h-4 w-4 mr-2" />
                カメラ
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
              >
                <Upload className="h-4 w-4 mr-2" />
                ファイル
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <Image
                  src={selectedImage}
                  alt="選んだ写真(顔などをぼかしたもの)"
                  fill
                  className="object-cover"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={clearImage}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              画像が選択されました。分析を開始できます。
            </p>
            {fileInfo && (
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <p>写真: ぼかした写真</p>
                <p>サイズ: {(fileInfo.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>形式: {fileInfo.type}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}