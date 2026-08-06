import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image"

console.log(`API Key loaded: ${API_KEY ? "Yes" : "No"}`)
console.log(`Model: ${MODEL}`)

const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details
- Japanese editorial illustration style
- Clean, professional design
- No watermarks, no text overlays, no signatures
- Warm, appropriate for family and education content
- Anime/manga inspired art style for Japanese audiences
`

interface NewsImageConfig {
  slug: string
  filename: string
  prompt: string
  description: string
}

const NEWS_IMAGES: NewsImageConfig[] = [
  {
    slug: "fukuoka-asakura-accident",
    filename: "fukuoka-asakura-accident.png",
    prompt: `Create a Japanese safety awareness illustration about a traffic accident at an intersection involving children on bicycles.

Scene elements (abstract, NOT depicting actual accident):
- A quiet Japanese rural intersection without traffic signals
- A bicycle lying on its side near the intersection
- Yellow safety cap on the ground
- Tire marks on the road surface
- Warning/caution atmosphere
- Japanese road markings and surroundings

Style: Somber but not graphic, Japanese editorial illustration
Focus on safety awareness, NOT on depicting injury
Color palette: Muted tones with red warning accents
${QUALITY_SUFFIX}`,
    description: "福岡県朝倉市の交差点事故"
  },
  {
    slug: "bicycle-blue-ticket",
    filename: "bicycle-blue-ticket.png",
    prompt: `Create a Japanese infographic-style illustration about new bicycle traffic rules starting April 2026.

Visual elements:
- A bicycle on a Japanese road with clear lane markings
- A blue ticket/citation document icon
- Japanese traffic signs for bicycle lanes
- Split view showing correct vs incorrect bicycle road usage
- Elementary school children safely on the sidewalk
- Adults on bicycles using the road properly

Style: Clean Japanese educational infographic
Color palette: Blue for rules/policy, green for safety
Focus: New rules awareness for families
${QUALITY_SUFFIX}`,
    description: "自転車青切符制度"
  },
  {
    slug: "zone30plus-model",
    filename: "zone30plus-model.png",
    prompt: `Create a Japanese illustration showing a "Zone 30 Plus" school safety zone.

Visual elements:
- A Japanese residential street with "30" speed limit painted on road
- Physical speed reduction devices (humps, narrowing)
- Safety bollards and colored pavement markings
- Elementary school children walking safely with yellow caps and randoseru
- A school building in the background
- Zone 30 Plus signage

Style: Bright, positive Japanese editorial illustration
Color palette: Blue for infrastructure, green for safety
Mood: Safe, modern, well-planned community
${QUALITY_SUFFIX}`,
    description: "ゾーン30プラス"
  },
  {
    slug: "iga-safety-signs",
    filename: "iga-safety-signs.png",
    prompt: `Create a warm Japanese community scene showing a safety sign donation ceremony for school routes.

Scene elements (Japanese specific):
- Japanese rural/suburban setting in Mie Prefecture (三重県)
- "飛び出し注意" (Watch Out for Children) safety sign - classic Japanese yellow diamond-shaped sign with child figure
- Construction company representative (竹島建設 worker) presenting/installing sign
- Local community members and district officers (地区役員) observing
- County road (県道) setting with narrow Japanese street
- Elementary school children walking with yellow safety caps and randoseru in background
- Ayama Elementary/Junior High School (阿山小学校・中学校) visible in distance

Mood: Community cooperation, warmth, local pride, safety-focused
Atmosphere: Bright daylight, hopeful, collaborative

Visual style:
- Warm Japanese slice-of-life illustration
- Soft, friendly aesthetic suitable for community news
- Focus on human connection and local collaboration
- Construction company worker in uniform/vest with company logo visible

Japanese text elements to include visually:
- "飛び出し注意" on the sign
- Community gathering feeling

Color palette:
- Yellow for safety sign (classic Japanese warning sign color)
- Warm earth tones for community setting
- Green accents (company activity, nature)
- Bright, optimistic colors

Setting details:
- Residential area typical of Japanese countryside cities
- Small traditional shops or houses in background
- Power lines, narrow roads typical of Japanese prefectural roads
${QUALITY_SUFFIX}`,
    description: "伊賀市看板寄贈"
  },
  {
    slug: "mext-volunteer-awards",
    filename: "mext-volunteer-awards.png",
    prompt: `Create a warm Japanese illustration showing school safety volunteer activities.

Visual elements:
- Elderly Japanese volunteers wearing yellow safety vests
- Holding yellow safety flags at a crosswalk
- Elementary school children with yellow caps and randoseru crossing safely
- A warm morning scene in a Japanese neighborhood
- Cherry blossoms or seasonal greenery
- Community members watching over children with smiles
- A "スクールガード" (School Guard) armband

