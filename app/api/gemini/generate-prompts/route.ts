import { NextRequest, NextResponse } from "next/server"
import { generateDisasterPrompts } from "@/lib/gemini-prompts"

export const runtime = "nodejs"

function fallbackPrompts() {
  const viz = "Photorealistic 2K infographic from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo. Overlay semi-transparent hazard markings and Japanese labels: collapsed fence (red shade + exclamation icons, label 'フェンス倒壊'), fallen utility pole (red circle + arrow, label '電柱倒壊'), flooding (blue shade + droplet icon, label '冠水'), fire spread (orange flame icon, label '延焼'). Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names."
  const simulationPrompts = {
    earthquake: "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo: major earthquake aftermath. Show a fallen fence, a fallen utility pole with loose wires, scattered masonry/glass debris, small ground cracks, light dust. Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names.",
    typhoon: "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo: after typhoon-class strong wind. Show a bent or partially collapsed fence, scattered branches and leaves, wet pavement with small puddles, a few displaced signs. Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names.",
    flood: "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo: flash flood scene with approximately 20 cm of water covering the road and sidewalk, realistic reflections and ripples, small floating rubbish (leaves, plastic). Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names.",
    fire: "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo: post-fire aftermath. Show a burnt car beyond the fence, lightly warped wire or metal parts, lingering smoke or haze, subtle soot on nearby surfaces. Preserve original composition and camera height. No people, no vehicles, no text, no watermarks, do not mention any model names.",
  }
  const tableMarkdown = [
    "| ハザード | リスク | 対策 |",
    "|---|---|---|",
    "| 地震 | フェンス・電柱の倒壊、ブロック片の落下 | 倒壊方向を避けて歩く。揺れが収まるまで壁から離れる。 |",
    "| 台風(強風) | 飛来物、看板の脱落 | 風上を避け、建物の陰で待避。帽子や傘をたたむ。 |",
    "| 豪雨(冠水) | 低地の冠水、側溝への転落 | 水深不明箇所へ入らない。高所へ移動。足元を確認。 |",
    "| 火災 | 延焼、煙の吸入 | 風下を避け、低姿勢で退避。金属フェンスから距離を取る。 |",
  ].join("\n")
  return {
    riskObservation: { elements: [], tableMarkdown },
    vizPrompt: viz,
    simulationPrompts,
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || ""
    let imageBase64: string | undefined
    let language: "ja" | "en" | undefined
    let customHazards: string[] | undefined

    if (contentType.includes("application/json")) {
      const body = await req.json()
      imageBase64 = body?.imageBase64 || body?.imageDataUrl
      language = body?.language
      customHazards = Array.isArray(body?.customHazards) ? body.customHazards : undefined
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image") as File | null
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer())
        imageBase64 = buf.toString("base64")
      } else {
        imageBase64 = (form.get("imageBase64") as string) || undefined
      }
      const lang = (form.get("language") as string) || undefined
      if (lang === "ja" || lang === "en") language = lang
      const hazardsRaw = form.get("customHazards") as string | null
      if (hazardsRaw) customHazards = hazardsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    } else {
      return NextResponse.json({ error: "Use JSON or multipart/form-data" }, { status: 400 })
    }

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 })
    }

    try {
      const prompts = await generateDisasterPrompts(imageBase64, { language, customHazards })
      return NextResponse.json({ success: true, prompts })
    } catch (inner) {
      return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: inner instanceof Error ? inner.message : String(inner) })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: msg })
  }
}

