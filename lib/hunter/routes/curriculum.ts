/** Shared, deterministic lesson definitions. The server must evaluate submitted choice IDs. */
export type RouteScenario = 'normal' | 'rain' | 'evening' | 'earthquake'
export type RouteHazardCategory = 'traffic' | 'fall' | 'water' | 'construction' | 'darkness' | 'personal-safety' | 'rain' | 'earthquake'
export type RouteQuestionKind = 'prediction' | 'reason' | 'action'
export type RouteAnswer = { hazardId: string; prediction: string; reason: string; action: string }
export type RouteAttempt = { scenario: RouteScenario; answers: RouteAnswer[]; foundIds: string[]; mistakes?: RouteAnswer[]; reviewedNoteIds?: string[] }
export type RouteChoice = { id: string; text: string }
export type RouteQuestion = { prompt: string; choices: readonly RouteChoice[]; correctId: string }
export type RouteHazard = {
  id: string
  category: RouteHazardCategory
  title: string
  situation: string
  advanced: string
  focus: string
  provenance: 'imagined'
  outcome: string
  questions: Record<RouteQuestionKind, RouteQuestion>
  sources: readonly { title: string; url: string }[]
}

export const ROUTE_SCENARIOS: readonly { id: RouteScenario; label: string; description: string }[] = [
  { id: 'normal', label: 'いつもの道', description: 'いつもの通学路で、もしもの危険を考えよう。' },
  { id: 'rain', label: '雨の日', description: '雨で見え方や足もとが変わったら？' },
  { id: 'evening', label: '夕方の道', description: '暗くなると見えにくいものは何だろう？' },
  { id: 'earthquake', label: '地震が起きたら', description: '道を歩いているときに、地面がゆれたら？' },
]

const trafficSources = [{ title: '警察庁：こどもの交通事故防止対策', url: 'https://www.npa.go.jp/bureau/traffic/0-1.pdf' }]
const routeSources = [{ title: '奈良県：通学路等安全対策推進の手引き', url: 'https://www.pref.nara.lg.jp/documents/14448/tebiki.pdf' }]
const rainSources = [{ title: '気象庁：大雨について学ぶ資料', url: 'https://www.data.jma.go.jp/kumagaya/shosai/chishiki/ooame-kaisetsu.pdf' }]

// The first choice is not consistently the correct choice. IDs remain stable across grade variants.
function question(prompt: string, prefix: string, correct: string, wrong: string, advancedWrong: string, correctIndex: number): RouteQuestion {
  const good = { id: `${prefix}-safe`, text: correct }
  const bad = { id: `${prefix}-risk`, text: wrong }
  return {
    prompt,
    choices: correctIndex === 0 ? [good, bad, { id: `${prefix}-assume`, text: advancedWrong }] : [bad, good, { id: `${prefix}-assume`, text: advancedWrong }],
    correctId: good.id,
  }
}

