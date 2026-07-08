"use client"

import { motion } from "framer-motion"
import { LP_PROBLEM } from "@/lib/lp-content"

const CARD_COLORS: Record<string, { bg: string; tag: string }> = {
  coral: { bg: "#E96D4F", tag: "#F3EFE4" },
  amber: { bg: "#E8A33D", tag: "#2B2723" },
  green: { bg: "#2FA36B", tag: "#F3EFE4" },
}

const CARD_ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1"]

export function LpProblem() {
  return (
    <section id="problem" className="relative overflow-hidden bg-[#26221E] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="font-lp-display mb-4 text-sm font-black tracking-[0.2em] text-[#E8A33D]">
          {LP_PROBLEM.eyebrow}
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-3xl text-3xl font-black leading-snug text-white md:text-[2.8rem] md:leading-[1.3]"
        >
          {LP_PROBLEM.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>

        {/* ステッカー風カードデッキ */}
        <div data-reveal-group className="mt-16 grid gap-8 md:grid-cols-3">
          {LP_PROBLEM.cards.map((card, index) => {
            const palette = CARD_COLORS[card.color] ?? CARD_COLORS.amber
            return (
              <motion.article
                key={card.tag}
                whileHover={{ rotate: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className={`${CARD_ROTATIONS[index % CARD_ROTATIONS.length]} rounded-[1.8rem] p-8 shadow-[10px_10px_0_rgba(0,0,0,0.45)] md:p-9`}
                style={{ backgroundColor: palette.bg }}
              >
                <span
                  className="font-lp-display inline-block rounded-full px-4 py-1.5 text-sm font-black"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.22)",
                    color: palette.tag,
                  }}
                >
                  {card.tag}
                </span>
                <h3 className="font-lp-display mt-6 whitespace-pre-line text-2xl font-black leading-snug text-white">
                  {card.title}
                </h3>
                <p className="mt-5 text-sm font-medium leading-relaxed text-white/85">{card.body}</p>
              </motion.article>
            )
          })}
        </div>

        <p data-reveal className="mt-14 max-w-2xl text-base leading-loose text-white/75">
          {LP_PROBLEM.outro}
        </p>
      </div>
    </section>
  )
}
