"use client"

/**
 * 選んだ写真を、ぼかす画面(PhotoMasker)に通してから使うためのフック(UIUX改装 項目57)。
 *
 *   const { requestMaskedPhoto, photoMaskerDialog } = useMaskedPhotoPicker()
 *   const masked = await requestMaskedPhoto(file) // ぼかした写真。やめたら null
 *   ...
 *   return <>{...}{photoMaskerDialog}</>
 *
 * 呼び出し側は、ぼかした写真(masked.file)だけを保存・AI の確認・送信に使う。
 */

import { useCallback, useRef, useState, type ReactNode } from "react"

import { PhotoMasker, type MaskedPhoto } from "@/components/media/photo-masker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function useMaskedPhotoPicker(): {
  requestMaskedPhoto: (file: File) => Promise<MaskedPhoto | null>
  photoMaskerDialog: ReactNode
} {
  const [file, setFile] = useState<File | null>(null)
  const resolverRef = useRef<((photo: MaskedPhoto | null) => void) | null>(null)

  const requestMaskedPhoto = useCallback((next: File) => new Promise<MaskedPhoto | null>((resolve) => {
    // 前の依頼が残っていたら「やめた」で閉じる
    resolverRef.current?.(null)
    resolverRef.current = resolve
    setFile(next)
  }), [])

  const finish = useCallback((photo: MaskedPhoto | null) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setFile(null)
    resolve?.(photo)
  }, [])

  const photoMaskerDialog = (
    <Dialog open={file !== null} onOpenChange={(open) => { if (!open) finish(null) }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="photo-masker-dialog">
        <DialogHeader>
          <DialogTitle>写真の顔とナンバーを隠す</DialogTitle>
          <DialogDescription>投稿する前に、写っている人や車が分からないようにします。</DialogDescription>
        </DialogHeader>
        {file && <PhotoMasker file={file} onConfirm={finish} onCancel={() => finish(null)} />}
      </DialogContent>
    </Dialog>
  )

  return { requestMaskedPhoto, photoMaskerDialog }
}
