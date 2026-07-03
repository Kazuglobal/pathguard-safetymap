/**
 * PathGuardian デザインファウンデーション「たんけんノート」
 *
 * もとは きけんハンター専用のデザイン言語だったものを、アプリ全体の
 * アイデンティティとして昇格したもの。世界観:
 *  - 紙のフィールドノート × スタンプラリー。クリーム紙の面に、
 *    森のみどり(primary)・安全オレンジ(accent)・帽子の黄(sun)。
 *  - マスコットは虫めがねの相棒「ルペ」。「見つける」がこのアプリの動詞。
 *  - ボタンは押し込める「チャンキー」物理感。グラデ乱用はしない。
 *  - モーションは短く・方向性があり・reduced-motion を必ず尊重。
 *
 * ここには React に依存しない純粋なトークンだけを置く。
 * コンポーネント(Mascot / PaperPanel など)は
 * components/safety-quest/hunter/theme.tsx を参照。
 */

import type { Transition } from "framer-motion"

export const tankenTokens = {
  color: {
    /** 紙面 */
    paper: "#FBF5E9",
    paperDeep: "#F3EAD6",
    card: "#FFFDF7",
    /** インク(文字) */
    ink: "#43392B",
    inkSoft: "#847661",
    inkFaint: "#B7AB93",
    /** 森のみどり(主行動・発見) */
    primary: "#159E72",
    primaryStrong: "#0C7A55",
    primarySoft: "#DFF3E9",
    /** 安全オレンジ(注意・励まし) */
    accent: "#F4801F",
    accentStrong: "#D8660A",
    accentSoft: "#FDEBD7",
    /** 帽子の黄(スタート・ごほうび) */
    sun: "#FFC93E",
    sunDeep: "#E2A812",
    sunSoft: "#FFF3CE",
    /** 写真フレーム・夜インク */
    night: "#26413B",
    /** ベリー(コンボ・ほっぺ) */
    berry: "#F2699C",
    danger: "#D95555",
    dangerSoft: "#FBE9E9",
    /** 情報(そら) */
    sky: "#3E8FB8",
    skySoft: "#E3F1F8",
    /** success は primary の別名(発見・完了) */
    success: "#159E72",
  },
  font: {
    family:
      'var(--font-app, "Zen Maru Gothic"), "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif',
  },
  radius: { card: 22, panel: 18, chip: 12, button: 9999, photo: 18 },
  shadow: {
    /** カードの浮き(紙の上の紙) */
    card: "0 1.5px 0 rgba(67,57,43,.07), 0 14px 30px -18px rgba(67,57,43,.38)",
    soft: "0 1px 0 rgba(67,57,43,.06), 0 6px 16px -10px rgba(67,57,43,.28)",
    /** 地図の上に浮くチップ・ドック */
    float: "0 1px 0 rgba(67,57,43,.05), 0 10px 26px -14px rgba(67,57,43,.45)",
    /** チャンキーボタンの土台 */
    pressSun: "0 4px 0 #E2A812",
    pressGreen: "0 4px 0 #0C7A55",
    pressAccent: "0 4px 0 #D8660A",
    pressPaper: "0 3px 0 rgba(67,57,43,.16)",
  },
  border: {
    faint: "rgba(67,57,43,.09)",
    soft: "rgba(67,57,43,.14)",
  },
  cls: {
    // ring 色は slash 記法(/40)だと生成されないことがあるため rgba 直書きで確実に
    focus:
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(21,158,114,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF5E9]",
  },
  spring: { type: "spring", stiffness: 420, damping: 32 } as Transition,
  springSoft: { type: "spring", stiffness: 300, damping: 30 } as Transition,
} as const

/** ざらっとした紙の粒子(ごく薄く重ねる)。 */
export const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E\")"

/** 探検ノートの見返し柄: 点線ルート・ピン・星をまばらに。 */
export const ENDPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='340' height='340' viewBox='0 0 340 340'%3E%3Cg fill='none' stroke='%2343392B' stroke-opacity='.055' stroke-width='3' stroke-linecap='round'%3E%3Cpath stroke-dasharray='1 14' d='M20 60 Q120 20 170 90 T320 120'/%3E%3Cpath stroke-dasharray='1 14' d='M40 300 Q140 240 220 280 T330 230'/%3E%3C/g%3E%3Cg fill='%2343392B' fill-opacity='.06'%3E%3Cpath d='M84 148c0-9 7-16 16-16s16 7 16 16c0 12-16 26-16 26s-16-14-16-26zm16 5a5 5 0 100-10 5 5 0 000 10z'/%3E%3Ccircle cx='262' cy='58' r='9' fill='none' stroke='%2343392B' stroke-opacity='.07' stroke-width='4'/%3E%3Cpath d='M268 65l10 10' stroke='%2343392B' stroke-opacity='.07' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M50 215l3.5 7 7.7 1-5.6 5.4 1.4 7.6-7-3.6-7 3.6 1.4-7.6-5.6-5.4 7.7-1z'/%3E%3Cpath d='M300 320l2.6 5.2 5.8.8-4.2 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.2-4 5.8-.8z'/%3E%3C/g%3E%3C/svg%3E\")"

/** 画面遷移(方向つき)。forward: 右から / back: 左から。 */
export const SCREEN_EASE: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
