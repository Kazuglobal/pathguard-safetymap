"use client"

import { useState } from "react"
import { useMissions } from "@/hooks/use-missions"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { BadgeCheck, Gift } from "lucide-react"

export default function MissionsPage() {
  const { missions, progress, isLoading } = useMissions()
  const [tab, setTab] = useState("daily")

  const filtered = missions.filter((m: any) => (m.period ?? "daily") === tab)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 max-w-3xl mx-auto">
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
                  className={`bg-white border rounded-md p-4 shadow-sm flex flex-col gap-2 ${completed ? "ring-2 ring-emerald-300" : ""}`}
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
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 