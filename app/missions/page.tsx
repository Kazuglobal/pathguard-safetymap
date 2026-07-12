"use client"

import { useState } from "react"
import Link from "next/link"
import { useMissions } from "@/hooks/use-missions"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, BadgeCheck, Gift } from "lucide-react"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

function missionHref(mission: any): string {
  const text = `${mission.title ?? ""} ${mission.description ?? ""}`
  if (/写真|ハンター/.test(text)) return "/safety-quest/hunter"
  if (/クイズ/.test(text)) return "/route-quiz"
  if (/報告|投稿/.test(text)) return "/report"
  return "/map"
}

export default function MissionsPage() {
  const { missions, progress, isLoading } = useMissions()
  const [tab, setTab] = useState("daily")

  const filtered = missions.filter((m: any) => (m.period ?? "daily") === tab)
  const t = tankenTokens

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: t.color.paper, backgroundImage: PAPER_NOISE, color: t.color.ink }}>
      <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold mb-6 text-center">ミッション</h1>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="daily">デイリー</TabsTrigger>
          <TabsTrigger value="weekly">ウィークリー</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {isLoading && <p className="text-center">読み込み中...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-gray-500">ミッションがありません</p>
          )}
          <div className="space-y-4">
            {filtered.map((m: any) => {
              const prog = progress[m.id]
              const pct = prog && prog.progress !== null ? (prog.progress / m.target_value) * 100 : 0
              const completed = prog?.completed
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 rounded-[22px] border p-4 ${completed ? "ring-2 ring-emerald-300" : ""}`}
                  style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.soft }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{m.title}</p>
                      {m.description && (
                        <p className="text-sm text-gray-500">{m.description}</p>
                      )}
                    </div>
                    {completed && <BadgeCheck className="h-6 w-6 text-emerald-500" />}
                  </div>
                  <Progress value={pct} />
                  <div className="flex justify-between items-end text-xs text-gray-500">
                    <p>
                      {prog?.progress ?? 0} / {m.target_value}
                    </p>
                    <div className="flex items-center gap-1">
                      <Gift className="h-4 w-4 text-yellow-500" />
                      {m.reward_points ?? 0}pt
                    </div>
                  </div>
                  {!completed && (
                    <Link href={missionHref(m)} className={`mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-white ${t.cls.focus}`} style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}>
                      あと {Math.max((m.target_value ?? 0) - (prog?.progress ?? 0), 0)}回 · ここから始める
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
