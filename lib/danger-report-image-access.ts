"use client"

import { useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * danger-reports バケット向け 署名URL発行ヘルパー。
 *
 * 背景: danger-reports バケットは元々 public=true + storage.objects の
 * SELECT ポリシーが TO public だったため、getPublicUrl() で発行した
 * 「常時アクセス可能なURL」を image_url / processed_image_urls に保存し、
 * そのままフロントの <img src> 等に使う設計になっていた。
 * (supabase/migrations/20260704090300_restrict_public_read_and_storage.sql で
 *  bucket を非公開化し、storage.objects の SELECT を TO authenticated に変更済み)
 *
 * 既存データは引き続き getPublicUrl() 形式の文字列を保持しているため、
 * ここではその文字列からストレージパスを復元し、短TTLの署名URLへ
 * 差し替えるための関数のみを提供する。呼び出し側(画像を表示するコンポーネント)の
 * 移行は段階的に行う想定(最終報告を参照)。
 */

/**
 * `.../storage/v1/object/public/{bucketName}/{path}` 形式のURLから
 * バケット内パスを取り出す。
 * 既にパスのみ(スラッシュ区切り、http(s)で始まらない)の場合はそのまま返す。
 * 復元できない形式の場合は null を返す(呼び出し側でフォールバック可能に)。
 */
export function extractDangerReportStoragePath(
  urlOrPath: string,
  bucketName = "danger-reports",
): string | null {
  if (!urlOrPath) return null

  if (!/^https?:\/\//.test(urlOrPath)) {
    // 既にバケット内パス相当の値
    return urlOrPath
  }

  try {
    const url = new URL(urlOrPath)
    const marker = `/storage/v1/object/public/${bucketName}/`
    const idx = url.pathname.indexOf(marker)
    if (idx < 0) return null
    const path = decodeURIComponent(url.pathname.slice(idx + marker.length))
    return path || null
  } catch {
    return null
  }
}

/**
 * danger-reports バケット内のオブジェクトへ短TTL署名URLを発行する。
 * 失敗時は throw せず null を返す(呼び出し側でプレースホルダー表示にフォールバック可能に)。
 */
export async function createDangerReportSignedUrl(
  client: SupabaseClient,
  urlOrPath: string,
  ttlSeconds = 3600,
  bucketName = "danger-reports",
): Promise<string | null> {
  const path = extractDangerReportStoragePath(urlOrPath, bucketName)
  if (!path) return null

  const { data, error } = await client.storage.from(bucketName).createSignedUrl(path, ttlSeconds)

  if (error || !data?.signedUrl) {
    console.error("danger-reports 画像の署名URL発行に失敗しました:", error)
    return null
  }

  return data.signedUrl
}

/** ローカルプレビュー用URL(まだアップロードされていないファイルのブラウザ内プレビュー)かどうか。 */
function isLocalPreviewUrl(urlOrPath: string): boolean {
  return urlOrPath.startsWith("blob:") || urlOrPath.startsWith("data:")
}

/**
 * 表示用URLを解決する。
 * - blob:/data: (アップロード前のローカルプレビュー) はそのまま返す。
 * - danger-reports バケットの getPublicUrl() 形式のURLは署名URLへ差し替える。
 * - 上記いずれにも該当しない文字列(既に署名済みURLや無関係の外部URL等)はそのまま返す。
 * - バケット内パスへの解決はできるが client が無い、または署名発行に失敗した場合は null。
 */
async function resolveDangerReportDisplayUrl(
  client: SupabaseClient | null | undefined,
  urlOrPath: string,
  ttlSeconds: number,
  bucketName: string,
): Promise<string | null> {
  if (isLocalPreviewUrl(urlOrPath)) return urlOrPath

  const path = extractDangerReportStoragePath(urlOrPath, bucketName)
  if (path === null) {
    // danger-reports の公開URL形式に一致しない(既に署名済み/無関係の外部URL等) → そのまま使う
    return urlOrPath
  }

  if (!client) return null

  return createDangerReportSignedUrl(client, urlOrPath, ttlSeconds, bucketName)
}

/**
 * danger-reports バケットの画像1枚を表示用に解決するReactフック。
 * urlOrPath が変わるたびに署名URLを再取得する。
 * 取得中および失敗時は null を返すため、呼び出し側でローディング/エラー表示に切り替えること。
 */
export function useDangerReportSignedImageUrl(
  client: SupabaseClient | null | undefined,
  urlOrPath: string | null | undefined,
  ttlSeconds = 3600,
  bucketName = "danger-reports",
): string | null {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!urlOrPath) {
      setDisplayUrl(null)
      return
    }

    let cancelled = false
    setDisplayUrl(null)

    resolveDangerReportDisplayUrl(client, urlOrPath, ttlSeconds, bucketName).then((resolved) => {
      if (!cancelled) setDisplayUrl(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [client, urlOrPath, ttlSeconds, bucketName])

  return displayUrl
}

/**
 * danger-reports バケットの画像複数枚(processed_image_urls 等の配列)をまとめて
 * 表示用に解決するReactフック。戻り値は入力配列と同じ長さ・同じ並び順を保つ。
 * 各要素は取得中/失敗時に null になる。
 */
export function useDangerReportSignedImageUrls(
  client: SupabaseClient | null | undefined,
  urlsOrPaths: ReadonlyArray<string | null | undefined> | null | undefined,
  ttlSeconds = 3600,
  bucketName = "danger-reports",
): Array<string | null> {
  const safeList = urlsOrPaths ?? []
  // 配列の参照ではなく内容で依存比較する(呼び出し側が毎レンダー新しい配列を渡しても無限ループしないように)
  const listKey = safeList.map((url) => url ?? "").join("|")

  const [displayUrls, setDisplayUrls] = useState<Array<string | null>>(() => safeList.map(() => null))

  useEffect(() => {
    if (safeList.length === 0) {
      setDisplayUrls([])
      return
    }

    let cancelled = false
    setDisplayUrls(safeList.map(() => null))

    Promise.all(
      safeList.map((urlOrPath) =>
        urlOrPath ? resolveDangerReportDisplayUrl(client, urlOrPath, ttlSeconds, bucketName) : Promise.resolve(null),
      ),
    ).then((resolved) => {
      if (!cancelled) setDisplayUrls(resolved)
    })

    return () => {
      cancelled = true
    }
    // listKey が safeList の内容を表す安定した依存値
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, listKey, ttlSeconds, bucketName])

  return displayUrls
}
