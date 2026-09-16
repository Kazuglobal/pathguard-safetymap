/**
 * GPT Image 2.5 向け 報告画像プロンプト
 *
 * lib/disaster-image-prompt-fallbacks.ts の Gemini 向けプロンプトを、
 * OpenAI の GPT Image 2.5 プロンプトガイドに沿って再構成したもの。
 *
 * ガイドからの主な適用点:
 *  - 複雑な要求は「labeled sections」に分ける(1段落の詰め込みをやめる)
 *  - 入力画像には明示的に役割を割り当てる("Image 1 is the base photograph")
 *  - 変更点と制約を分離する("change only X" + 保持すべき詳細の列挙)
 *  - 正確な文字列は引用符で囲み、出現回数を指定し、追加文字を禁止する
 *  - 図版・注釈系は「instructional design brief」として書く
 *
 * 既存の設計原則(緩和不可)はすべて維持している:
 *  - 元写真の編集(edit)であってシーン再合成ではない
 *  - 写っているものだけラベル / アスペクト比維持 / 顔・ナンバーの匿名化
 *  - CLOSED TEXT SET(描いてよい文字列の完全列挙)
 *  - 未確認の「子ども110番の家」標識を描き足さない
 *  - 画像プロンプトに児童への言及を書かない(安全フィルタ誘発の回避)
 *  - 惨事的表現の禁止
 *
 * 推奨パラメータ: model="gpt-image-2.5-sunburst"(viz) / "gpt-image-2.5-flare"(sim)
 *   quality: viz="high"(小さな日本語ラベルのため) / sim="medium"
 *   size: "auto"(元写真のアスペクト比を保つ) — input_fidelity は指定しない(常に high)
 */

import { UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD } from './disaster-image-prompt-fallbacks'

export type HazardMarker = {
  /** Step 1 の element 文字列を verbatim で。例: "concrete block wall (right, foreground)" */
  readonly anchor: string
  /** 描画する日本語ラベル。CLOSED TEXT SET に載る文字列そのもの。 */
  readonly label: string
  /** 色の意味区分 */
  readonly kind: 'collapse' | 'flood' | 'fire'
}

const KIND_STYLE: Record<HazardMarker['kind'], { color: string; fill: string }> = {
  collapse: { color: 'red', fill: 'semi-transparent red polygon at about 40% fill opacity with a solid red outline' },
  flood: { color: 'blue', fill: 'semi-transparent blue wash at about 40% fill opacity with a solid blue outline' },
  fire: { color: 'amber', fill: 'semi-transparent amber tint at about 40% fill opacity with a solid amber outline' },
}

const LEGEND_BY_KIND: Record<HazardMarker['kind'], string> = {
  collapse: '赤=倒壊・落下注意',
  flood: '青=冠水注意',
  fire: '橙=火災注意',
}

/**
 * 共通の保持制約ブロック。
 * ガイドの "Separate changes from constraints" に従い、
 * 変更指示とは別のセクションとして必ず末尾に置く。
 */
export function buildPreservationBlock(options: { allowedText: string[] }): string {
  const textRule =
    options.allowedText.length === 0
      ? 'This image must contain NO text of any kind: no lettering, numerals, captions, watermarks, or model names in any script. Real-world signage already present in Image 1 stays exactly as photographed and must not be redrawn or made more legible.'
      : `CLOSED TEXT SET — the output may contain ONLY these strings, each rendered glyph-for-glyph in a clean bold Japanese gothic (sans-serif) typeface, each appearing exactly once:\n${options.allowedText.map((t) => `  - "${t}"`).join('\n')}\nNo other character of any script may appear anywhere in the image: no alphabet, no captions, no watermarks, no model names, and no deformed kanji-like glyphs. Real-world signage already present in Image 1 stays exactly as photographed.`

  return [
    'MUST NOT CHANGE (verify each before returning):',
    '- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.',
    '- Every pixel region you were not explicitly instructed to change above.',
    '- The position, geometry, colour, and material of every structure in the photograph.',
    '- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.',
    '',
    'ANONYMISATION (apply before anything else):',
    '- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.',
    '- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.',
    '',
    'TEXT RULE:',
    textRule,
    '',
    'DO NOT ADD:',
    `- ${UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD}`,
    '- No people, no added vehicles, no new street furniture, no new signage.',
    '- No gore, no injured persons, no scattered personal belongings.',
    '- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.',
  ].join('\n')
}

/**
 * ハザード可視化オーバーレイ(viz)プロンプト。
 *
 * これは「図版生成」であって写真加工ではない。ガイドの
 * "Create scientific and educational visuals" / "Render exact text" の
 * 書き方(成果物・階層・必須ラベル・除外事項を明示)を適用している。
 *
 * @param markers 写真内に実在が確認できたハザードのみ。空配列なら呼び出さないこと。
 */
