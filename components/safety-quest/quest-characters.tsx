"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

export function PlayerFace({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-[#ffe2bd] shadow-md",
        size === "sm" && "h-9 w-9",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-16 w-16",
        className,
      )}
    >
      <div className="absolute left-1/2 top-0 h-[34%] w-[84%] -translate-x-1/2 rounded-b-full bg-[#243142]" />
      <span className="absolute left-[29%] top-[45%] h-1.5 w-1.5 rounded-full bg-[#1f2937]" />
      <span className="absolute right-[29%] top-[45%] h-1.5 w-1.5 rounded-full bg-[#1f2937]" />
      <span className="absolute left-1/2 top-[62%] h-1.5 w-4 -translate-x-1/2 rounded-b-full border-b-2 border-[#ef6f6c]" />
    </div>
  )
}

export function Mascot({ size = "md", className, pose = "happy" }: { size?: "sm" | "md" | "lg"; className?: string; pose?: "happy" | "point" | "jump" }) {
  return (
    <div
      className={cn(
        "relative shrink-0",
        size === "sm" && "h-20 w-16",
        size === "md" && "h-28 w-24",
        size === "lg" && "h-40 w-32",
        className,
      )}
    >
      <div className="absolute bottom-[8%] left-[5%] h-[36%] w-[24%] rotate-[-18deg] rounded-full bg-[#174b87]" />
      <div className="absolute bottom-[8%] right-[5%] h-[36%] w-[24%] rotate-[18deg] rounded-full bg-[#174b87]" />
      <div
        className="absolute left-1/2 top-[8%] h-[78%] w-[76%] -translate-x-1/2 border-[4px] border-[#0f4d8c] bg-gradient-to-b from-[#5ed1ff] to-[#1f73c9] shadow-lg"
        style={{ clipPath: "polygon(50% 0%, 91% 15%, 80% 77%, 50% 100%, 20% 77%, 9% 15%)" }}
      />
      <div className="absolute left-1/2 top-[25%] h-[34%] w-[50%] -translate-x-1/2 rounded-full border-2 border-[#0f4d8c] bg-[#fff3dd]">
        <span className="absolute left-[27%] top-[40%] h-1.5 w-1.5 rounded-full bg-[#111827]" />
        <span className="absolute right-[27%] top-[40%] h-1.5 w-1.5 rounded-full bg-[#111827]" />
        <span className="absolute left-1/2 top-[62%] h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#ef6f6c]" />
      </div>
      <div
        className={cn(
          "absolute top-[39%] h-[9%] w-[32%] rounded-full bg-[#fff7d6] shadow",
          pose === "point" ? "right-[-8%] -rotate-12" : "left-[-8%] rotate-12",
        )}
      />
      <div
        className={cn(
          "absolute top-[39%] h-[9%] w-[32%] rounded-full bg-[#fff7d6] shadow",
          pose === "point" ? "left-[4%] rotate-[35deg]" : "right-[-8%] -rotate-12",
        )}
      />
      {pose === "jump" && <div className="absolute bottom-0 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-black/10 blur-sm" />}
    </div>
  )
}

export function KidAvatar({ color = "#22c55e", hat = "ぼうし", className }: { color?: string; hat?: string; className?: string }) {
  const hatColor = hat === "ヘルメット" ? "#facc15" : hat === "キャップ" ? "#3b82f6" : hat === "ねこ耳" ? "#f5b7c8" : color
  return (
    <div className={cn("relative h-64 w-40", className)}>
      <div className="absolute left-1/2 top-12 h-24 w-24 -translate-x-1/2 rounded-full border-4 border-[#9a6a43] bg-[#ffe0bd] shadow-md">
        <div className="absolute left-1/2 top-0 h-8 w-20 -translate-x-1/2 rounded-b-full bg-[#523525]" />
        <span className="absolute left-[28%] top-[47%] h-2 w-2 rounded-full bg-[#111827]" />
        <span className="absolute right-[28%] top-[47%] h-2 w-2 rounded-full bg-[#111827]" />
        <span className="absolute left-1/2 top-[68%] h-2 w-8 -translate-x-1/2 rounded-b-full border-b-[3px] border-[#ef6f6c]" />
      </div>
      <div className="absolute left-1/2 top-7 h-12 w-28 -translate-x-1/2 rounded-t-[48px] rounded-b-[18px] border-4 border-[#31583b] shadow" style={{ background: hatColor }} />
      {hat === "ねこ耳" && (
        <>
          <span className="absolute left-8 top-3 h-8 w-7 rotate-[-20deg] rounded-t-full bg-[#f5b7c8]" />
          <span className="absolute right-8 top-3 h-8 w-7 rotate-[20deg] rounded-t-full bg-[#f5b7c8]" />
        </>
      )}
      <div className="absolute left-1/2 top-[132px] h-20 w-28 -translate-x-1/2 rounded-[24px] border-4 border-[#31583b]" style={{ background: color }} />
      <div className="absolute left-5 top-[140px] h-16 w-8 rotate-[18deg] rounded-full border-4 border-[#31583b] bg-[#ffe0bd]" />
      <div className="absolute right-5 top-[140px] h-16 w-8 rotate-[-18deg] rounded-full border-4 border-[#31583b] bg-[#ffe0bd]" />
      <div className="absolute bottom-0 left-10 h-16 w-8 rounded-full bg-[#2563eb]" />
      <div className="absolute bottom-0 right-10 h-16 w-8 rounded-full bg-[#2563eb]" />
      <div className="absolute bottom-[-4px] left-7 h-5 w-12 rounded-full bg-[#27563b]" />
      <div className="absolute bottom-[-4px] right-7 h-5 w-12 rounded-full bg-[#27563b]" />
    </div>
  )
}

export function KidDetective() {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <PlayerFace size="lg" className="absolute left-7 top-4" />
      <div className="absolute left-8 top-0 h-8 w-20 rounded-full bg-[#a96b2d]" />
      <div className="absolute left-11 top-[70px] h-24 w-20 rounded-[24px] bg-[#b87935]" />
      <Search className="absolute right-0 top-10 h-12 w-12 rounded-full border-4 border-[#895022] bg-white/80 p-1 text-[#895022]" />
    </div>
  )
}

export function DangerCloud() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-8 top-8 h-28 rounded-full bg-[#7e3fa4]" />
      <div className="absolute left-4 top-12 h-24 w-24 rounded-full bg-[#7e3fa4]" />
      <div className="absolute right-4 top-12 h-24 w-24 rounded-full bg-[#7e3fa4]" />
      <div className="absolute left-1/2 top-14 h-24 w-28 -translate-x-1/2 rounded-full bg-[#612b84]" />
      <span className="absolute left-[38%] top-[42%] h-3 w-3 rounded-full bg-[#facc15]" />
      <span className="absolute right-[38%] top-[42%] h-3 w-3 rounded-full bg-[#facc15]" />
      <span className="absolute left-1/2 top-[56%] h-5 w-12 -translate-x-1/2 rounded-b-full border-b-[5px] border-[#ff6b6b]" />
      <div className="absolute bottom-10 left-7 h-12 w-5 -rotate-12 rounded-full bg-[#612b84]" />
      <div className="absolute bottom-10 right-7 h-12 w-5 rotate-12 rounded-full bg-[#612b84]" />
    </div>
  )
}