Style: Warm, heartfelt Japanese illustration
Color palette: Warm yellows, greens, community warmth
Mood: Gratitude, community support, safety
${QUALITY_SUFFIX}`,
    description: "見守りボランティア表彰"
  },
  {
    slug: "residential-road-30kmh",
    filename: "residential-road-30kmh.png",
    prompt: `Create a Japanese infographic illustration about a new speed limit law reducing residential road limits to 30km/h.

Visual elements:
- A narrow Japanese residential street (生活道路) with houses, fences, and power lines
- A large "30" speed limit road sign prominently displayed
- A car slowing down near a crosswalk
- Elementary school children walking safely with yellow caps and randoseru backpacks
- Traffic calming markings painted on the road surface
- A calendar/date indicator suggesting April 2026 law revision

Style: Clean Japanese educational infographic
Color palette: Orange/yellow for warning, blue for law/policy
Focus: New law awareness for local residents and families
${QUALITY_SUFFIX}`,
    description: "生活道路30km/h速度規制"
  },
  {
    slug: "spring-suspicious-alert",
    filename: "spring-suspicious-alert.png",
    prompt: `Create a Japanese safety awareness illustration about protecting children from suspicious strangers during spring.

Visual elements:
- A Japanese neighborhood street scene in spring (cherry blossoms)
- A child walking to school with yellow cap and randoseru
- A "いかのおすし" (safety rules for children) sign or poster nearby
- An adult volunteer in yellow safety vest watching over from a distance
- Bright, safe atmosphere but with subtle awareness messaging
- Community patrol or local neighborhood watch presence

Style: Warm but alert Japanese safety illustration
Color palette: Spring pinks and greens, yellow for safety
Mood: Protective, community-focused, child safety awareness
Focus: Spring seasonal alert without depicting threatening figures
${QUALITY_SUFFIX}`,
    description: "春の不審者警戒"
  },
  {
    slug: "zone30plus-model-districts",
    filename: "zone30plus-model-districts.png",
    prompt: `Create a Japanese illustration showing Zone 30 Plus model districts rollout across Japan.

Visual elements:
- A map of Japan with multiple highlighted regions (65 locations)
- A residential Japanese street with "ゾーン30プラス" zone signage
- Physical road safety measures: speed humps, colored pavement, bollards
- Elementary school children in yellow caps walking safely
- Police and local government representatives discussing plans
- An infographic-style layout showing before/after street improvements

Style: Modern Japanese infographic/editorial illustration
Color palette: Blue and green for infrastructure safety, orange for highlighted zones
Mood: Progressive, systematic, nationwide safety improvement
${QUALITY_SUFFIX}`,
    description: "ゾーン30プラス65箇所モデル地区"
  },
  {
    slug: "new-first-grader-safety",
    filename: "new-first-grader-safety.png",
    prompt: `Create a warm Japanese illustration showing a family walking a new school route with their first-grade child.

Visual elements:
- A cheerful new first-grader (新1年生) in a brand new uniform with yellow randoseru
- Parents walking the route together on a bright spring morning
- Cherry blossoms lining a Japanese residential street
- Crosswalks, traffic signals, and school zone markings
- A school building visible in the distance
- Community safety signs and friendly crossing guard in yellow vest

Style: Heartfelt, warm Japanese family illustration
Color palette: Spring pastels, yellow for school safety, warm family tones
Mood: Hopeful, safety-conscious, family bonding, new beginning
Focus: Importance of walking the school route before the start of school
${QUALITY_SUFFIX}`,
    description: "新1年生交通安全"
  },
  {
    slug: "national-spring-traffic-safety-campaign-20260330",
    filename: "national-spring-traffic-safety-campaign-20260330.png",
    prompt: `Create a Japanese illustration about the national spring traffic safety campaign (令和8年春の全国交通安全運動).

Visual elements:
- Elementary school children with yellow caps and randoseru crossing a crosswalk safely
- A volunteer in a yellow safety vest holding a yellow flag
- Spring cherry blossoms lining a Japanese residential street
- Traffic safety campaign banners (交通安全運動) on poles
- A school zone marking on the road
- Bright morning scene with warm sunlight

Style: Bright, community-oriented Japanese illustration
Color palette: Orange/yellow for safety campaign, spring pinks and greens
Mood: Safe, community support, awareness
Focus: Spring school commute safety and community watch
${QUALITY_SUFFIX}`,
    description: "令和8年春の全国交通安全運動"
  },
  {
    slug: "national-model-zone-65-areas-20260330",
    filename: "national-model-zone-65-areas-20260330.png",
    prompt: `Create a Japanese infographic illustration about the Ministry of Land Infrastructure Transport and Tourism selecting 65 model zones for school route safety improvements.

