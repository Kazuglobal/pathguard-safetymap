"use client"

import { useCallback, useEffect, useState } from "react"
import { getDisplayName } from "@/lib/user-display-name"
import type { MypageReport } from "./mypage-shared"

/** マイページが読む自分の報告の件数。確認中・今週の件数はこの中から数える */
export const MYPAGE_REPORT_LIMIT = 50

/**
 * マイページの呼び名と自分の報告を読む。reloadKey が変わったら(プロフィールを保存したとき)読み直す。
 * 呼び名は表示名だけ(未設定なら名前なしの「こんにちは」)。読み込み前に「ゲスト」を出さない。
 */
export function useMypagePersonalData(reloadKey: number) {
  const [reports, setReports] = useState<MypageReport[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [isNameLoaded, setIsNameLoaded] = useState(false)
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  // 読み込みに失敗したとき。0件と見分けて「読み込めませんでした」を出す(0件を本当の値のように出さない)
  const [reportsError, setReportsError] = useState(false)
  // 読み込んだ件数が上限に届いたか(削除で減っても、数えている範囲は最近の分だけのまま)
  const [isReportListCapped, setIsReportListCapped] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    const loadPersonalData = async () => {
      setIsReportsLoading(true)
      setReportsError(false)

      try {
        const [profileResponse, reportsResponse] = await Promise.all([
          fetch("/api/profile", { credentials: "same-origin" }),
          fetch(`/api/reports?owner=me&limit=${MYPAGE_REPORT_LIMIT}`, { credentials: "same-origin" }),
        ])
        if (profileResponse.status === 401 || reportsResponse.status === 401) {
          if (isMounted) {
            setUserName(null)
            setIsNameLoaded(true)
            setReports([])
            setIsReportsLoading(false)
          }
          return
        }
        if (!profileResponse.ok || !reportsResponse.ok) {
          // 呼び名は報告一覧の読み込み失敗に巻き込まない(プロフィールが取れていれば出す)
          if (profileResponse.ok) {
            const { profile } = (await profileResponse.json()) as { profile?: { display_name?: string | null } }
            if (isMounted) {
              setUserName(getDisplayName(profile))
              setIsNameLoaded(true)
            }
          }
          throw new Error("Personal data request failed")
        }
        const [{ profile }, { reports: reportRows = [] }] = await Promise.all([
          profileResponse.json() as Promise<{ profile?: { display_name?: string | null; email?: string | null } }>,
          reportsResponse.json() as Promise<{ reports?: MypageReport[] }>,
        ])

        if (isMounted) {
          setUserName(getDisplayName(profile))
          setIsNameLoaded(true)
          setReports(reportRows ?? [])
          setIsReportListCapped((reportRows ?? []).length >= MYPAGE_REPORT_LIMIT)
          setIsReportsLoading(false)
        }
      } catch (error) {
        console.error("マイページ情報の取得に失敗しました", error)
        if (isMounted) {
          // 呼び名が分からないまま「表示名を設定する」を出さない(isNameLoaded は取れたときだけ立てる)
          setReports([])
          setReportsError(true)
          setIsReportsLoading(false)
        }
      }
    }

    loadPersonalData()

    return () => {
      isMounted = false
    }
  }, [reloadKey, retryKey])

  const removeReport = useCallback((reportId: string) => {
    setReports((prev) => prev.filter((report) => report.id !== reportId))
  }, [])

  const retryReports = useCallback(() => setRetryKey((key) => key + 1), [])

  return { reports, removeReport, userName, isNameLoaded, isReportsLoading, reportsError, isReportListCapped, retryReports }
}
