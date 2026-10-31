"use client"

import Link from "next/link"
import { Compass, Flag, Images, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardIcon, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getReportStatusPresentation } from "@/components/danger-report/detail/report-detail-utils"
import { tankenTokens } from "@/lib/design/tanken"
import { getLevelProgress } from "@/lib/gamification-levels"
import { REPORT_ENTRY_LABEL, REPORT_PATH } from "@/lib/report-entry"
import { MypageGroup, formatReportDate, mypageCardStyle, mypageInnerPanelStyle, type MypageReport } from "./mypage-shared"

const t = tankenTokens

/** アップロード履歴に並べる件数 */
const RECENT_UPLOAD_COUNT = 3

export interface MypageRecordsProps {
  points: number
  level: number
  isGamificationLoading: boolean
  reports: MypageReport[]
  isReportsLoading: boolean
  /** 報告を読み込めなかった(0件とは見分ける) */
  reportsError: boolean
  onRetryReports: () => void
  /** 読み込んだ報告が上限に届いた(件数は最近の分だけから数えている) */
  isReportListCapped: boolean
  reportListLimit: number
  reviewingCount: number
  reportsThisWeek: number
  routesCount: number
  isRoutesLoading: boolean
  deletingReportId: string | null
  onDeleteReport: (reportId: string) => void
  /** 画像コレクション(端末でぼかした写真だけ)。src は表示用の署名つき URL(取得中は null) */
  collection: { id: string; src: string | null }[]
}

/**
 * マイページの「自分の記録」(UIUX改装 項目6・7)。
 * もとの /dashboard にあったポイント・レベル・確認中の件数も、ここにまとめた。
 */
export function MypageRecords(props: MypageRecordsProps) {
  return (
    <MypageGroup id="mypage-records" title="自分の記録" description="ポイントや報告のようす、アップロードした写真をまとめました。">
      <WeeklyRecordCard {...props} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <UploadHistoryCard {...props} />
        <CollectionCard collection={props.collection} isLoading={props.isReportsLoading} hasError={props.reportsError} />
      </div>
    </MypageGroup>
  )
}

function SummaryTile({ label, value, note, loading }: { label: string; value: string; note?: string; loading: boolean }) {
  return (
    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 rounded-2xl border px-4 py-3" style={mypageInnerPanelStyle}>
      <span className="text-xs font-semibold" style={{ color: t.color.inkSoft }}>
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-black leading-none" style={{ color: t.color.ink }}>
          {value}
        </span>
      )}
      {note && (
        <span className="text-xs" style={{ color: t.color.inkSoft }}>
          {note}
        </span>
      )}
    </div>
  )
}