Visual elements:
- A stylized map of Japan with 65 highlighted points/regions
- A residential Japanese street with guardrails, widened sidewalks, and crosswalk markings
- Elementary school children walking safely with yellow caps and randoseru
- Road infrastructure elements: guardrails, colored pavement, pedestrian barriers
- An infographic-style layout suggesting nationwide coverage
- Government seal or document icon suggesting official policy

Style: Modern Japanese infographic/editorial illustration
Color palette: Blue and green for infrastructure safety, orange dots for highlighted zones
Mood: Progressive, systematic, nationwide safety improvement
Focus: Infrastructure-based safety improvements for school routes
${QUALITY_SUFFIX}`,
    description: "国交省モデル地域65箇所"
  },
  {
    slug: "national-school-watch-activity-handbook-20260330",
    filename: "national-school-watch-activity-handbook-20260330.png",
    prompt: `Create a warm Japanese illustration about community school route watch activities strengthened before the new school term.

Visual elements:
- Elderly and adult volunteers in bright yellow safety vests holding flags
- Elementary school children with yellow caps and randoseru walking safely
- A crosswalk scene in a Japanese neighborhood
- Spring cherry blossoms suggesting new school term
- A handbook or guidebook element suggesting the Ministry of Education handbook
- Community members smiling and cooperating

Style: Heartfelt, warm Japanese community illustration
Color palette: Greens and yellows for community warmth and safety
Mood: Cooperative, protective, hopeful community spirit
Focus: Volunteer watch activities protecting children on school routes
${QUALITY_SUFFIX}`,
    description: "新学期見守り活動強化"
  },
  {
    slug: "national-weekly-trend-20260706",
    filename: "national-weekly-trend-20260706.png",
    prompt: `Create a calm Japanese infographic-style illustration for a weekly school route safety trend report.

Visual elements:
- A clean weekly calendar page motif shown ONLY as seven blank squares with soft checkmark icons (no letters, no day names)
- A soft stylized map of Japan silhouette in the background
- A simple flat line chart motif staying at the bottom axis (calm, reassuring, zero incidents)
- Elementary school children with yellow caps and randoseru walking safely in summer morning light
- A parent checking a smartphone with a peaceful expression (blank glowing screen, no UI text)
- Early summer greenery (no cherry blossoms), hints of approaching summer break

STRICT RULE: Absolutely NO text of any kind anywhere in the image. No Japanese characters, no Latin letters, no numbers, no words on the calendar, chart, phone screen, or background. Purely pictorial.

Style: Modern Japanese editorial infographic, calm and analytical
Color palette: Soft purple and blue for analysis/report, warm green accents for reassurance
Mood: Peaceful, informative, trustworthy weekly review
Focus: Weekly data review and family preparedness, NOT danger or fear
${QUALITY_SUFFIX}`,
    description: "週次傾向レポート（2026年7月6日号）"
  },
  {
    slug: "sendai-aoba-kawadaira-repeated-suspicious-20260706",
    filename: "sendai-aoba-kawadaira-repeated-suspicious-20260706.png",
    prompt: `Create a Japanese safety awareness illustration about repeated voice-calling incidents targeting children on a school route in a residential neighborhood.

Scene elements (abstract, NOT depicting any actual person or incident):
- A quiet Japanese residential street in early summer, seen from a distance/wide angle
- Two elementary school girls with yellow safety caps and randoseru walking together, viewed from behind, small in the frame
- A faint, shadowy silhouette suggestion of an unseen presence at the edge of the frame (indistinct, not a depicted person)
- Warning/alert atmosphere without being frightening
- A "3 times in 3 weeks" repeated-pattern feeling conveyed through three faint overlapping street-corner motifs or a subtle repeating path marking

STRICT RULE: No text of any kind anywhere in the image.

Style: Somber but reassuring Japanese editorial illustration, NOT graphic or violent
Focus on the value of walking together (complementing the safety), not on depicting a threatening figure
Color palette: Muted orange/amber warning accents on a calm residential background
${QUALITY_SUFFIX}`,
    description: "仙台市青葉区川平 声かけ事案クラスタ（2026年7月6日号）"
  },
  {
    slug: "okayama-koto-guardrail-installed-20260627",
    filename: "okayama-koto-guardrail-installed-20260627.png",
    prompt: `Create a bright, reassuring Japanese illustration about a new guardrail installed beside an irrigation canal along a school route.

Visual elements:
- A newly installed metal guardrail running along a narrow canal/waterway beside a quiet residential road
- Elementary school children with yellow caps and randoseru walking safely on the protected side of the guardrail
- Green rice-paddy or canal-side scenery typical of Okayama, Japan
- Bright daylight, clear blue sky, a sense of relief and improved safety
- No text of any kind anywhere in the image

