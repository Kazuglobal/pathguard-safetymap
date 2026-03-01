"use client"

import * as React from "react"
import Link from "next/link"
import {
  Camera,
  ChevronRight,
  Clock,
  Award,
  Crosshair,
  TrafficCone,
  Lamp,
  TreePine,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoChallenge {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  bonusPoints: number
  exampleTags: string[]
  color: string
}

/**
 * Generate a rotating weekly challenge based on the current week number.
 * This ensures all users see the same challenge at the same time.
 */
function getCurrentWeekChallenge(): PhotoChallenge {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7
  )

  const challenges: PhotoChallenge[] = [
    {
      id: "crosswalk",
      title: "横断歩道チャレンジ",
      description:
        "通学路にある横断歩道の写真を投稿しよう。信号がない横断歩道、見通しの悪い横断歩道を見つけたら報告！",
      icon: <Crosshair className="w-6 h-6" />,
      bonusPoints: 30,
      exampleTags: ["横断歩道", "信号なし", "見通し不良"],
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "traffic",
      title: "交通標識チャレンジ",
      description:
        "スクールゾーンの標識や速度制限の標識を見つけて撮影。見えにくい標識や壊れた標識があったら報告しよう！",
      icon: <TrafficCone className="w-6 h-6" />,
      bonusPoints: 25,
      exampleTags: ["標識", "スクールゾーン", "速度制限"],
      color: "from-orange-500 to-red-500",
    },
    {
      id: "lighting",
      title: "街灯チェックチャレンジ",
      description:
        "暗くなりがちな通学路の写真を撮影。街灯が少ない場所、切れている街灯を見つけたら報告！",
      icon: <Lamp className="w-6 h-6" />,
      bonusPoints: 35,
      exampleTags: ["街灯", "暗い道", "照明不足"],
      color: "from-amber-500 to-yellow-500",
    },
    {
      id: "greenery",
      title: "見通しチャレンジ",
      description:
        "草木が茂って見通しの悪い場所を見つけよう。植え込みで見えにくい交差点、カーブミラーが隠れている場所を報告！",
      icon: <TreePine className="w-6 h-6" />,
      bonusPoints: 30,
      exampleTags: ["草木", "見通し不良", "カーブミラー"],
      color: "from-green-500 to-emerald-500",
    },
  ]

  return challenges[weekNumber % challenges.length]
}

function getDaysRemainingInWeek(): number {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  // Assuming week ends on Sunday
  return dayOfWeek === 0 ? 0 : 7 - dayOfWeek
}

export function WeeklyPhotoChallengeSection() {
  const challenge = getCurrentWeekChallenge()
  const daysRemaining = getDaysRemainingInWeek()

  return (
    <section className="px-4 py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <Camera className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            今週の写真チャレンジ
          </h2>
        </div>

        {/* Challenge card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 md:p-8 shadow-lg",
            challenge.color
          )}
        >
          {/* Background decoration */}
          <div className="absolute -right-10 -top-10 opacity-10">
            <Camera className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10">
            {/* Timer badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white">
                <Clock className="w-3.5 h-3.5" />
                {daysRemaining > 0
                  ? `あと${daysRemaining}日`
                  : "今日まで！"}
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white">
                <Award className="w-3.5 h-3.5" />
                +{challenge.bonusPoints}ボーナスpt
              </div>
            </div>

            {/* Challenge content */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                {challenge.icon}
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  {challenge.title}
                </h3>
                <p className="text-white/90 text-sm leading-relaxed">
                  {challenge.description}
                </p>
              </div>
            </div>

            {/* Example tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              {challenge.exampleTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-white/15 text-white text-xs px-3 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* How it works */}
            <div className="bg-white/10 rounded-xl p-4 mb-5">
              <h4 className="text-white font-bold text-sm mb-2">参加方法</h4>
              <ol className="text-white/90 text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  通学路を歩きながら該当するスポットを発見
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  写真を撮影して危険報告として投稿
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  チャレンジ期間中はボーナスポイント獲得！
                </li>
              </ol>
            </div>

            {/* CTA */}
            <Link
              href="/map"
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              <Camera className="w-4 h-4" />
              チャレンジに参加する
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
