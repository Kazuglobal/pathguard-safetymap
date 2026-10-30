"use client"

import { useState, type ReactNode } from "react"
import { Filter, Flag, HelpCircle, Layers, List, MapPin, Move, Route, Search, Sparkles, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapLegendDetails } from "@/components/map/map-legend"
import { BRAND } from "@/lib/brand"
import { POINTS_PER_LEVEL, REPORT_PUBLISHED_POINTS } from "@/lib/gamification-levels"
import { HUNTER_PLAY_POINTS } from "@/lib/hunter/rewards"
import { PRODUCT_FACTS } from "@/lib/product-facts"

interface HelpDialogProps {
  /** 開くボタン。渡さないときは open / onOpenChange で開け閉めする */
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 「はじめての案内をもう一度」。はじめての案内(絵本のガイド)は、このヘルプとは別に開く(UIUX改装 項目51) */
  onReplayOnboarding?: () => void
}

interface HelpItem {
  icon: typeof HelpCircle
  title: string
  text: string
}

/** 地図の見かた(スマホのタッチ操作を前提に書く) */
const VIEW_ITEMS: readonly HelpItem[] = [
  { icon: Move, title: "地図を動かす", text: "指でなぞると動き、2本の指で広げると大きく、つまむと小さくなります。" },
  { icon: MapPin, title: "ピンを見る", text: "ピンをタップすると、報告の内容や写真が出ます。近いピンは数字の丸にまとまります。" },
  { icon: Search, title: "場所をさがす", text: "上の検索に、学校の名前や住所を入れます。いま地図に見えている学校が先に出ます。" },
  { icon: Route, title: "通学路チェック", text: "上の「通学路チェック」で、登録した通学路と、その近くの危険・事故の多い場所を確かめられます。" },
  { icon: Layers, title: "くわしい表示", text: "「くわしい表示」をひらくと、事故ヒートマップ・不審者情報・AR・3D と、地図の見た目・洪水・津波を切り替えられます。" },
]

const FILTER_ITEMS: readonly HelpItem[] = [
  { icon: List, title: "一覧で見る", text: "スマホは下の「一覧」、パソコンは画面の横の一覧で、報告を並べて見られます。" },
  { icon: Filter, title: "しぼりこむ", text: "一覧の「フィルター」で、危険の種類・あぶなさ・期間でしぼりこめます。" },
  { icon: MapPin, title: "見えている範囲だけ", text: "地図と一覧に出るのは、いま地図に見えている範囲の報告です。地図を動かすと入れかわります。" },
]

const REPORT_STEPS: readonly { title: string; text: string }[] = [
  { title: "「報告」を押す", text: "スマホは下の「報告」、パソコンは下の「危険箇所を報告」を押します。「現在地」からも始められます。" },
  { title: "場所を決める", text: "地図をタップして、危険な場所にピンを立てます。" },
  { title: "写真と内容を入れる", text: PRODUCT_FACTS.photo.adult },
  { title: "確かめて送る", text: PRODUCT_FACTS.moderation.adult },
]

const POINT_ITEMS: readonly string[] = [
  `報告が公開されると +${REPORT_PUBLISHED_POINTS}pt`,
  `${BRAND.kidsUmbrella}で危険を見つけると +${HUNTER_PLAY_POINTS}pt(遊びかたごとに1日1回)`,
  "ミッションを達成すると、そのミッションに書いてあるポイント",
  `${POINTS_PER_LEVEL}ptごとに、レベルが1つ上がります`,
]

function HelpItemList({ items }: { items: readonly HelpItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
          <div>
            <h4 className="font-bold text-slate-900">{title}</h4>
            <p className="text-sm leading-relaxed text-slate-700">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 地図のヘルプ(UIUX改装 項目51)。レイヤー・パネル・しぼりこみ・ピンの色と★・報告のしかた・ポイント */
export default function HelpDialog({ children, open, onOpenChange, onReplayOnboarding }: HelpDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            地図の使い方
          </DialogTitle>
          <DialogDescription>知りたいことを選んでください。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="view" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="view">見かた</TabsTrigger>
            <TabsTrigger value="pins">ピン</TabsTrigger>
            <TabsTrigger value="filter">しぼりこみ</TabsTrigger>
            <TabsTrigger value="report">報告</TabsTrigger>
            <TabsTrigger value="points">ポイント</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="pt-2">
            <HelpItemList items={VIEW_ITEMS} />
          </TabsContent>

          <TabsContent value="pins" className="space-y-3 pt-2">
            <p className="text-sm leading-relaxed text-slate-700">ピンの絵は危険の種類、色と★の数はあぶなさです。</p>
            {/* 地図の凡例と同じ定義(絵=種類 / 色=あぶなさ / かたち)を表示する */}
            <MapLegendDetails />
          </TabsContent>

          <TabsContent value="filter" className="pt-2">
            <HelpItemList items={FILTER_ITEMS} />
          </TabsContent>

          <TabsContent value="report" className="pt-2">
            <ol className="space-y-3">
              {REPORT_STEPS.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-800" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="flex items-center gap-1.5 font-bold text-slate-900">
                      {index === 0 && <Flag className="h-4 w-4" aria-hidden="true" />}
                      {step.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-700">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="points" className="space-y-3 pt-2">
            <h4 className="flex items-center gap-2 font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-amber-600" aria-hidden="true" />
              ポイントのもらいかた
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              {POINT_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-slate-700">
              ポイント・レベル・バッジは、マイページの「自分の記録」と「あそぶ」で見られます。
            </p>
          </TabsContent>
        </Tabs>

        {onReplayOnboarding && (
          <div className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false)
                onReplayOnboarding()
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              はじめての案内をもう一度
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