function WeeklyRecordCard({
  points,
  level,
  isGamificationLoading,
  isReportsLoading,
  reportsError,
  isReportListCapped,
  reportListLimit,
  reviewingCount,
  reportsThisWeek,
  routesCount,
  isRoutesLoading,
}: MypageRecordsProps) {
  const progress = getLevelProgress(points, level)
  return (
    <Card className="border" style={mypageCardStyle}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={<Compass className="h-5 w-5" />} color="primary" />
          <div>
            <CardTitle style={{ color: t.color.ink }}>今週のわが家の見守り</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>小さな一歩の積み重ねが、毎日の安心につながります。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap gap-3">
          <SummaryTile label="ポイント" value={`${points}pt`} note={`レベル ${progress.level}`} loading={isGamificationLoading} />
          {/* 読み込めなかったときは「0件」と出さず「—」にする */}
          <SummaryTile label="確認中の報告" value={reportsError ? "—" : `${reviewingCount}件`} note="公開の前の確認を待っています" loading={isReportsLoading} />
          <SummaryTile label="今週の報告" value={reportsError ? "—" : `${reportsThisWeek}件`} loading={isReportsLoading} />
          <SummaryTile label="登録した通学路" value={`${routesCount}本`} loading={isRoutesLoading} />
        </div>
        {isReportListCapped && (
          <p className="text-xs" style={{ color: t.color.inkSoft }}>
            報告の件数は、最近の{reportListLimit}件から数えています。
          </p>
        )}
        <div className="space-y-2 rounded-2xl border px-4 py-3" style={mypageInnerPanelStyle}>
          <div className="flex items-center justify-between text-xs" style={{ color: t.color.inkSoft }}>
            <span>レベル {progress.level} の進み具合</span>
            <span>
              あと {progress.pointsToNextLevel}pt でレベル {progress.nextLevel}
            </span>
          </div>
          <Progress value={Math.round(progress.ratio * 100)} className="h-2.5" aria-label={`レベル ${progress.nextLevel} までの進み具合`} />
          <p className="text-xs" style={{ color: t.color.inkSoft }}>
            ポイントは報告やミッション達成でたまり、レベルとバッジに反映されます。
            {isGamificationLoading && "（更新中…）"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function UploadHistoryCard({ reports, isReportsLoading, reportsError, onRetryReports, deletingReportId, onDeleteReport }: MypageRecordsProps) {
  const recentUploads = reports.slice(0, RECENT_UPLOAD_COUNT)
  return (
    <Card className="border" style={mypageCardStyle}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={{ color: t.color.ink }}>アップロード履歴</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>最近報告した危険箇所と、確認のようすを見られます</CardDescription>
          </div>
          <CardIcon icon={<Upload className="h-5 w-5" />} color="primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isReportsLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : reportsError ? (
          <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: t.border.soft }} role="alert">
            <p className="text-sm font-bold" style={{ color: t.color.ink }}>
              報告を読み込めませんでした
            </p>
            <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>
              通信状態を確認して、もう一度お試しください。
            </p>
            <Button type="button" variant="outline" size="sm" className={`mt-3 ${t.cls.focus}`} onClick={onRetryReports}>
              もう一度ためす
            </Button>
          </div>
        ) : recentUploads.length === 0 ? (
          <p className="text-sm" style={{ color: t.color.inkSoft }}>
            まだ報告はありません。通学路で気づいた「ヒヤリ」を1件、地図から共有してみよう。
          </p>
        ) : (
          recentUploads.map((report) => {
            // 状態の判定・ラベルは getReportStatusPresentation に一元化(ローカル辞書を新設しない)
            const status = getReportStatusPresentation(report)
            const canDelete = report.status === "pending"
            return (
              <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl border p-4" style={mypageInnerPanelStyle}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: t.color.ink }}>
                    {report.title || "タイトル未設定"}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>
                    {formatReportDate(report.created_at)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${status.badgeClass}`}>{status.label}</span>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={() => onDeleteReport(report.id)}
                      disabled={deletingReportId === report.id}
                      aria-label="この投稿を削除"
                      title="審査中の投稿を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
      <CardFooter className="justify-end pt-4">
        {/* 報告の入口は、どこから入っても地図つきの報告フォーム(UIUX改装 項目5) */}
        <Button asChild size="sm" className={`text-white ${t.cls.focus}`} style={{ background: t.color.accent, boxShadow: t.shadow.pressAccent }}>
          <Link href={REPORT_PATH}>
            <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
            {REPORT_ENTRY_LABEL}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function CollectionCard({ collection, isLoading, hasError }: { collection: MypageRecordsProps["collection"]; isLoading: boolean; hasError: boolean }) {
  return (
    <Card className="border" style={mypageCardStyle}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={{ color: t.color.ink }}>画像コレクション</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>報告した写真(顔などをぼかしたもの)を振り返ろう</CardDescription>
          </div>
          <CardIcon icon={<Images className="h-5 w-5" />} color="success" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : hasError ? (
          <p className="text-sm" style={{ color: t.color.inkSoft }}>
            写真を読み込めませんでした。上の「もう一度ためす」で読み直せます。
          </p>
        ) : collection.length === 0 ? (
          <p className="text-sm" style={{ color: t.color.inkSoft }}>
            報告した写真はここにコレクションされます。最初の1枚をアップロードしてみよう。
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {collection.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border" style={mypageInnerPanelStyle}>
                {item.src ? (
                  <img src={item.src} alt="報告した写真" loading="lazy" className="h-20 w-full object-cover" />
                ) : (
                  <Skeleton className="h-20 w-full" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
