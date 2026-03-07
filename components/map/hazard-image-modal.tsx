"use client"

import Image from "next/image"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { HazardImageResult, RouteHazardMarker } from "@/lib/types"

interface HazardImageModalProps {
  open: boolean
  marker: RouteHazardMarker | null
  imageResult: HazardImageResult | null
  imageError: string | null
  isLoading: boolean
  selectedScenarioKey: string | null
  onOpenChange: (open: boolean) => void
  onScenarioChange: (scenarioKey: string) => void
  onGenerate: () => void
}

export function HazardImageModal({
  open,
  marker,
  imageResult,
  imageError,
  isLoading,
  selectedScenarioKey,
  onOpenChange,
  onScenarioChange,
  onGenerate,
}: HazardImageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{marker?.title ?? "災害イメージ"}</DialogTitle>
          <DialogDescription>
            想定される浸水の見え方と避難のポイントを確認できます
          </DialogDescription>
        </DialogHeader>

        {marker && (
          <div className="grid gap-4 md:grid-cols-[1.3fr,0.9fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-slate-50">
                {imageResult?.imageUrl ? (
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={imageResult.imageUrl}
                      alt={`${marker.title}の災害イメージ`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    {isLoading ? "災害イメージを生成しています..." : "まだ画像は生成されていません"}
                  </div>
                )}
              </div>

              {imageError && (
                <p className="text-sm text-destructive">{imageError}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="hazard-scenario-select">標準シナリオ</Label>
                <Select
                  value={selectedScenarioKey ?? marker.scenario_key}
                  onValueChange={onScenarioChange}
                >
                  <SelectTrigger id="hazard-scenario-select">
                    <SelectValue placeholder="シナリオを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {marker.scenario_options.map((scenario) => (
                      <SelectItem key={scenario.key} value={scenario.key}>
                        {scenario.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={onGenerate} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : imageResult ? (
                  "別シナリオで再生成する"
                ) : (
                  "災害イメージを見る"
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">{marker.hazard_type === "flood" ? "洪水" : "津波"}</Badge>
                <Badge variant="secondary">レベル{marker.risk_level}</Badge>
                <Badge variant="outline">{marker.area_label}</Badge>
              </div>

              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">想定浸水深</p>
                <p className="text-lg font-semibold">{marker.depth_label}</p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">この場所で想定されること</p>
                <p className="mt-2 text-sm text-muted-foreground">{marker.explanation}</p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">避難のポイント</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {marker.evacuation_points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
