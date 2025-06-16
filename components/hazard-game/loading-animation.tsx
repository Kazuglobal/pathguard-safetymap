"use client"

import React from "react"
import { Loader2, Eye, Search, Brain } from "lucide-react"

export function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {/* Main loading spinner */}
      <div className="relative">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="h-6 w-6 text-blue-400" />
        </div>
      </div>

      {/* Loading text */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          AI が写真を分析中...
        </h3>
        <p className="text-gray-600 max-w-md">
          画像から潜在的な危険要素を検出し、安全性を評価しています
        </p>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center space-x-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-blue-100 rounded-full">
            <Eye className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-sm text-gray-600">画像認識</span>
        </div>
        
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-green-100 rounded-full">
            <Search className="h-5 w-5 text-green-600" />
          </div>
          <span className="text-sm text-gray-600">危険検出</span>
        </div>
        
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-purple-100 rounded-full">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
          <span className="text-sm text-gray-600">分析評価</span>
        </div>
      </div>

      {/* Tips while waiting */}
      <div className="bg-blue-50 rounded-lg p-4 max-w-md text-center">
        <p className="text-sm text-blue-800">
          💡 <strong>ヒント:</strong> 通学路、公園、交差点などの写真は、
          より多くの危険要素を発見できる可能性があります
        </p>
      </div>
    </div>
  )
}