export function buildVizPrompt(markers: readonly HazardMarker[]): string {
  if (markers.length === 0) {
    throw new Error('buildVizPrompt: markers が空です。根拠のないラベルを描かせないでください。')
  }
  if (markers.length > 4) {
    throw new Error('buildVizPrompt: markers は最大4件です。')
  }

  const usedKinds = [...new Set(markers.map((m) => m.kind))]
  const legendLine = `凡例 ${usedKinds.map((k) => LEGEND_BY_KIND[k]).join(' / ')}`
  const allowedText = [...markers.map((m) => m.label), legendLine]

  const markerLines = markers.map((m, i) => {
    const style = KIND_STYLE[m.kind]
    return `${i + 1}. Anchor: ${m.anchor}\n   Shape: ${style.fill}, hugging that object's silhouette exactly.\n   Badge: a circular badge carrying the white numeral "${i + 1}" on ${style.color}, connected to the shape by a short leader line.\n   Label: "${m.label}" on a high-contrast rounded pill placed directly beside the badge, on or immediately next to the anchor object.`
  })

  return [
    'TASK',
    'Image 1 is a photograph of a Japanese school route and is the immutable base image. Add a flat 2D hazard-annotation overlay layer on top of it. This is an image-EDITING task, not scene creation: do not redraw, repaint, move, remove, or re-synthesise anything in the underlying photograph. Every area not covered by an overlay graphic must remain identical to Image 1.',
    '',
    'DELIVERABLE',
    'The result should read like a clean digital safety infographic laid over a real photo — the kind used in a municipal road-safety handout. The overlays are flat vector graphics sitting ON the image; they must never look like physical signs, paint, or objects present inside the scene.',
    '',
    `MARKERS TO DRAW (exactly ${markers.length}, no more, no fewer)`,
    ...markerLines,
    '',
    'LEGEND',
    `Place one compact legend on a small opaque rounded panel in the bottom-left corner, reading exactly: "${legendLine}". List only the colours actually used above.`,
    '',
    'TYPOGRAPHY',
    'All Japanese text must be crisp, correctly formed, and legible at mobile screen size. Prefer slightly larger type over dense type. Each label sits on its pill with balanced padding and does not overflow or clip.',
    '',
    buildPreservationBlock({ allowedText }),
  ].join('\n')
}

export type SimulationKind = 'earthquake' | 'typhoon' | 'flood' | 'fire'

/** 構造物の劣化度に応じた損傷上限(既存の condition ledger 仕様と同義)。 */
export type StructureCondition = {
  /** Step 1 の element 文字列を verbatim で */
  readonly object: string
  readonly material: string
  readonly tier: 'new' | 'aging' | 'deteriorated'
  /** この構造物が受けてよい最大損傷 */
  readonly maxDamage: string
}

const HAZARD_PHYSICS: Record<SimulationKind, { headline: string; rules: string[]; forbidden: string }> = {
  earthquake: {
    headline:
      'Show the same place moments after a moderate earthquake (JMA seismic intensity 5-upper — strong but not catastrophic). The scene must read as "shaken but standing".',
    rules: [
      'Cracks follow structural logic: stair-step along mortar joints, or radiating from corners and openings.',
      'Pavement cracks only along seams that already exist in the photograph.',
      'Tilting objects rotate rigidly at their base. Never bend a pole or post mid-span.',
      'Fallen fragments lie directly below the point they came from.',
      'A thin dust film appears only immediately around fresh cracks.',
    ],
    forbidden:
      'No explosion-like destruction, no dramatic dust clouds, no collapsed buildings, no darkened sky, no horror mood.',
  },
  typhoon: {
    headline:
      'Show the same place right after typhoon-class wind (sustained about 30 m/s — strong but survivable).',
    rules: [
      'Choose ONE wind direction first, then make every single cue agree with it.',
      'Leaves and small broken branches accumulate on the downwind side.',
      'MASS RULE: only objects a person could lift are displaced — bins, cones, potted plants topple or shift downwind. Anchored structures at most tilt slightly.',
      'Flexible signs and mesh fences bow slightly downwind but stay standing.',
      'Pavement is rain-wet with a dull sheen. Sky overcast but still normal daylight.',
    ],
    forbidden:
      'No uprooted trees, no destroyed buildings, no debris flying in mid-air, no darkened dramatic sky, no catastrophic damage.',
  },
  flood: {
    headline:
      'Show the same place during shallow urban flooding of 15-20 cm (ankle to shin depth).',
    rules: [
      'Render ONE horizontally consistent waterline across the entire scene.',
      'Calibrate it to real anchors visible in the photograph: a standard curb is about 15 cm high, so the water just reaches the curb top. Wall bases and fence posts stand in the water.',
      'The water is silty brown and opaque enough to hide the road markings beneath it, with small ripples and matte, broken reflections of the poles and walls above.',
      'Add floating leaves and light debris, and a damp high-water stain a few centimetres above the waterline on walls and curbs.',
      'Everything above the waterline stays exactly as in Image 1.',
    ],
    forbidden:
      'No deep water, no submerged cars, no waves or torrents, no falling rain streaks, no dark stormy mood.',
  },
  fire: {
    headline:
      'Show subtle signs that a small fire is burning somewhere strictly OUTSIDE the frame. The street itself is not burning and no flame is visible anywhere.',
    rules: [
      'Choose the off-frame direction of the fire first, then keep every cue consistent with it.',
      'A translucent smoke haze is densest toward that edge of the frame and thins across the scene.',
      'Faint soot appears only on surfaces facing that direction.',
      'A slight warm tint is confined to the haze itself. Every surface keeps its normal daylight colour — no orange glow, no rim light.',
      'Distant objects are slightly softened by the haze while the foreground stays clear.',
    ],
    forbidden:
      'No flames, no burning or charred objects, no thick black smoke filling the sky, no apocalyptic mood.',
  },
}

