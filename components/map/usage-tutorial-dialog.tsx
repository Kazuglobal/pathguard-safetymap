"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Camera, MapPin, AlertTriangle, Users, Star, ChevronLeft, ChevronRight } from "lucide-react"

interface UsageTutorialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UsageTutorialDialog({ open, onOpenChange }: UsageTutorialDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const tutorialSteps = [
    {
      title: "PathGuardianへようこそ！",
      description: "AIで通学路・通勤路の安全性を可視化するアプリです",
      icon: <Star className="w-8 h-8 text-yellow-500" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🛡️</div>
            <p className="text-gray-600 leading-relaxed">
              PathGuardianは、AIを活用して日常の道路や建物の安全性を分析し、
              地域の防災・減災に貢献するアプリです。
            </p>
          </div>
          <div className="bg-sky-50 p-4 rounded-lg">
            <p className="text-sm text-sky-700 font-medium">
              📱 簡単操作で、あなたも地域の安全を守る一員になれます！
            </p>
          </div>
        </div>
      )
    },
    {
      title: "📷 ステップ1: 写真を撮影",
      description: "気になる場所をスマホで撮影するだけ",
      icon: <Camera className="w-8 h-8 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm font-medium text-green-700">撮影すべき場所</p>
              <ul className="text-xs text-green-600 mt-2 space-y-1">
                <li>• 古い建物・塀</li>
                <li>• ひび割れした道路</li>
                <li>• 傾いた電柱</li>
                <li>• 老朽化した橋</li>
              </ul>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl mb-2">❌</div>
              <p className="text-sm font-medium text-red-700">避けるべきもの</p>
              <ul className="text-xs text-red-600 mt-2 space-y-1">
                <li>• 人の顔が写る写真</li>
                <li>• プライベートな場所</li>
                <li>• 車のナンバープレート</li>
                <li>• 個人情報</li>
              </ul>
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>コツ:</strong> 明るい時間帯に、対象物全体がはっきり写るように撮影しましょう
            </p>
          </div>
        </div>
      )
    },
    {
      title: "🤖 ステップ2: AI分析",
      description: "AIが自動で危険度を5段階で評価",
      icon: <AlertTriangle className="w-8 h-8 text-orange-500" />,
      content: (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-gray-600 mb-4">
              撮影した写真をAIが分析し、災害時のリスクを5段階で評価します
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded">
              <Badge variant="destructive" className="w-16 text-center">危険</Badge>
              <span className="text-sm">⚠️ 早急な対策が必要</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded">
              <Badge className="w-16 text-center bg-orange-500">注意</Badge>
              <span className="text-sm">🔍 継続的な監視が推奨</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded">
              <Badge className="w-16 text-center bg-yellow-500">普通</Badge>
              <span className="text-sm">📋 定期点検を推奨</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded">
              <Badge className="w-16 text-center bg-blue-500">良好</Badge>
              <span className="text-sm">👍 現状維持で問題なし</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded">
              <Badge className="w-16 text-center bg-green-500">安全</Badge>
              <span className="text-sm">✨ 非常に良好な状態</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "🗺️ ステップ3: マップで確認",
      description: "結果をリアルタイムでマップに反映",
      icon: <MapPin className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">マップの使い方</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500">📍</span>
                <span><strong>マーカーをクリック:</strong> 詳細情報を確認</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">🔍</span>
                <span><strong>ズーム/パン:</strong> 地域を詳しく探索</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">📊</span>
                <span><strong>フィルター:</strong> 危険度別に表示切り替え</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">📷</span>
                <span><strong>写真追加:</strong> 新しい場所を報告</span>
              </li>
            </ul>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm text-green-700">
              🌟 あなたの報告が地域の安全向上に貢献します！
            </p>
          </div>
        </div>
      )
    },
    {
      title: "👥 コミュニティで安全を守る",
      description: "みんなで作る安全な街づくり",
      icon: <Users className="w-8 h-8 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🤝</div>
            <p className="text-gray-600 leading-relaxed mb-4">
              PathGuardianは一人ひとりの報告で成り立っています。
              あなたの参加が、地域全体の安全につながります。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl mb-1">🏆</div>
              <p className="text-xs font-medium text-blue-700">バッジ獲得</p>
              <p className="text-xs text-blue-600">活動に応じて特別バッジを獲得</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl mb-1">📈</div>
              <p className="text-xs font-medium text-green-700">ポイント獲得</p>
              <p className="text-xs text-green-600">報告数に応じてポイントアップ</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-xl mb-1">👑</div>
              <p className="text-xs font-medium text-yellow-700">ランキング</p>
              <p className="text-xs text-yellow-600">地域の安全貢献度をランキング</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-xl mb-1">🎯</div>
              <p className="text-xs font-medium text-purple-700">ミッション</p>
              <p className="text-xs text-purple-600">楽しみながら安全活動に参加</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm font-semibold text-blue-800 mb-2">
              🚀 さあ、安全な街づくりを始めましょう！
            </p>
            <p className="text-xs text-blue-600">
              マップをクリックして、まずは周辺の状況を確認してみてください
            </p>
          </div>
        </div>
      )
    }
  ]

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setCurrentStep(0)
    onOpenChange(false)
    // ローカルストレージに初回表示済みを記録
    localStorage.setItem('pathguard-tutorial-completed', 'true')
  }

  const currentStepData = tutorialSteps[currentStep]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            {currentStepData.icon}
          </div>
          <DialogTitle className="text-xl font-bold">
            {currentStepData.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {currentStepData.content}
        </div>

        {/* ステップインジケーター */}
        <div className="flex justify-center gap-2 mb-4">
          {tutorialSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-sky-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            前へ
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              スキップ
            </Button>
            
            {currentStep === tutorialSteps.length - 1 ? (
              <Button onClick={handleClose} className="bg-sky-600 hover:bg-sky-700">
                始める
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700"
              >
                次へ
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 