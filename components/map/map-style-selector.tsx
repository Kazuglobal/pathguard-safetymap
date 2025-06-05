"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Layers } from "lucide-react"

interface MapStyleSelectorProps {
  currentStyle: string
  onChange: (style: string) => void
}

export default function MapStyleSelector({ currentStyle, onChange }: MapStyleSelectorProps) {
  const mapStyles = [
    { id: "streets-v12", name: "標準地図" },
    { id: "satellite-v9", name: "航空写真" },
    { id: "satellite-streets-v12", name: "航空写真+道路" },
    { id: "navigation-day-v1", name: "ナビゲーション" },
    { id: "light-v11", name: "ライトモード" },
    { id: "dark-v11", name: "ダークモード" },
    { id: "outdoors-v12", name: "アウトドア" },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center">
          <Layers className="h-4 w-4 mr-2" />
          地図スタイル
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>地図スタイルを選択</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mapStyles.map((style) => (
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