Style: Clean, bright Japanese editorial infographic illustration
Color palette: Blue/gray for the guardrail and infrastructure, green for the safe surroundings
Mood: Reassuring, community safety improvement, everyday life
${QUALITY_SUFFIX}`,
    description: "岡山市古都学区 通学路ガードレール設置（2026年7月6日号）"
  },
  {
    slug: "hamamatsu-chuo-crosswalk-accident-20260703",
    filename: "hamamatsu-chuo-crosswalk-accident-20260703.png",
    prompt: `Create a Japanese safety awareness illustration about a traffic accident at a crosswalk involving a child on the way to school.

Scene elements (abstract, NOT depicting actual injury):
- A quiet Japanese urban intersection with a pedestrian crosswalk and a traffic signal showing green for pedestrians
- A yellow school safety cap dropped on the crosswalk
- A car stopped at an angle just past the crosswalk, suggesting it failed to stop in time
- Warning/caution atmosphere without depicting any person or injury
- Japanese road markings, signal poles, and street signs in the background

Style: Somber but not graphic, Japanese editorial illustration
Focus on safety awareness, NOT on depicting injury or people
Color palette: Muted tones with red warning accents
No text of any kind anywhere in the image
${QUALITY_SUFFIX}`,
    description: "浜松市中央区 横断歩道事故（2026年7月14日号）"
  },
  {
    slug: "sendai-miyagino-tsurugaya-suspicious-20260710",
    filename: "sendai-miyagino-tsurugaya-suspicious-20260710.png",
    prompt: `Create a Japanese safety awareness illustration about a stranger-danger voice-call incident on a school route.

