/**
 * 標準シナリオ画像生成のフォールバックプロンプト。
 * generate-prompts API が失敗したときと、クライアント側でプロンプト未取得のときに使う。
 * サーバ専用の依存を持たないこと（クライアントコンポーネントからも import される）。
 */

export const FALLBACK_VIZ_PROMPT = `Create one photorealistic hazard-communication infographic based on the uploaded Japanese school-route photo, keeping the photo's original aspect ratio and full field of view. Preserve the original scene geometry exactly: same camera position, lens, horizon, perspective, building outlines, road markings, and daylight color temperature. Do not alter existing objects and do not add new buildings, people, or vehicles. Render any visible faces or license plates unrecognizable. Add overlays only. Mark up to four potential hazards, but ONLY those whose anchor object is actually visible in this photo: (1) fence or block-wall instability: semi-transparent red polygon + warning triangles + Japanese label "フェンス倒壊注意"; (2) utility pole failure risk: red circle/arrow + Japanese label "電柱倒壊注意"; (3) flooding-prone low spot or drainage: semi-transparent blue wash + droplet icons + Japanese label "冠水注意"; (4) fire spread exposure from adjacent wooden buildings: semi-transparent amber haze + flame icons + Japanese label "延焼注意". If fewer than four apply, mark fewer — never invent an object to justify a label. Add numbered markers with short leader lines and include a compact Japanese legend at bottom-left listing only the colors actually used: "凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意". Style: realistic, HDR, sharp focus, balanced contrast, mobile-readable annotations with accurately rendered Japanese text. No graphic destruction, no gore, no extra text beyond the specified Japanese labels and legend, no watermark, and no model names.`

export const FALLBACK_SIMULATION_PROMPTS = {
  earthquake:
    "Photorealistic high-resolution render keeping the uploaded photo's aspect ratio, from the same viewpoint and daylight as the uploaded Japanese suburban street photo, showing a moderate earthquake aftermath (equivalent to Japan seismic intensity 5-upper): block walls and fences may show hairline cracks and minor mortar dust at joints; a utility pole may lean very slightly; small loose items (flower pots, signs) are displaced on the ground; minor pavement cracks visible. The overall scene is shaken but NOT devastated — structures remain mostly standing. No recognizable faces or license plates. High dynamic range, sharp focus, no people, no added vehicles, no watermarks, no model names. Do NOT show explosion-like destruction, large dust clouds, or completely collapsed structures.",
  typhoon:
    "Photorealistic high-resolution render keeping the uploaded photo's aspect ratio, from the same viewpoint and daylight as the uploaded Japanese suburban street photo right after strong wind (approximately 30m/s): scattered tree branches and leaves on wet pavement; lightweight objects (garbage bins, small signs) displaced; fences may rattle or bend slightly but remain standing; wet reflective road surface with puddles. Solid structures are intact. No recognizable faces or license plates. High dynamic range, sharp focus, no people, no added vehicles, no watermarks, no model names. Do NOT show uprooted trees, destroyed buildings, or catastrophic damage.",
  flood:
    "Photorealistic high-resolution render keeping the uploaded photo's aspect ratio, from the same viewpoint and daylight as the uploaded Japanese suburban street photo during urban flooding: approximately 15-20 cm of muddy brownish water covering the road and lower portions of sidewalk, realistic water reflections and small ripples, floating leaves and minor debris, visible water line on curbs and wall bases. The water looks like actual floodwater (slightly murky, not crystal clear). No recognizable faces or license plates. High dynamic range, sharp focus, no people, no added vehicles, no watermarks, no model names.",
  fire:
    "Photorealistic high-resolution render keeping the uploaded photo's aspect ratio, from the same viewpoint and daylight as the uploaded Japanese suburban street photo with signs of a nearby fire (fire source is NOT visible in frame): thin smoke haze reducing visibility slightly in the background, very light soot deposits on surfaces nearest to the assumed fire direction, a faint warm-orange tint in the hazy sky. No active flames, no burning vehicles, no charred ruins visible. The scene suggests a fire occurred nearby but the immediate area is not burning. No recognizable faces or license plates. High dynamic range, sharp focus, no people, no added vehicles, no watermarks, no model names.",
} as const

export const FALLBACK_TABLE_MARKDOWN = [
  "| ハザード | 想定リスク (例) | その場でできる対策 (例) |",
  "|---|---|---|",
  "| 地震 | 塀のひび割れ・傾き / 落下物の可能性 / 路面の小さなひび | 塀から離れる / 迂回誘導 / 点検を依頼 |",
  "| 台風(強風) | 飛散物（植木鉢・看板）/ フェンス変形 / 枝の折損 | 緩んだ物を固定 / 安全側へ迂回案内 / 折れ枝を束ねて移動 |",
  "| 豪雨(冠水) | 道路冠水（15〜20cm）/ 排水詰まり / 滑りやすい路面 | 冠水エリアへの進入禁止 / 側溝のゴミ除去 / 足元注意喚起 |",
  "| 火災 | 煙による視界低下 / 近隣延焼リスク / 煤の付着 | 可燃物を遠ざける / 風上へ避難 / 小火は消火器で初期消火 |",
].join("\n")