export const HAZARD_CURRICULUM: readonly RouteHazard[] = [
  {
    id: 'hidden-traffic', category: 'traffic', title: '曲がり角の向こう', provenance: 'imagined',
    situation: 'もし、曲がり角のそばに車が止まっていて、その向こうが見えなかったら？',
    advanced: '車の後ろから自転車が来て、反対側からも車が近づく場面を考えよう。片方だけを見てよいかな？',
    focus: '車やかべで見えないところ',
    outcome: '止まってよく見ると、かげから来た自転車に気づけたよ。左右と前を確認し、安全を確かめてから進もう。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'traffic-p', 'かげから車や自転車が出てくる', '何も見えないから、何も来ない', '音がしないので自転車は来ない', 1),
      reason: question('どうして気をつけるの？', 'traffic-r', '自分も相手も、かげの向こうが見えにくいから', '道がいつもと同じだから', '車だけ見れば十分だから', 0),
      action: question('どう行動する？', 'traffic-a', '手前で止まり、見える位置で左右と前をよく確かめる', 'すぐに走って曲がり角を通る', '友だちが進んだらそのままついていく', 1),
    }, sources: trafficSources,
  },
  {
    id: 'open-edge', category: 'fall', title: '道のはしの段差', provenance: 'imagined',
    situation: 'もし、道のはしに、さくのない高い段差があったら？',
    advanced: '段差に近い道で、前から自転車も来るとしたら、よける場所を先に考えよう。',
    focus: '足もとと、道のはし',
    outcome: 'はしからはなれて止まれたね。すれちがう場所も、安全か確かめてから選ぼう。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'fall-p', '足をふみ外して落ちる', 'はしを歩くほど安全になる', '少しの段差なら必ずけがをしない', 0),
      reason: question('どうして気をつけるの？', 'fall-r', 'つまずいたり、よけたりすると、はしに近づくから', '高いところは見晴らしがよいから', '慣れた道なら足もとは見なくてよいから', 1),
      action: question('どう行動する？', 'fall-a', 'はしからはなれ、安全な広さのある場所で待つ', 'はしに立って下をのぞく', '相手を見ずに急によける', 0),
    }, sources: routeSources,
  },
  {
    id: 'open-water', category: 'water', title: '水路のそば', provenance: 'imagined',
    situation: 'もし、道のそばの水路に、持ちものが落ちてしまったら？',
    advanced: '晴れていても、遠くで雨が降ると水が増えることがあるよ。今の見た目だけで判断してよいかな？',
    focus: '水路や川との距離',
    outcome: '自分で取りに行かず、大人に知らせられたね。物よりも、自分の体を守ることが大切だよ。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'water-p', '近づくとすべって、水に落ちる', '浅く見えれば、水には落ちない', '水の色だけで深さがわかる', 1),
      reason: question('どうして気をつけるの？', 'water-r', '水の深さや流れ、足もとのすべりやすさがわからないから', '持ちものがぬれるからだけ', '晴れた日は水が必ず少ないから', 0),
      action: question('どう行動する？', 'water-a', '水からはなれて、大人に知らせる', '友だちと手をつないで水路に入る', 'かばんを先に取りに行く', 1),
    }, sources: rainSources,
  },
  {
    id: 'road-work', category: 'construction', title: '工事中の道', provenance: 'imagined',
    situation: 'もし、いつもの歩道が工事中で、さくと案内があったら？',
    advanced: '工事の車が動き、歩く場所もせまくなっている場面。案内と車の動きの両方を確認しよう。',
    focus: 'さく・案内・動く車',
    outcome: 'さくの外で止まり、安全な通り方を確認できたね。通れないときは、大人に相談しよう。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'work-p', '工事の車が動いたり、足もとに穴があったりする', 'さくの中は近道なので歩ける', '作業員が必ず自分を見てくれている', 0),
      reason: question('どうして気をつけるの？', 'work-r', 'いつもと歩く場所や見え方が変わっているから', '工事の音が大きいからだけ', '車が一度止まったら動かないから', 1),
      action: question('どう行動する？', 'work-a', 'さくの中に入らず、案内を確かめ、困ったら大人に相談する', 'さくのすきまを通りぬける', '車道へ急に出て工事をよける', 0),
    }, sources: routeSources,
  },
  {
    id: 'unwanted-invitation', category: 'personal-safety', title: 'ついてきてと言われたら', provenance: 'imagined',
    situation: 'もし、道で会った人から「一緒に来て」と言われ、不安になったら？',
    advanced: '相手の服や見た目だけで判断しないでね。断ってもついてくるなど、行動と周りの状況を考えよう。',
    focus: '相手との距離と、助けを求められる場所',
    outcome: 'ついていかず、人のいる場所で助けを求められたね。怖いときは大きな声や防犯ブザーで知らせてよいんだよ。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'invite-p', '人の少ない場所に連れていかれるかもしれない', 'やさしい声なら必ず安全', '知っている名前を言う人なら必ず安全', 1),
      reason: question('どうして気をつけるの？', 'invite-r', '声や見た目だけでは、安全かどうかわからないから', '知らない人は全員悪い人だから', '大人のお願いは必ず聞くものだから', 0),
      action: question('どう行動する？', 'invite-a', 'ついていかず距離をとり、人のいる場所で助けを求める', '断れないのでついていく', '一人で相手を追いかけて調べる', 1),
    }, sources: [{ title: '警視庁：子供の安全', url: 'https://www.keishicho.metro.tokyo.lg.jp/kurashi/higai/kodomo/index.html' }],
  },
  {
    id: 'evening-visibility', category: 'darkness', title: '夕方の見えにくさ', provenance: 'imagined',
    situation: 'もし、帰り道が暗くなって、車の運転手から自分が見えにくかったら？',
    advanced: '車のライトが見えても、運転手が自分に気づいているとは限らないね。交差点では何を確かめよう？',
    focus: '明るい道と、相手からの見え方',
    outcome: '明るく人のいる道を選び、車が止まったことも確認できたね。反射するものも、気づいてもらう助けになるよ。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'dark-p', '運転手が自分に気づくのが遅れる', '自分に車が見えれば、相手にも必ず見える', 'ライトのある車は必ず止まる', 0),
      reason: question('どうして気をつけるの？', 'dark-r', '暗いと人や足もとを見つけにくいから', '夜は車が一台も走らないから', '反射するものがあれば確認は不要だから', 1),
      action: question('どう行動する？', 'dark-a', '明るい道を選び、横断するときは車と周りの安全を確かめる', '近道の暗い道を一人で走る', '手を上げたらすぐに道路へ出る', 0),
    }, sources: trafficSources,
  },
  {
    id: 'flooded-road', category: 'rain', title: '雨で水がたまった道', provenance: 'imagined',
    situation: 'もし、強い雨で、前の道が水につかっていたら？',
    advanced: '水の下に側溝や、ふたの外れたマンホールがあっても見えないよ。水路の増水も合わせて考えよう。',
    focus: '水につかった道と、水路',
    outcome: '水につかった道へ入らず、安全な場所で大人に相談できたね。川や水路の様子を見に行く必要はないよ。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'rain-p', '水の下の穴に落ちたり、流されたりする', 'いつもの道なら水があっても同じように歩ける', '長ぐつなら深い水も安全に歩ける', 1),
      reason: question('どうして気をつけるの？', 'rain-r', '水の下や流れの強さが見えず、急に水が増えることもあるから', 'くつがぬれるからだけ', '友だちが歩けたら自分も必ず歩けるから', 0),
      action: question('どう行動する？', 'rain-a', '水へ入らず、安全な場所から大人に相談する', '深さを調べるために水へ入る', '川の様子を確かめに行く', 1),
    }, sources: rainSources,
  },
  {
    id: 'shaking-street', category: 'earthquake', title: '道で地震が起きたら', provenance: 'imagined',
    situation: 'もし、歩いているときに地面がゆれ、そばにブロックのかべや看板があったら？',
    advanced: '倒れそうなかべと、上から落ちる物の両方に注意しよう。車道へ飛び出さず身を守れる場所を考えよう。',
    focus: 'かべ・頭の上・車道',
    outcome: '頭を守り、かべや落ちてくる物からはなれられたね。ゆれが収まった後も周りを確かめ、大人の案内を聞こう。',
    questions: {
      prediction: question('次に何が起こるかもしれない？', 'quake-p', 'かべが倒れたり、看板やガラスが落ちたりする', '外ならどこにいても安全', 'かべにつかまれば必ず安全', 0),
      reason: question('どうして気をつけるの？', 'quake-r', 'ゆれで物が倒れたり、上から落ちてきたりするから', '道に車がいなくなるから', 'かべのそばなら上の物は落ちないから', 1),
      action: question('どう行動する？', 'quake-a', '頭を守り、車道に飛び出さず、かべや落ちる物からはなれる', 'かべによりかかって待つ', '周りを見ずに走って家へ帰る', 0),
    }, sources: [{ title: '気象庁：緊急地震速報を見聞きしたときは', url: 'https://www.jma.go.jp/jma/kishou/know/jishin/eew/koudou/koudou.html' }],
  },
]