Scene elements (abstract, NOT depicting the perpetrator's face):
- A quiet Japanese residential street in early morning light
- A yellow school safety cap and randoseru backpack seen from behind, walking alone toward the viewer's left
- A shadowy, faceless silhouette of an adult figure in the distance, deliberately vague and non-identifying
- A speech-bubble icon with a simple question mark, suggesting an unwanted question, no legible text
- Calm but alert atmosphere

Style: Clean Japanese editorial illustration, cautionary but not frightening
Color palette: Orange caution accents, soft morning light tones
No text of any kind anywhere in the image, no depiction of a recognizable face
${QUALITY_SUFFIX}`,
    description: "仙台市宮城野区鶴ケ谷 声かけ事案（2026年7月14日号）"
  },
  {
    slug: "kashima-minatogaoka-candy-suspicious-20260710",
    filename: "kashima-minatogaoka-candy-suspicious-20260710.png",
    prompt: `Create a Japanese safety awareness illustration about a stranger offering candy to children on a school route.

Scene elements (abstract, NOT depicting the perpetrator's face):
- A quiet Japanese residential street near an elementary school, late afternoon light
- Two children with yellow safety caps and randoseru backpacks seen from behind, walking away
- A faceless silhouette of an adult figure holding out an ice cream/popsicle shape, deliberately vague and non-identifying
- A red "X" or caution icon near the offered item, suggesting the item should be declined
- Warm daylight but a subtle sense of caution

Style: Clean Japanese editorial illustration, cautionary but not frightening
Color palette: Orange caution accents, warm afternoon tones
No text of any kind anywhere in the image, no depiction of a recognizable face
${QUALITY_SUFFIX}`,
    description: "鹿嶋市港ケ丘 菓子譲渡型声かけ事案（2026年7月14日号）"
  },
  {
    slug: "komaki-muranaka-crosswalk-fatal-20260715",
    filename: "komaki-muranaka-crosswalk-fatal-20260715.png",
    prompt: `Create a Japanese safety awareness illustration about a fatal traffic accident at an unsignalized crosswalk during a group school walk.

Scene elements (abstract, NOT depicting actual injury or any person):
- A quiet Japanese suburban intersection with a pedestrian crosswalk but no traffic signal
- A line of small yellow safety caps and randoseru backpacks, seen only as a receding row of shapes from behind, walking away toward the viewer's left, with the last cap dropped on the crosswalk
- A car stopped at an angle just past the crosswalk, suggesting it failed to stop in time
- Solemn, respectful, warning atmosphere without depicting any person, face, or injury
- Japanese road markings, utility poles, and residential street in the background

Style: Somber but not graphic, respectful Japanese editorial illustration
Focus on safety awareness, NOT on depicting injury or people
Color palette: Muted tones with red warning accents
No text of any kind anywhere in the image
${QUALITY_SUFFIX}`,
    description: "小牧市村中 集団登校中の横断歩道死亡事故（2026年7月17日号）"
  },
  {
    slug: "nishitokyo-izumicho-crosswalk-fatal-20260716",
    filename: "nishitokyo-izumicho-crosswalk-fatal-20260716.png",
    prompt: `Create a Japanese safety awareness illustration about a fatal traffic accident where a right-turning vehicle struck a child crossing on a green pedestrian signal.

Scene elements (abstract, NOT depicting actual injury or any person):
- A Japanese urban signalized intersection with a pedestrian crosswalk, both the pedestrian signal and vehicle signal showing green
- A single small yellow safety cap and randoseru backpack dropped on the crosswalk, seen from behind with no face
- A car mid-turn at the corner of the intersection, curved tire-mark arc suggesting the turning path crossing into the crosswalk
- Solemn, respectful, warning atmosphere without depicting any person, face, or injury
- Japanese signal poles, crosswalk stripes, and street signs in the background

Style: Somber but not graphic, respectful Japanese editorial illustration
Focus on the blind spot of turning vehicles at green signals, NOT on depicting injury or people
Color palette: Muted tones with red warning accents, a hint of green from the signal light
No text of any kind anywhere in the image
${QUALITY_SUFFIX}`,
    description: "西東京市泉町6丁目 右折車による横断歩道死亡事故（2026年7月17日号）"
  },
  {
    slug: "naha-matsukawa-schoolzone-motorcycle-20260716",
    filename: "naha-matsukawa-schoolzone-motorcycle-20260716.png",
    prompt: `Create a Japanese safety awareness illustration about a motorcycle fleeing a police stop and striking pedestrians waiting at a crosswalk near a school.

Scene elements (abstract, NOT depicting actual injury or any person's face):
- A Japanese residential street with a crosswalk, with plain red-colored pavement zone markings (solid color blocks only, absolutely no lettering, no kanji, no characters, no numbers of any kind painted on the road)
- Exactly two small silhouetted figures seen from behind with no visible faces: one shorter figure wearing a yellow safety cap and randoseru backpack, and one taller figure without a cap, both standing well back from the road edge, waiting at the crosswalk
- A faceless motorcycle silhouette in the distance making a sharp U-turn, motion-blur lines suggesting sudden fleeing movement
- Warning/caution atmosphere without depicting any person's face or injury
- Japanese road markings (plain white stripes only) and residential street in the background

Style: Cautionary but not graphic, Japanese editorial illustration
Focus on safety awareness (standing back from the road edge), NOT on depicting injury or people
Color palette: Muted tones with red warning accents
ABSOLUTE RULE: no text, no letters, no kanji, no numbers, no signage lettering of any kind anywhere in the image, including on the road surface, signs, or background — use only plain shapes, colors, and icons
${QUALITY_SUFFIX}`,
    description: "那覇市松川 スクールゾーン逃走バイク衝突事案（2026年7月17日号）"
  },
  {
    slug: "oamishirasato-miyakono-thigh-touch-suspicious-20260711",
    filename: "oamishirasato-miyakono-thigh-touch-suspicious-20260711.png",
    prompt: `Create a Japanese safety awareness illustration about a stranger touching a child on a school route.

Scene elements (abstract, NOT depicting the perpetrator's face):
- A quiet Japanese residential street near a school, late afternoon light
- A single child with a yellow safety cap and randoseru backpack seen from behind, walking alone
- A faceless silhouette of an adult figure reaching toward the child, deliberately vague and non-identifying, positioned at a respectful distance to avoid depicting actual contact
- A red warning outline or caution icon near the silhouette's hand, suggesting the behavior should be stopped
- Calm but alert atmosphere

Style: Clean Japanese editorial illustration, cautionary but not frightening, NOT graphic
Color palette: Orange caution accents, warm afternoon tones
No text of any kind anywhere in the image, no depiction of a recognizable face, no depiction of actual physical contact
${QUALITY_SUFFIX}`,
    description: "大網白里市みやこ野 身体接触を伴う声かけ事案（2026年7月18日号）"
  },
  {
    slug: "nara-statewide-child-approach-cluster-20260718",
    filename: "nara-statewide-child-approach-cluster-20260718.png",
    prompt: `Create a Japanese safety awareness illustration about a cluster of stranger-danger incidents targeting elementary school children across multiple towns in a prefecture.

Scene elements (abstract, NOT depicting any actual person):
- A soft stylized map silhouette suggesting a prefecture with three faint highlighted points, no labels or text
- Three small groups of a child with yellow safety cap and randoseru backpack, seen from behind at a distance, walking on separate quiet residential streets
- Faint, shadowy, faceless silhouettes of adult figures at the edge of each scene, deliberately vague and non-identifying
- A subtle icon suggesting a hand reaching toward a wrist, abstract and non-graphic, to hint at the physical-contact incident without depicting it directly
- Warning/alert atmosphere without being frightening

STRICT RULE: No text, no letters, no numbers of any kind anywhere in the image.

Style: Somber but reassuring Japanese editorial illustration, NOT graphic or violent
Color palette: Muted orange/amber warning accents on calm residential backgrounds
${QUALITY_SUFFIX}`,
    description: "奈良県内 登下校中の児童への声かけ・つきまといクラスタ（2026年7月18日号）"
  },
  {
    slug: "yamato-ichoudanchi-bollard-signal-safety-20260605",
    filename: "yamato-ichoudanchi-bollard-signal-safety-20260605.png",
    prompt: `Create a bright, reassuring Japanese illustration about new bollards and extended pedestrian signal timing installed near a school route.

Visual elements:
- A Japanese residential intersection with newly installed bollards (short posts) protecting a crosswalk corner
- A pedestrian traffic signal showing a walking-person icon in green
- Elementary school children with yellow caps and randoseru walking safely across the protected crosswalk
- A calm residential street typical of a Japanese suburban housing complex (danchi) in the background
- Bright daylight, clear sky, a sense of relief and improved safety
- No text of any kind anywhere in the image

Style: Clean, bright Japanese editorial infographic illustration
Color palette: Blue/gray for the infrastructure, green for the safe surroundings
Mood: Reassuring, community safety improvement, everyday life
${QUALITY_SUFFIX}`,
    description: "大和市 いちょう団地周辺 ボラード・信号延長（2026年7月18日号）"
  },
  {
    slug: "bunkyo-nezu-schoolguard-meeting-20260625",
    filename: "bunkyo-nezu-schoolguard-meeting-20260625.png",
    prompt: `Create a warm Japanese illustration showing a PTA-organized school safety guard meeting and lecture.

Visual elements:
- A warm community meeting room scene with parent volunteers listening to a speaker
- A speaker gesturing warmly at the front, suggesting a crime-prevention advisor giving a friendly talk
- Small inset motif of adult volunteers smiling and waving at elementary school children with yellow caps and randoseru on a sunny street outside
- Bright, welcoming colors suggesting community warmth and cooperation
- No text of any kind anywhere in the image

Style: Heartfelt, warm Japanese community illustration
Color palette: Greens and warm yellows for community warmth and safety
Mood: Cooperative, welcoming, grassroots community spirit
${QUALITY_SUFFIX}`,
    description: "文京区 根津小PTA スクールガード連絡会（2026年7月18日号）"
  },
  {
    slug: "kawasaki-kannon-citybus-redlight-20260724",
    filename: "kawasaki-kannon-citybus-redlight-20260724.png",
    prompt: `Create a Japanese safety awareness illustration about a city bus entering an intersection on a red light while a child crosses on a kick scooter.

Scene elements (abstract, NOT depicting actual injury or any person's face):
- A Japanese urban T-shaped intersection with a pedestrian crosswalk and a traffic signal pole
- The vehicle traffic signal clearly showing a red light as a plain glowing red circle (no numbers, no countdown digits)
- A large city bus silhouette approaching the intersection, seen at an angle, with soft motion-blur lines suggesting it did not slow down, windows shown as plain dark glass with no passengers' faces
- A small kick scooter lying on its side near the crosswalk stripes, with a child's cap on the ground beside it, no person depicted at all
- Solemn, cautionary atmosphere emphasizing the contrast between the red signal and the moving bus
- Japanese road markings, utility poles, and a low-rise residential street in the background

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including on the bus destination display, signage, or road surface — use plain shapes and colors only.

Style: Somber but not graphic, Japanese editorial illustration
Focus on the danger of assuming vehicles will stop, NOT on depicting injury or people
Color palette: Muted tones with strong red warning accents from the signal
${QUALITY_SUFFIX}`,
    description: "川崎市川崎区観音 市バス赤信号進入・小2男児衝突（2026年7月26日号）"
  },
  {
    slug: "hiroshima-city-child-contact-cluster-20260720",
    filename: "hiroshima-city-child-contact-cluster-20260720.png",
    prompt: `Create a Japanese safety awareness illustration about a cluster of incidents targeting children on their way home in the early evening across several wards of one city.

Scene elements (abstract, NOT depicting any actual person's face):
- A soft stylized city-ward map silhouette in the background with three faint highlighted points, no labels of any kind
- Three separate small vignettes of a single child with a school backpack seen from behind at a distance, walking home on quiet residential streets
- Faint, shadowy, faceless silhouettes of adult figures at the edge of each vignette, deliberately vague and non-identifying
- One vignette subtly suggesting a hand reaching toward a wrist, kept abstract and non-graphic, with the child already stepping briskly away to convey successful escape
- Low evening sunlight with long shadows, conveying the late-afternoon-to-dusk time band
- Alert but reassuring atmosphere, emphasizing getting away safely rather than the threat

STRICT RULE: No text, no letters, no numbers of any kind anywhere in the image.

Style: Somber but reassuring Japanese editorial illustration, NOT graphic or violent
Color palette: Muted orange/amber warning accents over calm dusk-toned residential backgrounds
${QUALITY_SUFFIX}`,
    description: "広島市 帰宅中の子どもへの接触事案クラスタ（2026年7月26日号）"
  },
  {
    slug: "kitakyushu-kokuraminami-higashitsuranuki-touch-20260709",
    filename: "kitakyushu-kokuraminami-higashitsuranuki-touch-20260709.png",
    prompt: `Create a Japanese safety awareness illustration about a stranger questioning a child about her school and age before touching her.

Scene elements (abstract, NOT depicting the perpetrator's face or actual contact):
- A quiet Japanese residential street in mid-afternoon light
- A single child with a school backpack seen from behind, walking alone, small in the frame
- A faceless, featureless silhouette of an adult figure wearing a dark cap and a dark face covering, deliberately vague and non-identifying, positioned at a clear distance so no physical contact is shown
- Two or three plain speech-bubble shapes containing only simple question-mark icons, suggesting prying questions, with absolutely no legible words
- A red caution outline near the silhouette suggesting the behavior should be refused and reported
- Calm but alert atmosphere

STRICT RULE: No text, no letters, no kanji, no numbers anywhere in the image. No recognizable face. No depiction of actual physical contact.

Style: Clean Japanese editorial illustration, cautionary but not frightening
Color palette: Orange caution accents with warm afternoon street tones
${QUALITY_SUFFIX}`,
    description: "北九州市小倉南区東貫 質問型の身体接触事案（2026年7月26日号）"
  },
  {
    slug: "komaki-council-signal-request-20260722",
    filename: "komaki-council-signal-request-20260722.png",
    prompt: `Create a Japanese editorial illustration about a city council submitting an urgent safety petition calling for a traffic signal and city-wide school route inspections.

Visual elements (constructive and forward-looking, NOT depicting an accident):
- A formal document folder being handed from one pair of hands to another, shown as a clean symbolic gesture with no faces required, suggesting an official petition submission
- A new pedestrian traffic signal standing at a residential intersection, showing a walking-person icon in green
- A stylized checklist motif rendered ONLY as blank rounded squares with soft checkmark icons, suggesting a safety inspection sweep, with no words
- Small background vignette of adults in safety vests walking a school route with clipboards, inspecting a crosswalk
- Elementary school children with yellow caps and school backpacks crossing safely in the middle distance
- Bright daylight, a sense of resolve and improvement rather than grief

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including on the document, checklist, or signage.

Style: Clean, purposeful Japanese editorial infographic illustration
Color palette: Purple and blue-violet for policy and official action, green accents for restored safety
Mood: Determined, constructive, institutional response to a preventable tragedy
${QUALITY_SUFFIX}`,
    description: "小牧市 市議会による信号機設置・通学路緊急点検の要望（2026年7月26日号）"
  },
  {
    slug: "tomakomai-sumikawa-crosswalk-children-20260803",
    filename: "tomakomai-sumikawa-crosswalk-children-20260803.png",
    prompt: `Create a Japanese safety awareness illustration about the danger of a car entering a signalized intersection against the light while children are crossing on green.

Scene elements (abstract awareness image, NOT depicting injury or impact):
- An early summer morning at a Japanese residential intersection with working traffic signals, long low sunlight and pale sky
- A pedestrian signal clearly showing the green walking-person icon
- A group of small children in summer clothes waiting at the curb behind the crosswalk stop line, one step back from the white stripes
- A single car approaching the intersection from the side, drawn at a distance and slightly blurred with motion streaks to suggest it is not slowing down
- Emphasis on the gap between the children and the car — tension of an unresolved moment, NOT a collision
- Bold white crosswalk stripes as the visual anchor of the composition

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including on signals, signs, or the vehicle.
STRICT RULE: Do not depict injury, blood, a fallen child, or the moment of impact.

Style: Sober Japanese editorial illustration, safety-awareness poster sensibility
Color palette: Cool early-morning blues and greys with strong red warning accents
Mood: Serious and cautionary, focused on the moment before — a green light is not a guarantee
${QUALITY_SUFFIX}`,
    description: "苫小牧市澄川町 青信号横断中の児童2人が信号無視の車にはねられた事故（2026年8月7日号）"
  },
  {
    slug: "national-residential-road-30kmh-20260901",
    filename: "national-residential-road-30kmh-20260901.png",
    prompt: `Create a Japanese editorial infographic illustration about a nationwide rule change lowering the default speed limit on narrow residential streets used as school routes.

Visual elements (constructive, explanatory, forward-looking):
- A narrow Japanese residential street with NO painted center line and no lane markings — this absence is the key visual point, so keep the asphalt clean and unmarked down the middle
- The same street shown with houses, low walls, utility poles and hedges close to the roadway, with no separated sidewalk
- A car travelling slowly, drawn crisp and stationary-feeling (no motion blur) to suggest reduced speed
- A circular road sign rendered as a plain white disc with a red rim and a completely EMPTY center — absolutely no numerals inside
- Elementary school children with yellow caps and school backpacks walking along the road edge, calm and safe
- A subtle contrast device such as a soft speed-arc or gentle gradient suggesting "slower", without any figures or symbols
- Bright clear late-summer daylight, start-of-term atmosphere

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including inside the round sign, on the road surface, or on the vehicle.

Style: Clean Japanese editorial infographic illustration, calm and instructional
Color palette: Purple and blue-violet for policy, with red sign accent and warm daylight
Mood: Reassuring, explanatory, institutional improvement
${QUALITY_SUFFIX}`,
    description: "2026年9月1日施行 生活道路の法定速度30km/h引き下げ（2026年8月7日号）"
  },
  {
    slug: "nara-vehicle-approach-cluster-20260804",
    filename: "nara-vehicle-approach-cluster-20260804.png",
    prompt: `Create a Japanese crime-prevention awareness illustration about strangers approaching or following children from inside a vehicle.

Visual elements (abstract and cautionary, NOT depicting a real person):
- A quiet Japanese residential street at dusk, warm orange sky fading into blue
- A car stopped or crawling alongside the curb, with its driver-side window lowered — the interior kept dark and the driver rendered only as an indistinct shadow with no discernible face or identifying features
- A child walking or riding a bicycle on the far side of the sidewalk, body turned away from the car, moving in the opposite direction the car is facing
- A soft arrow-like flow or path motif showing the child's escape direction away from the vehicle, drawn as an abstract shape with no symbols
- Streetlights just turning on, long shadows, sense of the hours after dinner
- Emphasis on distance and separation between the child and the vehicle

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including on the license plate — leave the plate blank.
STRICT RULE: Do not depict a recognizable face for the driver, and do not depict any physical contact.

Style: Japanese editorial crime-prevention illustration, alert but not frightening
Color palette: Orange and amber warning tones against deepening evening blue
Mood: Watchful and instructive, teaching distance and escape rather than fear
${QUALITY_SUFFIX}`,
    description: "奈良県 8月の不審者情報3件がすべて車両関係（2026年8月7日号）"
  },
  {
    slug: "osaka-kodomo110ban-month-20260801",
    filename: "osaka-kodomo110ban-month-20260801.png",
    prompt: `Create a warm Japanese community illustration about neighborhood safe-haven houses where children can run for help.

Visual elements (positive, reassuring, community-centered):
- A friendly Japanese residential street on a bright summer day
- A house and a small neighborhood shop, each displaying a simple rectangular sign board and a small flag near the entrance — both sign and flag left COMPLETELY BLANK with a plain yellow field and no markings
- A child in summer clothes running toward the house entrance, and a welcoming adult figure standing in the doorway with an open, calm posture
- A second child and a parent a little further down the street, pointing toward the sign as if learning where it is — the act of confirming the location together
- A delivery-style work van parked nearby with a blank sticker panel on its side, suggesting mobile helpers
- Summer cues: cicada-green trees, bright sky, sunflowers by a fence
- Overall sense of a neighborhood that has agreed to look after its children

STRICT RULE: No text, no letters, no kanji, no numbers of any kind anywhere in the image, including on the flag, sign board, shop front, or vehicle sticker — all must be blank.

Style: Warm Japanese community editorial illustration, picture-book warmth
Color palette: Fresh greens and sunny yellows with soft warm neutrals
Mood: Safe, welcoming, quietly confident — help is nearby and the child knows where it is
${QUALITY_SUFFIX}`,
    description: "大阪府 8月は「こども110番月間」（2026年8月7日号）"
  }
]

async function generateImage(config: NewsImageConfig): Promise<void> {
  const outputDir = path.join(process.cwd(), "public", "images", "school-route-news", "thumbnails")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, config.filename)

  // 公開済みサムネイルの意図しない再生成（上書き）を防ぐ。
  // 作り直したい場合は該当ファイルを削除してから実行する
  if (fs.existsSync(outputPath)) {
    console.log(`Skip (exists): ${config.filename}`)
    return
  }

  console.log(`Generating: ${config.filename}`)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

  const body = {
    contents: [
      {
        parts: [
          {
            text: config.prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const candidates = data.candidates
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates in response")
  }

  const parts = candidates[0].content?.parts
  if (!parts) {
    throw new Error("No parts in response")
  }

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, "base64")
      fs.writeFileSync(outputPath, buffer)
      console.log(`  Saved: ${outputPath}`)
      return
    }
  }

  throw new Error("No image data in response")
}

async function generateAllImages() {
  console.log("=== 通学路の安全ニュース 画像生成 ===\n")

  for (const config of NEWS_IMAGES) {
    try {
      await generateImage(config)
    } catch (error) {
      console.error(`  Error generating ${config.filename}:`, error)
    }
  }

  console.log("\n=== 完了 ===")
}

generateAllImages()
