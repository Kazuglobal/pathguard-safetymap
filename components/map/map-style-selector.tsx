"use client"

import { useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { MapDisplayOption } from "@/lib/map-display-options"
import { cn } from "@/lib/utils"
import { Check, Layers } from "lucide-react"

const MAP_STYLES = [
  {
    id: "streets-v12",
    name: "標準地図",
    shortName: "標準",
    description: "道路と施設を見やすく表示します",
    previewImage: "/images/map-style-previews/streets.png",
    previewAlt: "標準のプレビュー",
  },
  {
    id: "satellite-v9",
    name: "航空写真",
    shortName: "衛星写真",
    description: "写真ベースで周辺状況を確認します",
    previewImage: "/images/map-style-previews/satellite.png",
    previewAlt: "衛星写真のプレビュー",
  },
  {
    id: "satellite-streets-v12",
    name: "航空写真+道路",
    shortName: "衛星+道路",
    description: "写真と道路名を重ねて表示します",
    previewImage: "/images/map-style-previews/satellite-streets.png",
    previewAlt: "衛星+道路のプレビュー",
  },
  {
    id: "navigation-day-v1",
    name: "ナビゲーション",
    shortName: "ナビ",
    description: "道順を追いやすい配色で表示します",
    previewImage: "/images/map-style-previews/navigation-day.png",
    previewAlt: "ナビのプレビュー",
  },
  {
    id: "light-v11",
    name: "ライトモード",
    shortName: "ライト",
    description: "情報を淡い配色で表示します",
    previewImage: "/images/map-style-previews/light.png",
    previewAlt: "ライトのプレビュー",
  },
  {
    id: "dark-v11",
    name: "ダークモード",
    shortName: "ダーク",
    description: "暗い背景で情報を見やすく表示します",
    previewImage: "/images/map-style-previews/dark.png",
    previewAlt: "ダークのプレビュー",
  },
  {
    id: "outdoors-v12",
    name: "アウトドア",
    shortName: "アウトドア",
    description: "地形を含めて周辺を確認します",
    previewImage: "/images/map-style-previews/outdoors.png",
    previewAlt: "アウトドアのプレビュー",
  },
] as const

interface MapStyleSelectorProps {
  currentStyle: string
  onChange: (style: string) => void
  buttonClassName?: string
  contentAlign?: "start" | "center" | "end"
  compactLabel?: boolean
  buttonLabel?: string
  isMobile?: boolean
  overlayOptions?: MapDisplayOption[]
}

export default function MapStyleSelector({
  currentStyle,
  onChange,
  buttonClassName,
  contentAlign = "end",
  compactLabel = true,
  buttonLabel = "地図スタイル",
  isMobile = false,
  overlayOptions,
}: MapStyleSelectorProps) {
  const [isDisplaySheetOpen, setIsDisplaySheetOpen] = useState(false)
  const hasOverlayOptions = Boolean(overlayOptions?.length)

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className={`flex items-center h-9 sm:h-10 px-2.5 sm:px-3 ${buttonClassName ?? ""}`.trim()}
      aria-label={buttonLabel}
    >
      <Layers className="h-4 w-4 sm:mr-2" />
      <span className={compactLabel ? "hidden sm:inline" : ""}>{buttonLabel}</span>
    </Button>
  )

  if (hasOverlayOptions) {
    const displayContent = (
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">地図の見た目</h3>
            <p className="text-xs text-slate-500">背景の見え方を選びます</p>
          </div>
          <div className="grid gap-2">
            {MAP_STYLES.map((style) => {
              const isSelected = currentStyle === style.id

              return (
                <button
                  key={style.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-sky-300 bg-sky-50 text-sky-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  onClick={() => onChange(style.id)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <Image
                        src={style.previewImage}
                        alt={style.previewAlt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block text-sm font-semibold">{style.shortName}</span>
                      <span className="block text-xs text-slate-500">{style.description}</span>
                    </span>
                  </span>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-600 px-1.5 py-1 text-[10px] font-semibold text-white">
                      <Check className="h-3 w-3" />
                      表示中
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">地図に重ねる情報</h3>
            <p className="text-xs text-slate-500">必要な情報だけを追加表示します</p>
          </div>
          <div className="grid gap-2">
            {overlayOptions?.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  option.selected
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                )}
                onClick={option.onSelect}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {option.previewImage ? (
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <Image
                        src={option.previewImage}
                        alt={option.previewAlt ?? option.label}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.description}</span>
                  </span>
                </span>
                {option.selected ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-1 text-[10px] font-semibold text-white">
                    <Check className="h-3 w-3" />
                    表示中
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </div>
    )

    if (isMobile) {
      return (
        <Drawer open={isDisplaySheetOpen} onOpenChange={setIsDisplaySheetOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="max-h-[82svh] rounded-t-[1.75rem] px-0 pb-6">
            <DrawerHeader className="px-4 text-left">
              <DrawerTitle>表示する情報</DrawerTitle>
              <DrawerDescription>地図の見た目と、重ねて確認する情報を選べます。</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-2">{displayContent}</div>
          </DrawerContent>
        </Drawer>
      )
    }

    return (
      <Popover open={isDisplaySheetOpen} onOpenChange={setIsDisplaySheetOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align={contentAlign} className="w-[24rem] rounded-2xl p-4">
          <div className="mb-4 space-y-1">
            <p className="text-base font-semibold text-slate-950">表示する情報</p>
            <p className="text-xs text-slate-500">地図の見た目と重ねる情報を選択します。</p>
          </div>
          {displayContent}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={contentAlign}>
        <DropdownMenuLabel>地図スタイルを選択</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MAP_STYLES.map((style) => (
          <DropdownMenuItem
            key={style.id}
            onClick={() => onChange(style.id)}
            className={currentStyle === style.id ? "bg-muted" : ""}
          >
            {style.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