const SCENARIO_CATEGORIES: Record<RouteScenario, readonly RouteHazardCategory[]> = {
  normal: ['traffic', 'fall', 'water', 'construction', 'personal-safety'],
  rain: ['traffic', 'water', 'rain'],
  evening: ['traffic', 'darkness', 'personal-safety'],
  earthquake: ['fall', 'earthquake'],
}

export function getScenarioCurriculum(scenario: RouteScenario, schoolYear: number): RouteHazard[] {
  const categories = SCENARIO_CATEGORIES[scenario]
  if (!categories) return []
  const young = schoolYear <= 3
  return HAZARD_CURRICULUM.filter(hazard => categories.includes(hazard.category)).map(hazard => ({
    ...hazard,
    situation: young ? hazard.situation : `${hazard.situation} ${hazard.advanced}`,
    questions: {
      prediction: { ...hazard.questions.prediction, choices: young ? hazard.questions.prediction.choices.slice(0, 2) : [...hazard.questions.prediction.choices] },
      reason: { ...hazard.questions.reason, choices: young ? hazard.questions.reason.choices.slice(0, 2) : [...hazard.questions.reason.choices] },
      action: { ...hazard.questions.action, choices: young ? hazard.questions.action.choices.slice(0, 2) : [...hazard.questions.action.choices] },
    },
  }))
}

