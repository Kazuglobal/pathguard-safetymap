import { NextRequest, NextResponse } from "next/server"
import { generateDisasterPrompts } from "@/lib/gemini-prompts"

export const runtime = "nodejs"

const decodeUnicode = (raw: string): string =>
  raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))

const FALLBACK_VIZ_RAW =
  "Photorealistic 2K infographic from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo. Overlay semi-transparent hazard shading with warning icons: collapsed fence (red shade + exclamation icons, label \"\\u30d5\\u30a7\\u30f3\\u30b9\\u5012\\u58ca\"), fallen utility pole (red circle + arrow, label \"\\u96fb\\u67f1\\u5012\\u58ca\"), flooding (blue shade + droplet icon, label \"\\u51a0\\u6c34\"), fire spread (orange flame icon, label \"\\u5ef6\\u713c\"). Preserve the original composition and camera height. No people, no vehicles, no extra text, no watermarks, and do not mention any model names."

const FALLBACK_TABLE_RAW = [
  "| \\u30cf\\u30b6\\u30fc\\u30c9 | \\u60f3\\u5b9a\\u30ea\\u30b9\\u30af (\\u4f8b) | \\u305d\\u306e\\u5834\\u3067\\u3067\\u304d\\u308b\\u5bfe\\u7b56 (\\u4f8b) |",
  "|---|---|---|",
  "| \\u5730\\u9707 | \\u30d5\\u30a7\\u30f3\\u30b9\\u30fb\\u96fb\\u67f1\\u5012\\u58ca / \\u843d\\u4e0b\\u7269 / \\u5730\\u5272\\u308c | \\u5371\\u967a\\u7bc4\\u56f2\\u3092\\u30b3\\u30fc\\u30f3\\u3067\\u5c01\\u9396 / \\u8ff4\\u56de\\u8a98\\u5c0e / \\u65e9\\u6025\\u306b\\u64a4\\u53bb\\u3092\\u4f9d\\u983c |",
  "| \\u53f0\\u98a8(\\u5f37\\u98a8) | \\u98db\\u6563\\u7269 / \\u30d5\\u30a7\\u30f3\\u30b9\\u5909\\u5f62 / \\u6a39\\u6728\\u306e\\u6298\\u640d | \\u7de9\\u3093\\u3060\\u7269\\u3092\\u56fa\\u5b9a / \\u5b89\\u5168\\u5074\\u3078\\u8ff4\\u56de\\u6848\\u5185 / \\u6298\\u308c\\u679d\\u3092\\u675f\\u306d\\u3066\\u79fb\\u52d5 |",
  "| \\u8c6a\\u96e8(\\u6d2a\\u6c34) | \\u9053\\u8def\\u51a0\\u6c34 / \\u6392\\u6c34\\u8a70\\u307e\\u308a / \\u6ed1\\u308a\\u3084\\u3059\\u3044\\u8def\\u9762 | \\u51a0\\u6c34\\u30a8\\u30ea\\u30a2\\u3078\\u306e\\u9032\\u5165\\u7981\\u6b62\\u30b5\\u30a4\\u30f3 / \\u5074\\u6e9d\\u306e\\u30b4\\u30df\\u9664\\u53bb / \\u8db3\\u5143\\u6ce8\\u610f\\u559a\\u8d77 |",
  "| \\u706b\\u707d | \\u5ef6\\u713c / \\u7159\\u306b\\u3088\\u308b\\u8996\\u754c\\u4e0d\\u826f / \\u706b\\u306e\\u7c89\\u843d\\u4e0b | \\u53ef\\u71c3\\u7269\\u3092\\u9060\\u3056\\u3051\\u308b / \\u98a8\\u4e0a\\u3078\\u8a98\\u5c0e / \\u5c0f\\u706b\\u306f\\u6d88\\u706b\\u5668\\u3067\\u521d\\u671f\\u6d88\\u706b |",
].join("\\n")

const decodeTable = () => decodeUnicode(FALLBACK_TABLE_RAW)

function fallbackPrompts() {
  const viz = decodeUnicode(FALLBACK_VIZ_RAW)

  const simulationPrompts = {
    earthquake:
      "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo showing a major earthquake aftermath with a collapsed fence, a fallen utility pole with loose wires, scattered debris, and fine dust. Preserve the original composition and camera height. No people, no vehicles, no extra text, no watermarks, and do not mention any model names.",
    typhoon:
      "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo right after typhoon-class strong wind, featuring a bent fence, scattered branches and leaves, wet pavement with shallow puddles, and a few displaced objects. Preserve the original composition and camera height. No people, no vehicles, no extra text, no watermarks, and do not mention any model names.",
    flood:
      "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo during a flash flood with around 20 cm of water covering the street and sidewalk, realistic reflections and ripples, and floating rubbish such as leaves and plastic. Preserve the original composition and camera height. No people, no vehicles, no extra text, no watermarks, and do not mention any model names.",
    fire:
      "Photorealistic 2K render from the exact same viewpoint and daylight as the uploaded Japanese suburban street photo after a nearby fire, showing a burnt car beyond the fence, warped wire mesh, lingering smoke or haze, and soot on surrounding surfaces. Preserve the original composition and camera height. No people, no vehicles, no extra text, no watermarks, and do not mention any model names.",
  }

  return {
    riskObservation: { elements: [], tableMarkdown: decodeTable() },
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
      return NextResponse.json({
        success: false,
        prompts: fallbackPrompts(),
        warning: inner instanceof Error ? inner.message : String(inner),
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: msg })
  }
}
