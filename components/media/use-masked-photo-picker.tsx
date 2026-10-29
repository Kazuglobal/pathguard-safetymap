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
 * 依頼ごとに番号を付け、閉じたあとに前の画面から届いた結果は捨てる(次の写真の結果と取り違えない)。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { PhotoMasker, type MaskedPhoto } from "@/components/media/photo-masker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PendingRequest {
  readonly id: number
  readonly resolve: (photo: MaskedPhoto | null) => void
}

export function useMaskedPhotoPicker(): {
  requestMaskedPhoto: (file: File) => Promise<MaskedPhoto | null>
  photoMaskerDialog: ReactNode
} {
  const [request, setRequest] = useState<{ id: number; file: File } | null>(null)
  const pendingRef = useRef<PendingRequest | null>(null)
  const nextIdRef = useRef(0)

  const finish = useCallback((id: number, photo: MaskedPhoto | null) => {
    const pending = pendingRef.current
    // 閉じたあとに届いた、前の依頼の結果は捨てる
    if (!pending || pending.id !== id) return
    pendingRef.current = null
    setRequest(null)
    pending.resolve(photo)
  }, [])

  const requestMaskedPhoto = useCallback((file: File) => new Promise<MaskedPhoto | null>((resolve) => {
    // 前の依頼が残っていたら「やめた」で閉じる
    pendingRef.current?.resolve(null)
    nextIdRef.current += 1
    const id = nextIdRef.current
    pendingRef.current = { id, resolve }
    setRequest({ id, file })
  }), [])

  // 画面ごと閉じたら、待っている呼び出し側を「やめた」で終わらせる(待ったままにしない)
  useEffect(() => () => {
    pendingRef.current?.resolve(null)
    pendingRef.current = null
  }, [])

  const photoMaskerDialog = (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open && request) finish(request.id, null) }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="photo-masker-dialog">
        <DialogHeader>
          <DialogTitle>写真の顔とナンバーを隠す</DialogTitle>
          <DialogDescription>投稿する前に、写っている人や車が分からないようにします。</DialogDescription>
        </DialogHeader>
        {request && (
          <PhotoMasker
            key={request.id}
            file={request.file}
            onConfirm={(photo) => finish(request.id, photo)}
            onCancel={() => finish(request.id, null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )

  return { requestMaskedPhoto, photoMaskerDialog }
}
