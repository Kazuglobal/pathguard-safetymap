"use client"

import { useState } from "react"
import { Camera, Check, Image as ImageIcon, Sparkles, Star, Upload } from "lucide-react"
import { readFileAsDataUrl } from "@/lib/read-file-as-data-url"
import { GameHeader, StatusPill } from "@/components/safety-quest/quest-primitives"
import { DangerCloud, Mascot } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"

export function ArPhotoScreen({ onBack }: { onBack: () => void }) {
  const [practicePhotoName, setPracticePhotoName] = useState<string | null>(null)
  const [practiceStatus, setPracticeStatus] = useState("練習写真を準備しました")
  const [arFindCount, setArFindCount] = useState(3)
  const [hintCount, setHintCount] = useState(2)
  const [arMessage, setArMessage] = useState("やったね! あぶないサインをみつけたよ!")

  const submitPrivatePracticePhoto = async (file: File) => {
    if (typeof fetch !== "function") return

    try {
      const imageBase64 = await readFileAsDataUrl(file)
      const response = await fetch("/api/safety-quest/private-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          userMarkers: [],
        }),
      })
      if (!response.ok) return

      const body = await response.json().catch(() => null)
      const pointsAwarded = Number(body?.pointsAwarded ?? 0)
      setPracticeStatus(pointsAwarded > 0 ? `AIが安全ポイントを確認しました +${pointsAwarded}pt` : "AIが安全ポイントを確認しました")
    } catch {
      setPracticeStatus("練習写真を準備しました")
    }
  }

  const handlePracticeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPracticePhotoName(file.name)
    setPracticeStatus("練習写真を準備しました")
    void submitPrivatePracticePhoto(file)
  }

  return (
    <div className="flex h-full flex-col bg-[#0b2551]">
      <GameHeader
        title="ARたんけんフォト"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Check className="h-4 w-4 text-[#10b981]" />} value={`みつけた数 ${arFindCount}/5`} />}
      />
      <div className="relative flex-1 overflow-hidden">
        <StreetPhotoScene ar />
        <div className="absolute left-7 top-6 rounded-[18px] bg-white/92 px-5 py-3 shadow-lg">
          <p className="rounded-full bg-[#13a89e] px-3 py-1 text-xs font-black text-white">ミッション</p>
          <p className="mt-2 text-sm font-black">あぶないサインを みつけよう!</p>
        </div>
        <div className="absolute right-7 top-6 w-[300px] rounded-[20px] border-2 border-white/70 bg-white/95 p-4 text-[#0b2551] shadow-xl">
          <h3 className="text-lg font-black">自分で練習</h3>
          <p className="mt-2 text-xs font-bold leading-relaxed text-[#31516f]">
            顔・名前・学校名・家の入口・車のナンバーが写っていない写真だけを使ってください。
          </p>
          <input
            id="safety-quest-private-practice-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="練習写真をアップロード"
            onChange={handlePracticeUpload}
          />
          <label
            htmlFor="safety-quest-private-practice-upload"
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[16px] bg-[#0d66c4] px-4 py-3 text-sm font-black text-white shadow"
          >
            <Upload className="h-5 w-5" />
            写真をアップロード
          </label>
          {practicePhotoName && (
            <div className="mt-3 rounded-[14px] border-2 border-[#b7ead1] bg-[#ecfdf5] p-3 text-xs font-black text-[#087b55]">
              <p>{practiceStatus}</p>
              <p className="mt-1 truncate text-[#31516f]">{practicePhotoName}</p>
            </div>
          )}
        </div>
        <div className="absolute left-[61%] top-[24%] grid h-28 w-28 -translate-x-1/2 place-items-center rounded-[18px] border-4 border-[#ff6b6b] bg-[#ef4444]/18 shadow-[0_0_28px_rgba(239,68,68,.8)]">
          <span className="text-6xl font-black text-[#ff6b6b] drop-shadow">!</span>
        </div>
        <div className="absolute right-[18%] top-[50%]">
          <Star className="h-24 w-24 fill-[#ffcf35] text-[#ffcf35] drop-shadow-[0_0_18px_rgba(250,204,21,.85)]" />
        </div>
        <div className="absolute left-[18%] top-[36%] h-24 w-24">
          <DangerCloud />
        </div>
        <div className="absolute bottom-24 left-10 right-10 flex items-center gap-4 rounded-[18px] bg-white/92 p-4 shadow-xl">
          <Mascot size="sm" />
          <p className="flex-1 text-sm font-black">{arMessage}</p>
          <span className="text-xl font-black text-[#f97316]">+50pt</span>
        </div>
        <div className="absolute bottom-5 left-0 right-0 flex items-end justify-center gap-16 text-white">
          <button
            type="button"
            onClick={() => setArMessage(practicePhotoName ? `${practicePhotoName} をアルバムで確認中` : "まだ練習写真がありません")}
            className="grid h-16 w-16 place-items-center rounded-[18px] border-2 border-white/70 bg-[#0b2551]/60"
            aria-label="アルバム"
          >
            <ImageIcon className="h-8 w-8" />
          </button>
          <button
            type="button"
            onClick={() => {
              setArFindCount((current) => Math.min(5, current + 1))
              setArMessage("撮影しました。あぶないサイン +1")
            }}
            className="grid h-24 w-24 place-items-center rounded-full border-8 border-white bg-[#318ff0] shadow-2xl"
            aria-label="撮影"
          >
            <Camera className="h-12 w-12" />
          </button>
          <button
            type="button"
            onClick={() => {
              setHintCount((current) => Math.max(0, current - 1))
              setArMessage("ヒント: 標識の近くをよく見てみよう")
            }}
            className="relative grid h-16 w-16 place-items-center rounded-[18px] border-2 border-white/70 bg-[#0b2551]/60"
            aria-label="ヒント"
          >
            <Sparkles className="h-8 w-8 text-[#facc15]" />
            <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-[#0b2551]">{hintCount}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
