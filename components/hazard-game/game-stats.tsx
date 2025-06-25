"use client"

import React from "react"
import { TrendingUp, Target, Award, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GameStatsProps {
  stats: {
    totalSessions: number
    averageScore: number
    highScore: number
    totalHazardsDetected: number
  }
  getUserRank: (score: number) => string
  getAchievementLevel: (totalSessions: number) => string
}

export function GameStats({ stats, getUserRank, getAchievementLevel }: GameStatsProps) {
  const achievements = [
    {
      icon: Target,
      title: "最高スコア",
      value: `${stats.highScore}点`,
      description: getUserRank(stats.highScore),
      color: "text-yellow-600 bg-yellow-100",
    },
    {
      icon: TrendingUp,
      title: "平均スコア",
      value: `${stats.averageScore}点`,
      description: `${stats.totalSessions}回のプレイから`,
      color: "text-blue-600 bg-blue-100",
    },
    {
      icon: Eye,
      title: "危険発見数",
      value: `${stats.totalHazardsDetected}個`,
      description: "累計で発見した危険要素",
      color: "text-red-600 bg-red-100",
    },
    {
      icon: Award,
      title: "達成レベル",
      value: getAchievementLevel(stats.totalSessions),
      description: `プレイ回数: ${stats.totalSessions}回`,
      color: "text-purple-600 bg-purple-100",
    },
  ]

  if (stats.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-400 mb-4">
            <Target className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            まだプレイ記録がありません
          </h3>
          <p className="text-gray-600">
            写真をアップロードして、最初のゲームを始めましょう！
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">あなたの成績</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((achievement, index) => {
          const Icon = achievement.icon
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${achievement.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {achievement.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {achievement.value}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Progress towards next level */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                次のレベルまで
              </p>
              <p className="text-xs text-gray-600">
                {getNextLevelInfo(stats.totalSessions)}
              </p>
            </div>
            <Badge variant="secondary">
              {getAchievementLevel(stats.totalSessions)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getNextLevelInfo(totalSessions: number): string {
  if (totalSessions >= 100) return "最高レベル達成済み！"
  if (totalSessions >= 50) return `レジェンドまであと ${100 - totalSessions} 回`
  if (totalSessions >= 25) return `マスターまであと ${50 - totalSessions} 回`
  if (totalSessions >= 10) return `エキスパートまであと ${25 - totalSessions} 回`
  if (totalSessions >= 5) return `アマチュアまであと ${10 - totalSessions} 回`
  return `初心者まであと ${5 - totalSessions} 回`
}