"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import Image from 'next/image'

interface ImagePreviewDialogProps {
  isOpen: boolean
  imageUrl: string | null
  onClose: () => void
}

export default function ImagePreviewDialog({ isOpen, imageUrl, onClose }: ImagePreviewDialogProps) {
  if (!imageUrl) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>画像プレビュー</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute right-4 top-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="relative w-full h-[60vh]">
          <Image
            src={imageUrl}
            alt="危険箇所の画像"
            fill
            className="object-contain"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
