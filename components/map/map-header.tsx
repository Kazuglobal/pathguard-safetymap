"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { MapPin, Menu, User, LogOut, BarChart, Car, Shield, AlertTriangle, HelpCircle, Trophy, Flag, Map, PlusCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Import the MapStyleSelector component
import MapStyleSelector from "./map-style-selector"

// Gamification hooks
import { useGamification } from "@/hooks/use-gamification"

// Update the interface to include 3D toggle props and isSelectingLocation
interface MapHeaderProps {
  onAddReport: () => void
  isReportFormOpen: boolean
  mapStyle: string
  setMapStyle: (style: string) => void
  is3DEnabled: boolean
  toggle3DMode: () => void
  isSelectingLocation?: boolean
}

// Update the function signature to use the new props
export default function MapHeader({
  onAddReport,
  isReportFormOpen,
  mapStyle,
  setMapStyle,
  is3DEnabled,
  toggle3DMode,
  isSelectingLocation,
}: MapHeaderProps) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const { points } = useGamification()

  // ユーザー情報を取得
  useState(() => {
    const checkUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()

      if (data && data.role === "admin") {
        setIsAdmin(true)
      }
    }

    checkUserRole()
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast({
      title: "ログアウト",
      description: "ログアウトしました。",
    })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="bg-white border-b px-4 py-3 flex flex-col sm:flex-row items-center justify-between z-20 relative space-y-2 sm:space-y-0">
      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
        <h1 className="text-xl font-bold">通学路安全マップ</h1>
        {/* 危険種別のレジェンド（小画面では非表示） */}
        <div className="flex items-center space-x-4 overflow-x-auto">
          <div className="flex items-center space-x-1">
            <Car className="h-5 w-5 text-blue-600" />
            <span className="text-sm">交通危険</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className="h-5 w-5 text-red-600" />
            <span className="text-sm">犯罪危険</span>
          </div>
          <div className="flex items-center space-x-1">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="text-sm">災害危険</span>
          </div>
          <div className="flex items-center space-x-1">
            <HelpCircle className="h-5 w-5 text-gray-600" />
            <span className="text-sm">その他</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* Replace the map style dropdown we added earlier with the MapStyleSelector component */}
        <MapStyleSelector currentStyle={mapStyle} onChange={setMapStyle} />

        <Button
          onClick={onAddReport}
          variant={isReportFormOpen || isSelectingLocation ? "secondary" : "default"}
          size="sm"
        >
          {isSelectingLocation ? (
            <>
              <MapPin className="mr-2 h-4 w-4 animate-pulse" />
              地点選択中...
            </>
          ) : isReportFormOpen ? (
            "報告フォーム入力中"
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              危険箇所を報告
            </>
          )}
        </Button>

        {/* 現在ポイント表示 */}
        <div className="flex items-center space-x-1 mr-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className="text-sm font-medium">{points}pt</span>
        </div>

      </div>
    </header>
  )
}