/**
 * 災害シミュレーションプロンプト。
 *
 * ガイドの "Change furniture in a room"(surgical realism)と
 * "Turn a drawing into a realistic image"(レイアウト保持 + 素材/光の指定)の
 * 書き方を適用。condition ledger を明示的な表として渡すのが要点で、
 * 「damaged walls」のような一般語を構造的に出せなくする。
 */
export function buildSimulationPrompt(
  kind: SimulationKind,
  conditions: readonly StructureCondition[],
): string {
  const physics = HAZARD_PHYSICS[kind]
  const ledger =
    conditions.length > 0
      ? conditions
          .map(
            (c) =>
              `- ${c.object} — material: ${c.material}; condition: ${c.tier}; MAXIMUM permitted damage: ${c.maxDamage}`,
          )
          .join('\n')
      : '- (no ledger supplied) Treat every structure as "new": apply only the subtlest possible traces.'

  return [
    'TASK',
    'Image 1 is a photograph of a Japanese suburban street and is the base image. Edit it so the same place is shown under the condition described below. Keep the exact camera position, framing, lens, daylight, and the original aspect ratio. Keep every structure in its original position. Change ONLY what the sections below describe.',
    '',
    'CONDITION TO DEPICT',
    physics.headline,
    '',
    'HOW THE CHANGE MUST BEHAVE',
    ...physics.rules.map((r) => `- ${r}`),
    '',
    'DAMAGE BUDGET (binding — do not exceed any line)',
    'Apply damage strictly proportional to each structure\'s actual visible condition in Image 1. No structure may receive damage stronger than its stated maximum. If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatise to make the image more striking.',
    ledger,
    'Name the structures you change and apply exactly the damage listed. Generic outcomes such as "damaged walls" or "debris everywhere" are forbidden.',
    '',
    'READABILITY REQUIREMENT',
    'The damage must read as discrete, pointable clues — a crack HERE, water up to HERE — and not as a general atmosphere of devastation. The street must stay instantly recognisable as the same place: keep the layout, the colours, and every undamaged structure identical.',
    '',
    'RENDERING',
    'Photorealistic, sharp focus, normal daylight, calm matter-of-fact documentary tone, as if taken by the same camera as Image 1.',
    '',
    `FORBIDDEN FOR THIS CONDITION: ${physics.forbidden}`,
    '',
    buildPreservationBlock({ allowedText: [] }),
  ].join('\n')
}

/**
 * 透過PNGのピクトグラム生成プロンプト。
 *
 * 写真編集ではなく「再利用できる素材」を作る用途。ハザード種別ごとに
 * 1回だけ生成してR2等に保存すれば、以後の報告では生成コストがゼロになる。
 * ガイドの "Design a reusable logo" / "Create a transparent product cutout" を適用。
 *
 * 呼び出し時は background="transparent", output_format="png",
 * output_compression は指定しないこと(PNGでは不可)。
 */
export function buildPictogramPrompt(subject: string, accentColor: string): string {
  return [
    'TASK',
    `Create an original, non-infringing safety pictogram of ${subject}, for use as a map marker and report icon in a Japanese road-safety application.`,
    '',
    'STYLE',
    `Flat vector design, a single strong silhouette, minimal strokes, balanced negative space, no gradients. Use ${accentColor} as the single accent colour over a neutral dark grey. Favour simplicity over detail so it stays readable at 24 px as well as at full size.`,
    '',
    'COMPOSITION',
    'One centred pictogram with generous even padding on all sides. Fully transparent background with clean alpha edges.',
    '',
    'MUST NOT INCLUDE',
    '- No text, lettering, or numerals of any script.',
    '- No solid backdrop, no scenery, no drop shadow, no checkerboard pattern (a drawn checkerboard is not transparency).',
    '- No watermarks, no logos, no trademarked or recognisable third-party symbols.',
    '- No photorealistic rendering — this is a flat icon, not an illustration of a scene.',
  ].join('\n')
}
