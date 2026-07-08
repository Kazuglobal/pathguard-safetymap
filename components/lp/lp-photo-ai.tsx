"use client"

import { motion } from "framer-motion"
import { Camera, Sparkles } from "lucide-react"
import { LP_PHOTO_AI } from "@/lib/lp-content"
import { PhoneFrame } from "@/components/lp/device-frame"

/** 目玉機能: 写真でキケンを見える化(AI画像解析)。実アプリの解析結果画面を掲載 */
export function LpPhotoAi() {
  return (
    <section id="photo-ai" className="overflow-hidden bg-[#F3EFE4] py-28 md:py-36">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 md:grid-cols-2 md:px-8">
        <div>
          <p
            data-reveal
            className="font-lp-display mb-6 inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-[#2B2723] bg-[#E96D4F] px-5 py-2 text-sm font-black tracking-wider text-white shadow-[4px_4px_0_rgba(43,39,35,0.85)]"
          >
            <Sparkles className="h-4 w-4" />
            {LP_PHOTO_AI.eyebrow}
          </p>
          <h2
            data-reveal
            className="font-lp-display text-3xl font-black leading-snug text-[#2B2723] md:text-[2.8rem] md:leading-[1.3]"
          >
            {LP_PHOTO_AI.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p data-reveal className="mt-6 max-w-lg text-base leading-loose text-[#2B2723]/70">
            {LP_PHOTO_AI.body}
          </p>
          <ul data-reveal-group className="mt-8 space-y-4">
            {LP_PHOTO_AI.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 -rotate-3 items-center justify-center rounded-full border-2 border-[#2B2723] bg-[#2FA36B]">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm font-medium leading-relaxed text-[#2B2723]/80">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          data-reveal
          whileHover={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="mx-auto w-[280px] rotate-2 md:w-[320px]"
        >
          <PhoneFrame
            src={LP_PHOTO_AI.image}
            alt="写真の上にAIが危険箇所と安全設備を色分け描画したPathGuardianの実際の画面"
          />
        </motion.div>
      </div>
    </section>
  )
}
