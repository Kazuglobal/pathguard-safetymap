"use client"

import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Search, UserX } from "lucide-react"

interface ReportBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportBottomSheet({ open, onOpenChange }: ReportBottomSheetProps) {
  const router = useRouter()

  const handleHunter = () => {
    onOpenChange(false)
    router.push("/safety-quest/hunter")
  }

  const handleSuspiciousAlert = () => {
    onOpenChange(false)
    router.push("/map?suspiciousAlert=1")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="text-left mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">きけんハンター</SheetTitle>
              <SheetDescription>
                写真にかくれた危険をさがして、気をつける練習をしよう
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-3">
          <Button
            variant="outline"
            className="h-16 justify-start gap-4 border-2 text-left"
            onClick={handleHunter}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">きけんハンターをはじめる</p>
              <p className="text-xs text-gray-500">写真をえらんで、危険をさがそう</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-16 justify-start gap-4 border-2 text-left"
            onClick={handleSuspiciousAlert}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
              <UserX className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">不審者アラートを地図化</p>
              <p className="text-xs text-gray-500">学校からの不審者情報を地図ですぐ共有</p>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
