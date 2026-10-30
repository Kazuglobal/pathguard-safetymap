"use client"

import Link from "next/link"
import { ArrowRight, Award, Gamepad2, Target, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardIcon, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { MissionRow } from "@/hooks/use-missions"
import { BRAND } from "@/lib/brand"
import { tankenTokens } from "@/lib/design/tanken"
import { MypageGroup, mypageCardStyle, mypageInnerPanelStyle } from "./mypage-shared"

const t = tankenTokens

export interface MypagePlayProps {
  upcomingMissions: MissionRow[]
  /** ミッションの id ごとの進み具合(/api/missions の progress) */
  progress: Partial<Record<string, { progress: number | null; completed: boolean | null }>>
  completedMissionCount: number
  missionCount: number
  isMissionsLoading: boolean
}

/**
 * マイページの「あそぶ」(UIUX改装 項目7・8)。きけんハンター・ミッション・バッジ・ランキングを
 * 「きけんハンター」の仲間として1か所に並べる(同じ行き先のボタンを重ねて置かない)。
 */
export function MypagePlay(props: MypagePlayProps) {
  return (
    <MypageGroup
      id="mypage-play"
      eyebrow={BRAND.kidsUmbrella}
      title="あそぶ"
      description="写真で危険をさがすゲームや、ミッション・バッジ・ランキングです。"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border" style={mypageCardStyle}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle style={{ color: t.color.ink }}>{BRAND.kidsUmbrella}</CardTitle>
                <CardDescription style={{ color: t.color.inkSoft }}>通学路の写真で危険をさがそう</CardDescription>
              </div>
              <CardIcon icon={<Gamepad2 className="h-5 w-5" />} color="warning" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm" style={{ color: t.color.inkSoft }}>
              通学路の写真から危険を見つけるゲーム。遊ぶとポイントとミッションが進み、写真は「たんけんの きろく」に残せます。
            </p>
          </CardContent>
          <CardFooter className="justify-end pt-4">
            <Button asChild variant="outline" size="sm" className={t.cls.focus}>
              <Link href="/safety-quest/hunter">
                ゲームをプレイ
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <MissionCard {...props} />

        <Card className="border md:col-span-2" style={mypageCardStyle}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle style={{ color: t.color.ink }}>バッジ・ランキング</CardTitle>
                <CardDescription style={{ color: t.color.inkSoft }}>集めたバッジと、安全活動のポイントのランキング</CardDescription>
              </div>
              <CardIcon icon={<Award className="h-5 w-5" />} color="info" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button asChild size="sm" variant="outline" className={t.cls.focus}>
              <Link href="/badges">
                <Award className="mr-2 h-4 w-4" aria-hidden="true" />
                バッジコレクション
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className={t.cls.focus}>
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-4 w-4" aria-hidden="true" />
                ランキングを見る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MypageGroup>
  )
}

function MissionCard({ upcomingMissions, progress, completedMissionCount, missionCount, isMissionsLoading }: MypagePlayProps) {
  return (
    <Card className="border" style={mypageCardStyle}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={{ color: t.color.ink }}>ミッション</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>
              {isMissionsLoading ? "読み込んでいます…" : `達成 ${completedMissionCount} / ${missionCount} 件`}
            </CardDescription>
          </div>
          <CardIcon icon={<Target className="h-5 w-5" />} color="warning" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isMissionsLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : upcomingMissions.length === 0 ? (
          <p className="text-sm" style={{ color: t.color.inkSoft }}>
            今日のミッションはこれから届きます。まずは地図で通学路をのぞいてみよう。
          </p>
        ) : (
          upcomingMissions.map((mission) => {
            const record = progress[String(mission.id)]
            const current = record?.progress ?? 0
            const total = mission.target_value ?? 1
            const percent = Math.min(Math.round((current / total) * 100), 100)
            return (
              <div key={mission.id} className="rounded-xl border p-4" style={mypageInnerPanelStyle}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: t.color.ink }}>
                      {mission.title}
                    </p>
                    {mission.description && (
                      <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>
                        {mission.description}
                      </p>
                    )}
                  </div>
                  {record?.completed && <Badge variant="secondary">達成</Badge>}
                </div>
                <div className="mt-3 space-y-2">
                  <Progress value={percent} className="h-2" aria-label={`${mission.title}の進み具合`} />
                  <div className="flex justify-between text-xs" style={{ color: t.color.inkSoft }}>
                    <span>
                      進行度 {current} / {total}
                    </span>
                    <span>{percent}%</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
      <CardFooter className="justify-end pt-4">
        <Button asChild variant="outline" size="sm" className={t.cls.focus}>
          <Link href="/missions">
            すべてのミッションを見る
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