export function evaluateRouteAttempt(attempt: RouteAttempt, normalCleared = false): { cleared: boolean; correct: number; total: number; invalid: boolean } {
  const scenario = attempt?.scenario
  if (!Object.hasOwn(SCENARIO_CATEGORIES, scenario)) return { cleared: false, correct: 0, total: 0, invalid: true }
  const lessons = getScenarioCurriculum(scenario, 9)
  const fail = { cleared: false, correct: 0, total: lessons.length, invalid: true }
  if (scenario !== 'normal' && !normalCleared) return fail
  if (!Array.isArray(attempt.answers) || !Array.isArray(attempt.foundIds)) return fail
  const allowed = new Set(lessons.map(lesson => lesson.id))
  if (attempt.answers.length > lessons.length || attempt.foundIds.length > lessons.length) return fail
  const found = new Set(attempt.foundIds)
  const answerIds = new Set(attempt.answers.map(answer => answer?.hazardId))
  if (found.size !== attempt.foundIds.length || answerIds.size !== attempt.answers.length) return fail
  if ([...found, ...answerIds].some(id => !allowed.has(id))) return fail
  const correct = lessons.filter(lesson => {
    const answer = attempt.answers.find(item => item?.hazardId === lesson.id)
    return found.has(lesson.id) && answer && (['prediction', 'reason', 'action'] as const).every(kind => answer[kind] === lesson.questions[kind].correctId)
  }).length
  return { cleared: correct === lessons.length, correct, total: lessons.length, invalid: false }
}

/** Preserve categories that needed help even when the final answers are correct.
 * Only actual wrong choices count; unanswered questions are not weaknesses. */
export function getMissedRouteCategories(scenario: RouteScenario, attempts: readonly RouteAnswer[]): RouteHazardCategory[] {
  const lessons = getScenarioCurriculum(scenario, 9)
  return lessons.filter(lesson => attempts.some(answer => answer.hazardId === lesson.id && (['prediction', 'reason', 'action'] as const).some(kind => {
    const value = answer[kind]
    return value && lesson.questions[kind].choices.some(choice => choice.id === value) && value !== lesson.questions[kind].correctId
  }))).map(lesson => lesson.category).filter((kind, index, all) => all.indexOf(kind) === index)
}
