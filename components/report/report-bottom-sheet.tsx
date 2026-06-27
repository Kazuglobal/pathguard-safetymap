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
import { Map, Camera, AlertTriangle, Search } from "lucide-react"

interface ReportBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportBottomSheet({ open, onOpenChange }: ReportBottomSheetProps) {
  const router = useRouter()

  const handleMapReport = () => {
    onOpenChange(false)
    router.push("/map?report=open")
  }

  const handleHunter = () => {
    onOpenChange(false)
    router.push("/safety-quest/hunter")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="text-left mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">危険を報告する</SheetTitle>
              <SheetDescription>
                通学路の危険箇所をみんなに共有しましょう
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-3">
          <Button
            variant="outline"
            className="h-16 justify-start gap-4 border-2 text-left"
            onClick={handleMapReport}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
              <Map className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">地図から報告</p>
              <p className="text-xs text-gray-500">マップ上で場所を選んで報告</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-16 justify-start gap-4 border-2 text-left"
            onClick={handleMapReport}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
              <Camera className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">写真付きで報告</p>
              <p className="text-xs text-gray-500">地図で場所を選んだあと写真を追加</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-16 justify-start gap-4 border-2 text-left"
            onClick={handleHunter}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">きけんハンター</p>
              <p className="text-xs text-gray-500">写真の危険をさがす安全れんしゅう</p>
            </div>
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          報告いただいた情報は審査後に公開されます
        </p>
      </SheetContent>
    </Sheet>
  )
}
