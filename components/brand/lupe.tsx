"use client"

import { motion, useReducedMotion } from "framer-motion"

import { tankenTokens } from "@/lib/design/tanken"

/**
 * 相棒のルペ(虫めがねのレンズが顔・上に黄色い安全帽・右下に木のもち手)。
 * きけんハンター・紹介HP(/lp)・ログインの画面・セーフティクエストで、同じルペを出す(UIUX改装 項目15)。
 * ふわふわ浮く(動きを減らす設定のときは止める)。
 */

const C = tankenTokens.color

export type LupeSize = "sm" | "md" | "lg" | "xl"
export type LupeMood = "happy" | "cheer" | "think" | "wow"

const LUPE_PX: Record<LupeSize, number> = { sm: 52, md: 88, lg: 132, xl: 168 }

const MOOD_LABEL: Record<LupeMood, string> = {
  happy: "にこにこの ルペ",
  cheer: "おうえんする ルペ",
  think: "かんがえちゅうの ルペ",
  wow: "びっくりして よろこぶ ルペ",
}

function LupeEyes({ mood }: { mood: LupeMood }) {
  const ink = C.ink
  if (mood === "think") {
    // 目は開けたまま少し上を見る(居眠りに見せない)
    return (
      <g fill={ink}>
        <circle cx={52} cy={58.5} r={5} />
        <circle cx={72} cy={58.5} r={5} />
        <circle cx={51} cy={56.5} r={1.7} fill="#fff" />
        <circle cx={71} cy={56.5} r={1.7} fill="#fff" />
        <path d="M45 50 q6 -4 13 -2" stroke={ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        <path d="M66 48 q7 -2 13 2" stroke={ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </g>
    )
  }
  if (mood === "cheer") {
    return (
      <g>
        <path d="M46 60 q6 -6 12 0" stroke={ink} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        <circle cx={72} cy={60} r={5.4} fill={ink} />
        <circle cx={70.2} cy={58} r={1.8} fill="#fff" />
      </g>
    )
  }
  if (mood === "wow") {
    return (
      <g fill={ink}>
        <SmallStar cx={52} cy={60} r={6.6} />
        <SmallStar cx={72} cy={60} r={6.6} />
      </g>
    )
  }
  return (
    <g fill={ink}>
      <circle cx={52} cy={60} r={5.4} />
      <circle cx={72} cy={60} r={5.4} />
      <circle cx={50.2} cy={58} r={1.8} fill="#fff" />
      <circle cx={70.2} cy={58} r={1.8} fill="#fff" />
    </g>
  )
}

function LupeMouth({ mood }: { mood: LupeMood }) {
  if (mood === "wow") return <ellipse cx={62} cy={74} rx={5.6} ry={6.6} fill={C.accentStrong} />
  if (mood === "think") {
    return <path d="M57 74 q5 2.5 10 0" stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />
  }
  return (
    <path d="M52 71 q10 10 20 0" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round" fill="none" />
  )
}

function SmallStar({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: string[] = []
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.46
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`)
  }
  return <polygon points={pts.join(" ")} />
}

export function Lupe({
  size = "md",
  mood = "happy",
  decorative = false,
}: {
  size?: LupeSize
  mood?: LupeMood
  /** 近くの文字で説明しているときは、読み上げから外す */
  decorative?: boolean
}) {
  const reduce = useReducedMotion()
  const px = LUPE_PX[size]

  return (
    <motion.svg
      width={px}
      height={px}
      viewBox="0 0 124 124"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : MOOD_LABEL[mood]}
      aria-hidden={decorative ? true : undefined}
      data-testid="lupe"
      animate={reduce ? undefined : { y: [0, -4, 0], rotate: [0, -1.4, 0] }}
      transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "50% 60%" }}
    >
      {/* 接地影 */}
      <ellipse cx={60} cy={116} rx={26} ry={4.5} fill="rgba(67,57,43,.14)" />

      {/* もち手(木) */}
      <g transform="rotate(43 88 88)">
        <rect x={83} y={80} width={13} height={34} rx={6.5} fill="#C98A4B" stroke={C.ink} strokeWidth={3} />
        <rect x={86.4} y={84} width={2.6} height={24} rx={1.3} fill="#A96D33" opacity={0.7} />
      </g>

      {/* レンズ外輪(みどり) */}
      <circle cx={62} cy={62} r={34} fill={C.primary} stroke={C.ink} strokeWidth={3.4} />
      {/* レンズ面(クリーム) */}
      <circle cx={62} cy={62} r={26.5} fill="#FFF9EC" stroke={C.ink} strokeWidth={2} />
      {/* レンズのつや */}
      <path d="M44 50 q6 -10 18 -12" stroke="#fff" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.75} />

      {/* ほっぺ */}
      <circle cx={47} cy={68} r={4.6} fill={C.berry} opacity={0.4} />
      <circle cx={77} cy={68} r={4.6} fill={C.berry} opacity={0.4} />

      <LupeEyes mood={mood} />
      <LupeMouth mood={mood} />

      {/* 安全帽(黄) — レンズの上にちょこん */}
      <g>
        <path
          d="M40 36 Q42 18 62 18 Q82 18 84 36 L84 39 Q62 32 40 39 Z"
          fill={C.sun}
          stroke={C.ink}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* つば */}
        <path
          d="M36 38.5 Q62 30 88 38.5 Q90 43 86 43.5 Q62 37 38 43.5 Q34 43 36 38.5 Z"
          fill={C.sunDeep}
          stroke={C.ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* 帽章(みどりの盾) */}
        <path
          d="M58 24 h8 q1.6 0 1.6 1.6 v4 q0 4 -5.6 6.4 q-5.6 -2.4 -5.6 -6.4 v-4 q0 -1.6 1.6 -1.6 Z"
          fill={C.primaryStrong}
          stroke={C.ink}
          strokeWidth={2}
        />
      </g>

      {/* キラキラ */}
      <g fill={C.sun} stroke={C.ink} strokeWidth={1.2}>
        <SmallStar cx={22} cy={46} r={mood === "wow" || mood === "cheer" ? 5.4 : 4} />
        <SmallStar cx={103} cy={40} r={mood === "wow" ? 5.6 : 4} />
        {(mood === "wow" || mood === "cheer") && <SmallStar cx={104} cy={78} r={4.4} />}
      </g>

      {/* think の「?」 */}
      {mood === "think" && (
        <text x={98} y={30} fontSize={22} fontWeight={900} fill={C.accentStrong} aria-hidden="true">
          ?
        </text>
      )}
    </motion.svg>
  )
}
