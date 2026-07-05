/**
 * SAFE MAGAZINE 記事用画像生成スクリプト
 * Gemini 3.1 Flash Lite Image (Nano Banana 2 Lite) を使用
 * 高品質な教育用イラストを生成
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// Load .env.local
dotenv.config({ path: ".env.local" })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image"

console.log("API Key loaded:", GEMINI_API_KEY ? "Yes" : "No")
console.log("API Key prefix:", GEMINI_API_KEY?.substring(0, 10) + "...")
console.log("Model:", GEMINI_MODEL)

interface ImageConfig {
  articleId: string
  articleSlug: string
  category: string
  title: string
  thumbnailPrompt: string
  contentImages: Array<{
    id: string
    prompt: string
    description: string
  }>
}

// 日本向け高品質プロンプトテンプレート
const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details
- Professional Japanese editorial illustration quality
- Clean lines and smooth gradients
- Balanced composition with visual hierarchy
- Suitable for web and print media
- No watermarks, no text overlays, no signatures
- Use stylized anime/manga inspired art style suitable for Japanese audiences
- Warm, friendly aesthetic appropriate for family and education content
`

// 記事ごとの画像設定（高品質プロンプト）
const ARTICLE_IMAGES: ImageConfig[] = [
  {
    articleId: "2026-02-06-chikushino-accident",
    articleSlug: "chikushino-accident",
    category: "accident-news",
    title: "対策済み通学路でも事故発生",
    thumbnailPrompt: `Create an illustration depicting a Japanese elementary school commute scene with safety concerns.

Scene elements (Japanese specific):
- Japanese residential neighborhood (住宅街) with traditional tile-roofed houses
- Elementary school children wearing yellow safety caps (黄色い帽子) and carrying red/black randoseru backpacks (ランドセル)
- A marked crosswalk (横断歩道) on a narrow Japanese street
- Green safety fence/guardrail (ガードレール) along the sidewalk
- A "School Zone" warning sign (スクールゾーン標識) - yellow diamond shape
- Green belt road marking (グリーンベルト) on pavement edge
- A parked car suggesting the danger of blind spots

Mood: Slightly concerning atmosphere showing potential danger despite safety measures
Style: Japanese manga/anime inspired illustration with soft shading, suitable for educational content
Color palette: Warm earth tones, yellow safety accents, soft morning light
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "hard-vs-soft",
        prompt: `Create a Japanese-style educational infographic comparing safety measures for school routes.

LEFT SIDE - ハード対策 (Physical Infrastructure):
- Guardrail/safety fence icon (ガードレール)
- Traffic signal with pedestrian light (信号機)
- Green belt pavement marking (グリーンベルト)
- Speed bump illustration
- Zone 30 speed limit sign
Background: Cool blue gradient

RIGHT SIDE - ソフト対策 (Human-based Solutions):
- Elderly volunteer with yellow flag (見守りボランティア)
- Crossing guard lady in green uniform (緑のおばさん)
- Parent walking with child carrying randoseru
- Community watch symbol (地域の目)
- Safety education illustration
Background: Warm green gradient

Style: Clean Japanese infographic design, friendly icons, educational aesthetic
Divided layout with clear comparison
${QUALITY_SUFFIX}`,
        description: "ハード対策とソフト対策の比較図"
      }
    ]
  },
  {
    articleId: "2026-02-06-school-route-safety-statistics",
    articleSlug: "school-route-safety-statistics",
    category: "danger-ranking",
    title: "小1の事故リスクは6年生の2.9倍",
    thumbnailPrompt: `Create an illustration showing Japanese first-grade elementary school student safety awareness.

Scene elements:
- A small Japanese first-grade student (小学1年生) wearing:
  - Yellow safety cap (黄色い帽子)
  - Red or black randoseru backpack (ランドセル)
  - Standing at a crosswalk looking uncertain
- Larger figure of a 6th grader (6年生) shown for size comparison
- Japanese street crossing scene with zebra crossing
- Visual indicator showing "2.9x risk" concept (small child = more vulnerable)
- Warm, protective mood with slight concern undertone

Style: Soft Japanese illustration style, anime-inspired but educational
Focus: Size difference between grades, vulnerability of young children
Color palette: Warm yellows, soft oranges for caution, protective green accents
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "grade-comparison",
        prompt: `Create a Japanese educational illustration showing elementary school students by grade with risk indicators.

Visual layout:
- 6 Japanese elementary school children standing in a row
- Each child represents grades 1-6 (1年生〜6年生)
- Size progression from small (1st grade) to tall (6th grade)
- All wearing yellow safety caps and randoseru backpacks
- Color-coded risk indicators above each child:
  - 1st grade: Large red/orange warning circle
  - Gradually decreasing to small green circle for 6th grade
- Japanese labels: 1年生, 2年生, 3年生, 4年生, 5年生, 6年生

Style: Cute Japanese educational illustration, friendly and approachable
Background: Soft gradient, school-themed
Mood: Educational, highlighting age-related vulnerability
${QUALITY_SUFFIX}`,
        description: "学年別事故リスク比較チャート"
      },
      {
        id: "progress-circle",
        prompt: `Create a Japanese-style infographic showing 91% safety progress achievement.

Main elements:
- Large circular progress indicator (donut chart style)
- 91% segment in bright green (達成 - achieved)
- 9% segment in light gray (残り - remaining)
- Center area with a shield or checkmark symbol
- Small Japanese elementary school themed icons around (randoseru, yellow cap)
- Clean, professional Japanese infographic design

Visual style:
- Bold, clear progress ring
- Soft shadows for depth
- Celebratory but professional mood
- Suitable for Japanese government/education reports

Color palette: Green for success, gray for remaining, white background
${QUALITY_SUFFIX}`,
        description: "通学路安全対策91%完了の進捗表示"
      }
    ]
  },
  {
    articleId: "2026-02-06-nagara-mimamori-guide",
    articleSlug: "nagara-mimamori-guide",
    category: "volunteer-activity",
    title: "ながら見守りのすすめ",
    thumbnailPrompt: `Create a warm Japanese community scene showing "ながら見守り" (while-doing watching) activities.

Scene elements:
- Japanese residential neighborhood (日本の住宅街) with traditional houses
- Morning golden hour lighting
- Elementary school children walking to school with yellow caps and randoseru

Community members doing daily activities while watching children:
- Elderly Japanese woman (おばあちゃん) watering garden plants
- Man walking a Shiba Inu dog
- Person sweeping the front of their house
- Neighbor greeting children with a wave

Japanese specific elements:
- Narrow residential street typical of Japan
- Small gardens with potted plants
- Yellow school zone signs
- Warm, safe community atmosphere

Style: Warm Japanese slice-of-life illustration, soft watercolor-like aesthetic
Color palette: Warm earth tones, soft greens, morning sunlight gold
Mood: Community warmth, gentle protection, everyday kindness
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "nagara-examples",
        prompt: `Create a Japanese illustration showing 4 examples of "ながら見守り" activities in a 2x2 grid.

Grid layout with 4 scenes:

TOP LEFT - 犬の散歩 (Dog Walking):
- Japanese person walking a Shiba Inu
- Morning neighborhood scene
- Soft green background

TOP RIGHT - 買い物帰り (Shopping):
- Person with エコバッグ shopping bags
- Passing by school children
- Warm orange background

BOTTOM LEFT - 庭の水やり (Gardening):
- Elderly person watering plants in garden
- Watching children walk by
- Pink/coral background

BOTTOM RIGHT - ジョギング (Jogging):
- Person jogging in the neighborhood
- Wearing reflective gear
- Light blue background

Each scene shows interaction with school children (yellow caps, randoseru)
Style: Cute Japanese illustration, warm and friendly
Consistent design language across all 4 panels
${QUALITY_SUFFIX}`,
        description: "ながら見守りの4つの例"
      },
      {
        id: "hachimitsu-jiman",
        prompt: `Create a Japanese children's safety education illustration for "はちみつじまん" mnemonic.

Visual layout - 7 icons with Japanese hiragana characters:

は - 話しかけてくる (Approaches to talk):
- Suspicious adult figure with speech bubble
- Child looking uncertain

ち - 近づいてくる (Comes too close):
- Figure stepping into personal space
- Warning indicator

み - 見つめてくる (Stares at you):
- Eyes watching symbol
- Uncomfortable feeling

つ - ついてくる (Follows you):
- Footsteps following
- Shadow behind child

じ - 車に乗せようとする (Tries to get in car):
- Car with open door
- Warning symbol

ま - 待っている (Waiting/lurking):
- Figure hiding behind object
- Suspicious behavior

ん - 逃げる！(Run away):
- Child running to safety
- Safe destination (こども110番の家)

Style: Bright, child-friendly Japanese educational illustration
Clear icons with Japanese text labels
Suitable for elementary school safety education
Color palette: Bright colors, red for danger, green for safety
${QUALITY_SUFFIX}`,
        description: "防犯合言葉「はちみつじまん」"
      }
    ]
  },
  {
    articleId: "2026-03-15-bicycle-blue-ticket",
    articleSlug: "bicycle-blue-ticket",
    category: "policy-update",
    title: "自転車青切符制度",
    thumbnailPrompt: `Create a Japanese educational illustration about bicycle traffic rules for middle and high school students.

Scene elements:
- Japanese middle/high school student (16+ years old) riding a bicycle on a school commute route
- Wearing school uniform (gakuran or blazer), school bag on back
- A police officer issuing a traffic violation ticket (青切符) - blue colored slip
- Japanese street scene with bicycle lane markings
- Warning signs visible: no smartphone while riding, stop signs, signal lights
- Other students watching and learning from the scene

Key visual elements:
- A blue ticket/slip (青切符) prominently displayed
- Bicycle with proper safety equipment (light, reflector)
- Japanese road markings and signs
- School route environment

Style: Clear Japanese editorial illustration, slightly serious but educational tone
Color palette: Blue accents (for 青切符), school uniform colors, Japanese street elements
Mood: Informational, slightly cautionary
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-03-15-30kmh-speed-limit",
    articleSlug: "30kmh-speed-limit",
    category: "policy-update",
    title: "生活道路30km/h制限",
    thumbnailPrompt: `Create a Japanese illustration showing a residential street with a new 30km/h speed limit sign.

Scene elements:
- Narrow Japanese residential street (生活道路) in a suburban neighborhood
- A prominent new speed limit sign showing "30" in a red circle
- Japanese elementary school children (yellow caps, randoseru) walking safely on the sidewalk
- Cars driving slowly past, respecting the new speed limit
- Traditional Japanese houses lining both sides of the street
- Green belt markings (グリーンベルト) on the road edge
- Before/after implication: safe walking environment

Visual contrast element:
- Show the "30" speed limit sign as the focal point
- Children feeling safe on the pavement
- Peaceful residential atmosphere

Style: Warm Japanese neighborhood illustration, slice-of-life aesthetic
Color palette: Warm residential tones, red speed limit sign, yellow safety accents
Mood: Safe, protective, community-oriented
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-03-15-ai-camera-kakogawa",
    articleSlug: "ai-camera-kakogawa",
    category: "safety-tips",
    title: "加古川市高度化見守りカメラ",
    thumbnailPrompt: `Create a Japanese illustration showing Kakogawa city's school-route safety camera program.

Scene elements:
- A neighborhood map or streetscape suggesting roughly 1,500 watch-over camera locations across the city
- One highlighted advanced safety camera mounted on a pole in a Japanese neighborhood
- The advanced camera has a glowing blue/cyan indicator light suggesting smart detection features
- Japanese elementary school children (yellow safety caps, randoseru) walking safely below
- Semi-transparent digital overlay showing AI detection:
  - Sound wave indicator (for audio detection)
  - Car proximity alert visual
- Japanese residential street in Kakogawa city style
- Community safety atmosphere

Technology visualization:
- Futuristic but approachable advanced camera design
- Small label suggesting "150台の高度化見守りカメラ"
- Warning speaker/rotating light system on the pole

Style: Japanese technology + safety illustration, clean tech aesthetic meets warm community feel
Color palette: Tech blue/cyan for AI elements, warm tones for neighborhood, yellow for children
Mood: Protected, technologically advanced, community safety
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-03-15-suspicious-person-statistics",
    articleSlug: "suspicious-person-statistics",
    category: "safety-tips",
    title: "声かけ事案の時間帯統計と対策",
    thumbnailPrompt: `Create a Japanese safety awareness illustration about suspicious-approach prevention during school commute hours.

Scene elements:
- Japanese elementary school children walking home in the afternoon around 3pm (warm light)
- Children walking in a group (group safety concept)
- A "子ども110番の家" (Child 110 emergency house) visible with its yellow triangle sign
- Statistical visualization overlay:
  - Clock showing 3PM with warning indicator
  - Shield symbol showing protection
- Defense action: children running toward safety/adult
- Bright prevention buzzer (防犯ブザー) on a randoseru strap

Key safety message visual elements:
- Group walking = safer
- 子ども110番の家 as a refuge
- Afternoon warning time (15時台)

Style: Clear Japanese safety education illustration, serious but not frightening
Color palette: Afternoon warm orange light, warning yellows, safe greens
Mood: Alert but empowering, children as active participants in their own safety
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-05-01-spring-traffic-safety-2026",
    articleSlug: "spring-traffic-safety-2026",
    category: "policy-update",
    title: "令和8年春の全国交通安全運動",
    thumbnailPrompt: `Create a Japanese illustration depicting the spring nationwide traffic safety campaign focused on protecting school-route pedestrians.

Scene elements:
- Spring morning Japanese residential street with cherry blossoms (桜) in soft bloom
- Group of Japanese elementary school children with yellow safety caps (黄色い帽子) and randoseru backpacks (ランドセル) walking in line
- A police officer (warm, friendly appearance) holding a traffic safety flag at a crosswalk
- A "横断中" (crossing in progress) flag/sign held by a school crossing guard
- Yellow campaign banner reading "春の全国交通安全運動" visible on a street pole
- Cars stopped politely at the crosswalk, drivers visibly attentive
- Sun rays through cherry blossom petals, gentle morning light
- Street zone signage suggesting school zone (スクールゾーン)

Key visual elements:
- Cherry blossoms = spring season
- Yellow safety hat = elementary student commute
- Police officer + guard = enforcement and community presence
- Stopped car = pedestrian-priority message

Style: Warm Japanese editorial illustration, hopeful and protective tone
Color palette: Soft pink (cherry blossoms), yellow safety accents, traffic safety green
Mood: Community-supported, safe new school year, springtime hope
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-05-01-zone30plus-model-areas",
    articleSlug: "zone30plus-model-areas",
    category: "policy-update",
    title: "ゾーン30プラス モデル地域65箇所",
    thumbnailPrompt: `Create a Japanese illustration showing the "Zone 30 Plus" school-route safety infrastructure on residential streets.

Scene elements:
- Japanese residential neighborhood centered around a small elementary school
- A clear "30" speed limit road sign (red circle) prominently displayed
- A speed hump (ハンプ) visible on the road surface as a slight rise
- Road narrowing structure (狭さく / chicane) with planters
- Colored pavement marking (カラー舗装) in green/red along pedestrian edges
- Large painted "30" number on the road surface
- Group of Japanese elementary school children (yellow caps, randoseru) walking safely on the colored sidewalk
- Slow-moving cars respecting the speed limit
- Faint overlay map or area boundary suggesting "面的対策エリア" (area-wide safety zone)
- Modern, well-maintained Japanese street design

Key visual elements:
- "30" speed sign and road marking = legal speed regulation
- Hump + chicane + colored pavement = physical speed enforcement
- Children walking safely = the goal of the program
- Area boundary overlay = "面" (area-wide) concept

Style: Modern Japanese infographic-style illustration with clear architectural detail
Color palette: Cool blue-green for safety infrastructure, warm yellow for children, red speed sign accent
Mood: Engineered safety, community-focused, forward-looking
${QUALITY_SUFFIX}`,
    contentImages: []
  },
  {
    articleId: "2026-05-03-first-grader-may-peak",
    articleSlug: "first-grader-may-peak",
    category: "safety-tips",
    title: "「魔の7歳」5月の事故ピーク——親子で点検したい通学路",
    thumbnailPrompt: `Create a warm, emotionally engaging Japanese illustration showing a parent and a first-grade child walking through their school route together for a safety check after Golden Week.

Scene elements (Japanese specific):
- A Japanese mother (or father) walking hand-in-hand with a small first-grade boy or girl
- The child wears the bright yellow safety cap (黄色い帽子) and a red randoseru backpack — a freshly-enrolled first-grader (新1年生)
- The parent points gently toward a marked crosswalk (横断歩道) with a school zone sign (スクールゾーン) in soft focus
- Late-spring residential neighborhood (5月 / May): fresh green leaves on cherry trees (the petals already fallen), bright clear sky, soft warm sunlight
- A "止まれ" (stop) sign visible on a side street
- A "子ども110番の家" (child safety help-house) yellow triangular sign visible on a nearby home
- A green belt road marking (グリーンベルト) along the pedestrian edge
- A friendly community atmosphere — perhaps a neighbor watering plants in the background
- The composition emphasizes the parent-child connection and the act of "checking together"

Key visual themes:
- Parent + child = "親子で点検" (checking together)
- Yellow cap + small randoseru = vulnerable first-grader, "魔の7歳"
- Bright fresh-green spring scene = May timing, post Golden Week
- Crosswalk + stop sign + safety markers = the 5 danger points being checked
- "Child 110-ban" sign = emergency safe haven awareness

Mood: Warm, caring, hopeful — a tender but purposeful moment between parent and child
Style: Soft Japanese editorial illustration with anime/manga inspired warmth, gentle shading, child-friendly aesthetic
Color palette: Bright spring greens, soft yellow safety accents, warm sunlight, soft pastel blues for sky
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "may-peak-chart",
        prompt: `Create a clean, friendly Japanese-style infographic showing the seasonal peak of first-grade traffic accidents.

Layout:
- A horizontal bar chart titled "新1年生の歩行中事故 月別死者・重傷者数" (Monthly deaths/serious injuries of first-graders walking)
- Bars for: 4月 (April) showing 49人, 5月 (May) showing 63人 (highlighted in red as the peak)
- Annotation: "5月中旬〜下旬が第1のピーク" (Mid-to-late May is the first peak) with an arrow
- Subtitle: "出典: 警察庁分析資料" (Source: National Police Agency analysis)
- A small icon of a yellow-cap elementary first-grader walking with a randoseru in the corner
- A small caution triangle symbol next to the May bar

Visual emphasis:
- Use red/orange for the May (peak) bar to signal danger
- Use blue/teal for the April bar (lower)
- Clean grid background, white space, modern infographic style
- Japanese typography that is clearly readable

Style: Clean Japanese editorial infographic, educational and parent-friendly
Color palette: Red/orange peak accent, blue/teal baseline, soft cream background
Mood: Informative, slightly cautionary, easy to understand at a glance
${QUALITY_SUFFIX}`,
        description: "新1年生の月別事故ピーク（4月→5月）の比較グラフ"
      },
      {
        id: "five-checkpoints",
        prompt: `Create a Japanese-style educational infographic showing 5 dangerous points to check along a school route. NO title text in the image — captions are the only Japanese text.

Layout: A clean 2x3 grid of 6 tiles total. The TOP-LEFT tile is decorative only (no text), showing a parent and child silhouette walking together with a small magnifying glass icon. The other 5 tiles each show one numbered danger point.

Tile 1 (top-middle): Number "1" in a circle. Illustration of a Japanese residential corner blocked by a high wall and a parked white car. A small child in a yellow safety cap stands at the corner, hand raised, unable to see oncoming traffic. Caption below the illustration: "見通しの悪い交差点"

Tile 2 (top-right): Number "2" in a circle. Illustration of a quiet Japanese residential street WITHOUT a crosswalk. A child stands cautiously at the curb. Caption below: "横断歩道のない道路"

Tile 3 (bottom-left): Number "3" in a circle. Illustration of a child running excitedly out of a park gate or in front of a friend's house. Caption below: "飛び出し危険ゾーン"

Tile 4 (bottom-middle): Number "4" in a circle. Illustration of a narrow Japanese alleyway without sidewalks, with a large red X mark over it. Caption below: "抜け道・通学路外ルート"

Tile 5 (bottom-right): Number "5" in a circle. Illustration of a Japanese home with a clear bright-yellow triangular "子ども110番の家" plate mounted on the gate. Caption below: "子ども110番の家"

CRITICAL TEXT REQUIREMENTS:
- Render ONLY the 5 captions listed above, exactly as written, with NO title or extra Japanese text anywhere on the image.
- Numbers 1〜5 in small circles only — no other numerals.
- Do NOT add any banner text, headline text, or extra phrases. The grid should be clean.

Style: Clean, friendly Japanese infographic with simple flat illustrations, gentle outlines
Color palette: Soft pastel cream background with warm orange/red accents for danger points, green for safety, bright yellow for the help-house plate
Mood: Practical, parent-friendly, easy to understand at a glance
${QUALITY_SUFFIX}`,
        description: "通学路で親子で点検したい5つの危険ポイントの図解"
      }
    ]
  },
  {
    articleId: "2026-07-05-bicycle-blue-ticket-one-month-report",
    articleSlug: "bicycle-blue-ticket-one-month-report",
    category: "policy-update",
    title: "自転車青切符 施行1か月・暫定値（一時不停止40%・ながらスマホ33%）",
    thumbnailPrompt: `Create a Japanese editorial illustration continuing the visual world of the earlier 青切符 (blue traffic ticket) explainer article, showing a calm, reassuring one-month policy-update scene — NOT a violation or accident scene.

Scene elements:
- Two Japanese middle/high school students (16+ years old), wearing school uniforms (gakuran or blazer, same visual world as the previous article), riding bicycles on their school commute
- Both students wear properly fastened bicycle safety helmets (自転車用ヘルメット) — clearly visible, correctly worn
- They are stopped calmly with one foot down at a painted stop line (一時停止線) at a quiet residential intersection (住宅街の交差点), heads turned to look both ways before proceeding — a peaceful, rule-following, everyday moment
- A small "止まれ" (STOP) road sign and stop-line road marking are visible at the intersection corner
- Ordinary Japanese residential houses line both sides of the quiet street, soft morning light, no other vehicles nearby
- Bicycles have visible safety equipment (front light, reflector); no smartphone in either student's hand

Corner stamp badge (top-right corner of the frame):
- A small circular or rectangular ink-stamp-style badge overlaid in the corner, resembling an official Japanese hanko/rubber-stamp seal, textured like real stamp ink, slightly rotated as a genuine stamp would be
- Ink color: deep indigo-blue or vermillion-red
- The badge contains ONLY the Japanese text "施行1か月" on the first line and "暫定値" on the second line — exactly these two short lines, nothing else
- Do not render any other text, caption, or banner anywhere else in the image

Mood: calm, reassuring, educational — celebrating correct, compliant behavior, not fear-based messaging
Style: Clear Japanese editorial illustration, same art direction as the original 青切符 explainer (soft cel-shading, clean line work), slightly serious but approachable tone
Color palette: Blue accents referencing 青切符 (blue ticket), a soft violet/purple undertone for the policy-update category, warm neutral street tones, deep red or indigo for the stamp ink only

Strictly avoid (negative prompt): collision or near-miss imagery, a bicycle falling or a rider on the ground, scattered belongings, ambulance or police emergency lights, any frightening or violent imagery, realistic/identifiable human faces, real bicycle or phone brand logos, any recreation of a real accident scene, any text other than the two specified stamp lines, watermarks or signatures.
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "violation-breakdown",
        prompt: `Create a clean Japanese-style editorial infographic showing a horizontal bar chart of bicycle blue-ticket violation categories during the first month after enforcement began.

Layout:
- Title text at top: "自転車青切符 施行1か月間の違反内訳"
- Subtitle directly below the title, smaller text: "暫定値（2026年5月14日公表・施行後1か月間）"
- A horizontal bar chart with exactly 6 bars, longest at top, ordered by size, each bar labeled with its Japanese category name, count, and percentage:
  1. "指定場所一時不停止" — 846件 — 40%
  2. "携帯電話使用等（ながらスマホ）" — 713件 — 33%
  3. "信号無視" — 298件 — 14%
  4. "しゃ断踏切立入" — 156件 — 7%
  5. "通行区分違反（右側通行）" — 63件 — 3%
  6. "その他" — 71件 — 3%
- Bars 1 and 2 (指定場所一時不停止 and ながらスマホ) rendered in a warm caution color (orange/amber) since together they exceed 70% of all cases; bars 3-6 rendered in a cooler neutral blue/gray tone
- Small footer text at the bottom: "出典: 警察庁交通局交通企画課"
- A small simple icon of a stop-line/crosswalk near bar 1, and a small simple smartphone icon near bar 2, both flat and minimal (no faces, no brand logos)

CRITICAL TEXT REQUIREMENTS:
- Render ONLY the Japanese text listed above (title, subtitle, 6 category labels with their exact counts and percentages, and the footer source line) — no additional text, no extra captions, no invented numbers
- Numbers and percentages must exactly match: 846件/40%, 713件/33%, 298件/14%, 156件/7%, 63件/3%, 71件/3%
- Do not omit the "暫定値" (provisional figure) subtitle — it must be clearly legible

Style: Clean modern Japanese flat-design infographic, professional and trustworthy, high contrast for readability, generous white space, grid-aligned bars
Color palette: Warm amber/orange for the top two caution categories, cool blue/gray for the remaining categories, soft violet accent for policy-update branding, white/cream background
Mood: Informative, neutral, trustworthy — a factual government-style data report, not alarming

Strictly avoid (negative prompt): realistic or identifiable human faces, real accident scene recreation, real brand logos (phone brands, bicycle brands, police insignia), watermarks or signatures, any numbers or labels other than the ones specified above, 3D photorealistic rendering (must stay flat infographic style).
${QUALITY_SUFFIX}`,
        description: "施行1か月間の違反内訳（暫定値）の割合グラフ"
      }
    ]
  },
  {
    articleId: "2026-07-05-summer-break-safety-2026",
    articleSlug: "summer-break-safety-2026",
    category: "safety-tips",
    title: "夏休み前に守る、熱中症・転落・水難の3つの対策",
    thumbnailPrompt: `Create a bright, hopeful Japanese illustration of a family preparing for a safe summer break, set on a sunny elementary school commute route just before summer vacation begins.

Scene elements (Japanese specific):
- A Japanese elementary school child (低学年, first-to-third grade) wearing a bright yellow safety cap (黄色い通学帽) and carrying a red or black randoseru backpack (ランドセル)
- The child's parent (mother or father) walking beside them, smiling, helping adjust the child's water bottle strap (水筒) so it sits at an easy-to-reach angle
- A soft-sided tote or cooler bag near the parent, showing the top of a folded child-size life jacket (ライフジャケット) peeking out — packed and ready for a pool or beach trip
- A wide-brimmed sun hat or a cooling neck towel visible tucked in the child's bag pocket
- Bright blue summer sky (青空) with tall, puffy cumulonimbus clouds (入道雲) in the background
- A quiet Japanese residential school-route street with low tile-roofed houses, a marked crosswalk, and green roadside shrubs or a few sunflowers (ひまわり) in bloom
- Warm, clear midday sunlight without harsh shadows

Key visual themes:
- Preparation, not danger: parent and child are calmly getting ready together, not reacting to a hazard
- Water bottle + sun hat = heat-safety readiness
- Life jacket peeking from the bag = water-safety readiness
- Cumulonimbus clouds + bright blue sky + sunflowers = distinctly Japanese summer setting
- The mood should read as anticipation and excitement for summer, with safety folded in naturally

Mood: Bright, warm, encouraging, and forward-looking — a proactive "getting ready together" feeling, never frightening or alarming
Style: Soft Japanese anime/manga inspired editorial illustration, gentle shading, family-friendly and warm aesthetic
Color palette: Vivid summer blue sky, sunny yellow safety-cap accent, fresh green foliage, warm skin tones, soft white clouds

Avoid (negative prompt): realistic/photographic human faces, identifiable or real children, any real accident scene or depiction of a child falling/drowning/collapsing, frightening or alarming imagery, real brand logos or trademarks, visible text or signage other than generic shapes, blood or injury imagery
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "three-risks-checklist",
        prompt: `Create a clean, friendly Japanese-style infographic table comparing three summer safety risks for elementary school children: heat stroke, falls, and water accidents. NO extra title text in the image — the captions listed below are the only Japanese text allowed.

Layout: A table-style grid with 3 rows and 2 labeled columns, plus a small icon on the left of each row. Use a soft cream or white background with generous spacing between rows so it reads clearly as a table, not a busy scene.

Row 1 — icon: a simple flat-illustration water bottle (水筒) in blue/white. Row color accent: warm orange.
- Column "起きやすい場所" (Where it happens): a small illustration of a sunny school-route street with a child walking under strong sunlight, no shade
- Column "今すぐできる行動" (What to do now): a small illustration of a water bottle placed in an easy-to-reach backpack side pocket, with a small shade/tree icon nearby
- Row label caption: "熱中症"

Row 2 — icon: a simple flat-illustration open window with a small safety lock (窓) in soft green/gray. Row color accent: soft teal.
- Column "起きやすい場所": a small illustration of a home balcony/veranda with a window, kept calm and non-alarming (no child depicted falling)
- Column "今すぐできる行動": a small illustration of a hand installing a window auxiliary lock, and moving a plant pot away from the window ledge
- Row label caption: "転落"

Row 3 — icon: a simple flat-illustration child-size life jacket (ライフジャケット) in orange/yellow. Row color accent: aqua blue.
- Column "起きやすい場所": a small illustration of a pool or river/beach setting, calm water, sunny day
- Column "今すぐできる行動": a small illustration of a child wearing a life jacket floating calmly on their back, smiling, arms out
- Row label caption: "水難"

Column headers (render exactly once at the top of the table, in Japanese): "起きやすい場所" and "今すぐできる行動". Row labels (render exactly once per row, in Japanese, in a small badge to the left of each row): "熱中症", "転落", "水難".

CRITICAL TEXT REQUIREMENTS:
- Render ONLY the 2 column headers and the 3 row labels listed above, exactly as written, with no other Japanese or English text anywhere on the image.
- Do not add extra captions, numbers, or banner text inside the illustration cells.
- Keep the table grid lines simple and thin so the layout reads clearly at a glance.

Style: Clean, warm Japanese flat-illustration infographic, soft rounded icons, gentle color blocking per row, reassuring and instructional tone — never frightening
Color palette: Soft cream background, warm orange for the heat-stroke row, soft teal/green for the falls row, aqua blue for the water-accident row, warm neutral grid lines
Mood: Calm, clear, practical — a family reference chart, not a warning poster

Avoid (negative prompt): realistic/photographic human faces, identifiable or real children, any depiction of a child mid-fall, drowning, or in visible distress, blood or injury imagery, real brand logos, frightening or alarming visual elements, extra or garbled text
${QUALITY_SUFFIX}`,
        description: "「熱中症・転落・水難」3つのリスクと対策の一覧表インフォグラフィック（起きやすい場所×今すぐできる行動、水筒・窓・ライフジャケットのアイコン付き）"
      },
      {
        id: "accident-prevention-week-calendar",
        prompt: `Create a clean, printable Japanese-style weekly calendar infographic for "こどもの事故防止週間" (Children's Accident Prevention Week), covering July 13–19, 2026, with one simple fall-prevention home-safety check assigned to each day. NO extra title text beyond what is specified below.

Layout: A 7-cell calendar grid (can be one row of 7 or two rows), one cell per day, Monday through Sunday, in chronological order. Each cell contains: the date and day-of-week label, a small flat-icon illustration representing that day's check, and one short caption line below the icon. Give each cell a soft checkbox-style corner so it reads as something a family could print and physically check off.

Day cells (render exactly as specified, in order):
1. "7/13 (月)" — icon: a balcony air-conditioner outdoor unit with an arrow pointing it away from the railing — caption: "室外機の位置を確認"
2. "7/14 (火)" — icon: a window with its lock highlighted at a high position — caption: "窓の鍵の高さを確認"
3. "7/15 (水)" — icon: a hand installing a small auxiliary window lock — caption: "補助錠を取り付ける"
4. "7/16 (木)" — icon: a window screen (網戸) with a small "do not lean" symbol — caption: "網戸に寄りかからない"
5. "7/17 (金)" — icon: a staircase handrail with a non-slip strip — caption: "階段の手すりを確認"
6. "7/18 (土)" — icon: a parent and child talking calmly near a balcony door — caption: "家族でルールを確認"
7. "7/19 (日)" — icon: a checklist with a checkmark and a small star — caption: "1週間の点検をふりかえる"

Header text (render exactly once, above the grid): "こどもの事故防止週間 7/13-7/19"

CRITICAL TEXT REQUIREMENTS:
- Render ONLY the header text, the 7 date/day labels, and the 7 captions listed above, exactly as written, with no additional Japanese or English text.
- Keep icons simple, flat, and calm — no depiction of a child mid-fall or in danger.
- Ensure all 7 day cells are visually equal in size, evenly spaced, and in correct chronological order (Mon→Sun, 7/13→7/19).

Style: Clean, friendly Japanese printable calendar design, soft pastel color blocking, gentle rounded icons, family-reference aesthetic suitable for printing and posting on a refrigerator
Color palette: Soft pastel cream/white background, warm coral or soft orange accent for checkboxes, calm blue-green for icons, no harsh red warning colors
Mood: Encouraging, practical, achievable — a gentle weekly habit tracker, not a warning poster

Avoid (negative prompt): realistic/photographic human faces, identifiable or real children, any depiction of a child falling or in danger, blood or injury imagery, real brand logos, frightening or alarming visual elements, extra or garbled text, incorrect date/day pairings
${QUALITY_SUFFIX}`,
        description: "「こどもの事故防止週間」（2026年7月13日〜19日）の1週間カレンダービジュアル。転落防止の点検項目を1日1つ配置し、保存・印刷して使える構成。"
      }
    ]
  }
]

async function generateImage(prompt: string, outputPath: string): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set")
    return false
  }

  try {
    console.log(`Generating image: ${path.basename(outputPath)}`)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["image", "text"],
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`API Error: ${errorData.error?.message || response.statusText}`)
      return false
    }

    const data = await response.json()
    const candidates = data.candidates

    if (!candidates || candidates.length === 0) {
      console.error("No response from API")
      return false
    }

    const parts = candidates[0].content?.parts
    if (!parts) {
      console.error("No content parts in response")
      return false
    }

    // Find image data in response
    const imagePart = parts.find((part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData)
    if (!imagePart || !imagePart.inlineData) {
      console.error("No image data in response")
      console.log("Response parts:", JSON.stringify(parts, null, 2))
      return false
    }

    // Save image to file
    const imageData = imagePart.inlineData.data
    const buffer = Buffer.from(imageData, "base64")

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, buffer)
    console.log(`✓ Saved: ${outputPath}`)
    return true
  } catch (error) {
    console.error(`Error generating image:`, error)
    return false
  }
}

async function generateAllImages() {
  console.log("=== SAFE MAGAZINE 日本向け高品質画像生成 ===\n")

  const basePath = path.join(process.cwd(), "public", "images", "safe-magazine")
  const forceRegenerate = process.argv.includes("--force")

  for (const config of ARTICLE_IMAGES) {
    console.log(`\n--- Article: ${config.title} ---`)

    // Generate thumbnail (skip if exists unless --force)
    const thumbnailPath = path.join(basePath, "thumbnails", `${config.articleSlug}.png`)
    if (!forceRegenerate && fs.existsSync(thumbnailPath)) {
      console.log(`⊘ Skipped (exists): ${path.basename(thumbnailPath)}`)
    } else {
      await generateImage(config.thumbnailPrompt, thumbnailPath)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    // Generate content images (skip if exists unless --force)
    for (const contentImage of config.contentImages) {
      const imagePath = path.join(basePath, "articles", config.articleSlug, `${contentImage.id}.png`)
      if (!forceRegenerate && fs.existsSync(imagePath)) {
        console.log(`⊘ Skipped (exists): ${path.basename(imagePath)}`)
        continue
      }
      await generateImage(contentImage.prompt, imagePath)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  console.log("\n=== Generation Complete ===")
}

// Run the script
generateAllImages().catch(console.error)
