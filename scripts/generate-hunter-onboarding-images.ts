/**
 * きけんハンター オンボーディング用イラスト一括生成
 *
 * 「たんけんノート」デザインシステムの世界観(クリーム紙・森のみどり・
 * 安全オレンジ・帽子の黄・虫めがねの相棒ルペ)に合わせた
 * ストーリーブック調イラストを Gemini 画像生成で作る。
 *
 * 使い方:
 *   npx tsx scripts/generate-hunter-onboarding-images.ts [--only <id1,id2>]
 *
 * 出力: public/images/hunter/<id>.png
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image"
const OUT_DIR = path.join(process.cwd(), "public", "images", "hunter")

/** 全カットで共有する画風トークン(世界観の一貫性を担保する)。 */
const STYLE = `
Warm flat storybook illustration for a Japanese children's road-safety app.
Art direction: cream paper background (#FBF5E9) with a very subtle paper-grain texture,
palette limited to forest green (#159E72), safety orange (#F4801F), sunny yellow (#FFC93E),
soft sky blue (#7EC8E3) and warm dark-brown outlines (#43392B).
Soft rounded shapes, thick uniform outlines, gentle flat shading, cozy picture-book mood.
Recurring characters (keep consistent): a cheerful Japanese elementary-school kid (gender-neutral,
short dark hair) wearing a yellow safety cap and a small backpack; a kind parent in green;
and the mascot "Lupe" — a cute round magnifying glass whose lens is a smiling cream face,
with a tiny yellow safety cap on top and a wooden handle.
Strict rules: cartoon only, no photorealism, absolutely no text, no letters, no numbers,
no logos, no watermark. 4:3 landscape composition with generous negative space.
`.trim()

interface Cut {
  id: string
  scene: string
}

const CUTS: Cut[] = [
  {
    id: "onboarding-1",
    scene:
      "Scene: the kid and the parent step out of their house doorway together into morning light, " +
      "holding hands. The mascot Lupe floats beside them sparkling with excitement. " +
      "A winding dotted path leads toward a small town with a crosswalk and a school far away on low hills. " +
      "Mood: the adventure of everyday streets is about to begin.",
  },
  {
    id: "onboarding-2",
    scene:
      "Scene: the parent holds a smartphone horizontally, taking a picture of a quiet street corner " +
      "with a crosswalk and a curved mirror; the kid points at the corner. " +
      "Lupe the magnifying-glass mascot peeks from behind the phone. " +
      "A dashed camera view-frame floats around the street corner they photograph. " +
      "Mood: let's capture our own street to study it.",
  },
  {
    id: "onboarding-3",
    scene:
      "Scene: a large photo print of a street lies on a notebook page; the kid slides the mascot Lupe " +
      "over the photo like a magnifying glass, and inside Lupe's lens a hidden spot glows warm yellow " +
      "with a small exclamation sticker. The parent leans in, pointing gently. Small footprint stamps " +
      "dot the notebook page. Mood: finding hidden danger spots together is a game.",
  },
  {
    id: "onboarding-4",
    scene:
      "Scene: the kid and the parent high-five; Lupe the mascot jumps happily between them. " +
      "Behind them a big open field notebook shows a collected round stamp and a small star sticker " +
      "(no letters inside). Confetti pieces of paper in yellow, orange and green float in the air. " +
      "Mood: proud, warm, accomplished — the eye that notices danger has grown.",
  },
  {
    id: "records-empty",
    scene:
      "Scene: an open blank field notebook with a hand-drawn town map (roads as dotted lines, " +
      "tiny houses, a school) and one empty circular sticker slot waiting to be filled. " +
      "Lupe the magnifying-glass mascot sits at the corner of the notebook looking up expectantly. " +
      "Mood: your discovery collection starts here.",
  },
]

async function generateOne(cut: Cut): Promise<boolean> {
  const prompt = `${STYLE}\n\n${cut.scene}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["image", "text"],
        },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    console.error(`  ✗ ${cut.id}: API ${res.status} ${err?.error?.message ?? ""}`)
    return false
  }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const imagePart = parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)
  if (!imagePart?.inlineData?.data) {
    console.error(`  ✗ ${cut.id}: 画像データなし`)
    return false
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `${cut.id}.png`)
  fs.writeFileSync(file, Buffer.from(imagePart.inlineData.data, "base64"))
  const kb = Math.round(fs.statSync(file).size / 1024)
  console.log(`  ✓ ${cut.id}.png (${kb}KB)`)
  return true
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY が設定されていません (.env.local)")
    process.exit(1)
  }
  const onlyArg = process.argv.indexOf("--only")
  const only = onlyArg >= 0 ? (process.argv[onlyArg + 1] ?? "").split(",") : null
  const targets = only ? CUTS.filter((c) => only.includes(c.id)) : CUTS

  console.log(`モデル: ${GEMINI_MODEL} / ${targets.length}枚を生成します`)
  let ok = 0
  for (const cut of targets) {
    console.log(`- ${cut.id} を生成中…`)
    if (await generateOne(cut)) ok += 1
    await new Promise((r) => setTimeout(r, 2500))
  }
  console.log(`完了: ${ok}/${targets.length}`)
  if (ok < targets.length) process.exit(1)
}

void main()
