"use client"

import React, { useState } from "react"
import { Gamepad2, Info, History, ArrowLeft, GraduationCap, Users, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ImageUploader } from "@/components/hazard-game/image-uploader"
import { AnalysisResults } from "@/components/hazard-game/analysis-results"
import { GameStats } from "@/components/hazard-game/game-stats"
import { LoadingAnimation } from "@/components/hazard-game/loading-animation"
import { useHazardGame } from "@/hooks/use-hazard-game"
import Link from "next/link"
import type { PromptType } from "@/lib/hazard-game-types"

type GameState = "intro" | "upload" | "analyzing" | "results"

export default function HazardGamePage() {
  const [gameState, setGameState] = useState<GameState>("intro")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [promptType, setPromptType] = useState<PromptType>("default")

  const {
    isAnalyzing,
    analysisResult,
    error,
    pipelineProgress,
    gameHistory,
    gameStats,
    analyzeImage,
    resetAnalysis,
    getUserRank,
    getAchievementLevel,
  } = useHazardGame()

  const handleStartGame = () => {
    setGameState("upload")
    resetAnalysis()
    setSelectedFile(null)
  }

  const handleImageSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleAnalyzeImage = async () => {
    if (!selectedFile) return

    setGameState("analyzing")
    try {
      await analyzeImage(selectedFile, undefined, promptType)
      setGameState("results")
    } catch (err) {
      setGameState("upload")
    }
  }

  const handlePlayAgain = () => {
    setGameState("upload")
    resetAnalysis()
    setSelectedFile(null)
  }

  const renderIntroScreen = () => (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-2xl">
        <Gamepad2 className="h-16 w-16 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-4">写真危険発見ゲーム</h1>
        <p className="text-blue-100 text-lg">
          AIと一緒に写真から潜在的な危険を見つけ出そう！
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2 text-blue-500" />
            ゲームのルール
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-left">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <p>街中や通学路の写真をアップロードします</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <p>AIが写真を分析して潜在的な危険要素を検出します</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <p>検出された危険の数と精度に応じてポイントを獲得</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <p>安全に関する教育的なアドバイスを学習します</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          より多くの危険要素が含まれている写真（交差点、工事現場、公園など）で
          高得点を狙えます！プライバシーに配慮し、人物の顔が写っていない写真を使用してください。
        </AlertDescription>
      </Alert>

      <Button 
        onClick={handleStartGame}
        size="lg"
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        ゲームを始める
      </Button>
    </div>
  )

  const renderUploadScreen = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          写真をアップロード
        </h2>
        <p className="text-gray-600">
          分析したい写真を選択してください
        </p>
      </div>

      {/* プロンプトタイプ選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-blue-500" />
            分析モードを選択
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={promptType} onValueChange={(value) => setPromptType(value as PromptType)}>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="default" id="default" className="mt-1" />
                <Label htmlFor="default" className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">標準モード</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    バランスの取れた分析。潜在的な危険や複合的なリスクも検出します。
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="expert" id="expert" className="mt-1" />
                <Label htmlFor="expert" className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <GraduationCap className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">専門家モード</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    詳細な分析。土砂災害、水害、建物倒壊、交通事故、防災設備など多角的にリスクを評価します。
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="child" id="child" className="mt-1" />
                <Label htmlFor="child" className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="font-medium">子ども向けモード</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    やさしい言葉で説明。小学生でも理解できるように、わかりやすく楽しく学べる内容です。
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <ImageUploader 
        onImageSelect={handleImageSelect}
        disabled={isAnalyzing}
      />

      {selectedFile && (
        <div className="text-center space-y-4">
          <Button
            onClick={handleAnalyzeImage}
            disabled={isAnalyzing}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            {isAnalyzing ? "分析中..." : "分析開始"}
          </Button>
          
          <div className="flex justify-center space-x-4">
            <Button
              variant="outline"
              onClick={handleStartGame}
              disabled={isAnalyzing}
            >
              写真を変更
            </Button>
            <Button
              variant="outline"
              onClick={() => setGameState("intro")}
              disabled={isAnalyzing}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  const renderAnalyzingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <LoadingAnimation pipelineProgress={pipelineProgress} />
    </div>
  )

  const renderResultsScreen = () => (
    <div className="max-w-4xl mx-auto">
      {analysisResult && (
        <AnalysisResults
          result={analysisResult}
          onPlayAgain={handlePlayAgain}
          sourceImageFile={selectedFile || undefined}
        />
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Gamepad2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                写真危険発見ゲーム
              </h1>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                ダッシュボード
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {gameState === "intro" || gameState === "upload" ? (
          <Tabs defaultValue="game" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="game">ゲーム</TabsTrigger>
              <TabsTrigger value="stats">
                <History className="h-4 w-4 mr-2" />
                統計・履歴
              </TabsTrigger>
            </TabsList>

            <TabsContent value="game">
              {gameState === "intro" ? renderIntroScreen() : renderUploadScreen()}
            </TabsContent>

            <TabsContent value="stats">
              <GameStats
                stats={gameStats}
                getUserRank={getUserRank}
                getAchievementLevel={getAchievementLevel}
              />
            </TabsContent>
          </Tabs>
        ) : gameState === "analyzing" ? (
          renderAnalyzingScreen()
        ) : (
          renderResultsScreen()
        )}
      </div>
    </div>
  )
}
