"use client"

import React, { useRef, useState } from "react"
import { Camera, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ImageUploaderProps {
  onImageSelect: (file: File) => void
  disabled?: boolean
}

export function ImageUploader({ onImageSelect, disabled = false }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const imageUrl = URL.createObjectURL(file)
      setSelectedImage(imageUrl)
      onImageSelect(file)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const file = event.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
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
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
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
              <img
                src={selectedImage}
                alt="Selected"
                className="w-full h-64 object-cover rounded-lg"
              />
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}