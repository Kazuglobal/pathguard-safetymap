// =============================================
// きけんハンター 写真ストレージヘルパー (Phase 1)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md
// 非公開バケット 'hunter-photos' へのマスク済み画像の保存・署名URL発行・削除。
// すべて Supabase クライアントを引数で受け取る (サーバ層・テスト容易性のため)。
// 公開URLは使用しない。未マスク画像は保存しない (呼び出し側でマスク済み dataURL を渡す契約)。
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js"

/** マスク済み写真を格納する非公開バケット名。 */
export const HUNTER_PHOTO_BUCKET = "hunter-photos"

/**
 * オブジェクトパスを組み立てる。
 * 形式: `{auth.uid()}/{photoId}/masked.webp`
 * 所有者スコープ (先頭セグメントが userId) を保つことで RLS と整合させる。
 */
export function photoStoragePath(userId: string, photoId: string): string {
  return `${userId}/${photoId}/masked.webp`
}

interface ParsedDataUrl {
  mimeType: string
  bytes: Uint8Array
}

/**
 * `data:image/webp;base64,XXXX` 形式の dataURL をバイナリへ変換する。
 *
 * 保存は **webp のみ許可** する（防御の深さ・子ども位置情報保護）。
 * マスク確認UIは canvas.toDataURL("image/webp") で出力する。canvas 再エンコードは
 * EXIF(GPS含む) を一切引き継がないため、webp 限定にすることで「生カメラ JPEG の
 * EXIF/GPS がそのまま保存される」経路をサーバ側で塞ぐ。
 * 不正な形式・webp 以外は throw する (握りつぶさない)。
 */
function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) {
    throw new Error("画像データの形式が正しくありません (dataURL ではありません)")
  }

  const mimeType = match[1]
  if (mimeType !== "image/webp") {
    throw new Error(
      `保存できるのは canvas 由来の webp のみです (受信: ${mimeType})。EXIF/位置情報を残さないための制限です。`,
    )
  }

  const buffer = Buffer.from(match[2], "base64")
  return {
    mimeType,
    bytes: new Uint8Array(buffer),
  }
}

/**
 * マスク済み写真を非公開バケットへアップロードする。
 * - dataURL をバイナリ化し contentType ('image/webp'|'image/jpeg') 付きで upload。
 * - upsert:false (既存を上書きしない)。
 * - 失敗時は throw (日本語メッセージ)。
 */
export async function uploadMaskedPhoto(
  client: SupabaseClient,
  userId: string,
  photoId: string,
  dataUrl: string,
): Promise<{ path: string }> {
  const { mimeType, bytes } = parseImageDataUrl(dataUrl)
  const path = photoStoragePath(userId, photoId)

  const { error } = await client.storage.from(HUNTER_PHOTO_BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  })

  if (error) {
    throw new Error(`写真の保存に失敗しました: ${error.message}`)
  }

  return { path }
}

/**
 * 非公開オブジェクトへの短TTL署名URLを発行する。
 * 失敗時は throw せず null を返す (呼び出し側でフォールバック可能に)。
 */
export async function createPhotoSignedUrl(
  client: SupabaseClient,
  path: string,
  ttlSeconds = 300,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(HUNTER_PHOTO_BUCKET)
    .createSignedUrl(path, ttlSeconds)

  if (error || !data?.signedUrl) {
    console.error("署名URLの発行に失敗しました:", error)
    return null
  }

  return data.signedUrl
}

/**
 * `{userId}/{photoId}/` 配下のオブジェクトをすべて削除する。
 * list で配下を列挙し、見つかったものを remove する。
 * 失敗時は throw (呼び出し側でリトライ/監査可能に)。
 */
export async function deletePhotoObjects(
  client: SupabaseClient,
  userId: string,
  photoId: string,
): Promise<void> {
  const prefix = `${userId}/${photoId}`

  const { data: entries, error: listError } = await client.storage
    .from(HUNTER_PHOTO_BUCKET)
    .list(prefix)

  if (listError) {
    throw new Error(`写真の一覧取得に失敗しました: ${listError.message}`)
  }

  if (!entries || entries.length === 0) {
    return
  }

  const paths = entries.map((entry) => `${prefix}/${entry.name}`)

  const { error: removeError } = await client.storage
    .from(HUNTER_PHOTO_BUCKET)
    .remove(paths)

  if (removeError) {
    throw new Error(`写真の削除に失敗しました: ${removeError.message}`)
  }
}
