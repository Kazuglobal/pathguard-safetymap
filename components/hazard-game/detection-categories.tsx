"use client"

import React, { useState } from "react"
import { Shield, AlertTriangle, Car, Ban, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { VisionResult, DetectionItem, DetectionCategory } from "@/lib/hazard-game-types"

interface DetectionCategoriesProps {
  vision: VisionResult
}

const CATEGORIES: {
  key: keyof Pick<VisionResult, "safetyEquipment" | "hazards" | "traffic" | "obstructions">
  category: DetectionCategory
  label: string
  icon: typeof Shield
  color: string
  bgColor: string
  borderColor: string
}[] = [
  {
    key: "safetyEquipment",
    category: "safety_equipment",
    label: "安全設備",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    key: "hazards",
    category: "hazards",
    label: "危険要素",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  {
    key: "traffic",
    category: "traffic",
    label: "交通状況",
    icon: Car,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    key: "obstructions",
    category: "obstructions",
    label: "障害物",
    icon: Ban,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
]

function DetectionItemRow({ item }: { item: DetectionItem }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="font-medium text-sm text-gray-900">{item.label}</span>
          <Badge variant="secondary" className="text-xs">
            {item.count}件
          </Badge>
        </div>
        <p className="text-xs text-gray-600">{item.description}</p>
      </div>
      <div className="flex-shrink-0 ml-3 w-20">
        <div className="text-right text-xs text-gray-500 mb-1">
          {Math.round(item.confidence * 100)}%
        </div>
        <Progress value={item.confidence * 100} className="h-1.5" />
      </div>
    </div>
  )
}

function CategorySection({
  category,
  items,
}: {
  category: (typeof CATEGORIES)[number]
  items: readonly DetectionItem[]
}) {
  const [expanded, setExpanded] = useState(items.length > 0)
  const Icon = category.icon

  return (
    <Card className={`${category.borderColor} border`}>
      <CardHeader
        className={`pb-2 cursor-pointer ${category.bgColor} rounded-t-lg`}
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className={`h-4 w-4 ${category.color}`} />
            <span>{category.label}</span>
            <Badge variant="outline" className="text-xs">
              {items.length}
            </Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">検出なし</p>
          ) : (
            <div className="space-y-0">
              {items.map((item, i) => (
                <DetectionItemRow key={i} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function DetectionCategories({ vision }: DetectionCategoriesProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center text-gray-900">
        <Shield className="h-5 w-5 mr-2 text-blue-600" />
        検出結果 (4カテゴリ)
      </h3>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.key}
            category={cat}
            items={vision[cat.key]}
          />
        ))}
      </div>
      {vision.inferenceTimeMs > 0 && (
        <p className="text-xs text-gray-400 text-right">
          推論時間: {(vision.inferenceTimeMs / 1000).toFixed(1)}秒
        </p>
      )}
    </div>
  )
}
