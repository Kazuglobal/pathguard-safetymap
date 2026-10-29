"use client"

import Link from "next/link"
import { ArrowRight, Check, Flag, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardIcon, CardTitle } from "@/components/ui/card"
import { tankenTokens } from "@/lib/design/tanken"
import { REPORT_PATH } from "@/lib/report-entry"
import { mypageCardStyle, mypageInnerPanelStyle } from "./mypage-shared"

const t = tankenTokens

/**
 * はじめの一歩(全部すんだら出さない)。完了の判定はすべて実データから。
 * 通知は、未設定ならマイページのいちばん上にカードを出すので、ここには並べない(UIUX改装 項目37)。
 */
export function buildSetupSteps({ routeCount, reportCount }: { routeCount: number; reportCount: number }) {
  return [
    {
      id: "route",
      label: "通学路を登録する",
      hint: "おうちと学校をつないで、見守りの土台をつくろう",
      done: routeCount > 0,
      href: "/routes",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      id: "report",
      label: "気になる場所を1件報告する",
      hint: "地図で見つけた「ヒヤリ」をみんなに共有しよう",
      done: reportCount > 0,
      href: REPORT_PATH,
      icon: <Flag className="h-4 w-4" />,
    },
  ]
}

export function MypageSetupSteps({ steps, isLoading }: { steps: ReturnType<typeof buildSetupSteps>; isLoading: boolean }) {
  const completedSteps = steps.filter((step) => step.done).length
  return (
    <Card className="border" style={mypageCardStyle}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle style={{ color: t.color.ink }}>はじめの一歩</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>
              {isLoading ? "準備状況を確認しています…" : `${completedSteps}/${steps.length} 完了 — 次の一歩へ進もう`}
            </CardDescription>
          </div>
          <CardIcon icon={<Flag className="h-5 w-5" />} color="warning" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 rounded-2xl border p-3" style={mypageInnerPanelStyle}>
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: step.done ? t.color.primary : t.color.sun, color: step.done ? "#fff" : t.color.ink }}
              aria-hidden
            >
              {step.done ? <Check className="h-4 w-4" /> : step.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: step.done ? t.color.inkSoft : t.color.ink }}>
                {step.label}
              </p>
              <p className="text-xs" style={{ color: t.color.inkSoft }}>
                {step.done ? "済んでいます。ありがとう！" : step.hint}
              </p>
            </div>
            {step.done ? (
              <Badge variant="secondary" className="flex-shrink-0">
                完了
              </Badge>
            ) : (
              <Button asChild size="sm" variant="outline" className={`flex-shrink-0 ${t.cls.focus}`}>
                <Link href={step.href} aria-label={`${step.label}へ進む`}>
                  進む
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
