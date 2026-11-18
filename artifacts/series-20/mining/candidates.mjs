// 〇倍ギャップの候補の定義。categorize(row) は区分名か null（対象外）を返す。
// コードは警察庁 codebook_2023.xlsx（原本）で確認した。衝突部位の図は「前が上」:
//   ①前 ②右側面 ③後ろ ④左側面 ⑤右前 ⑥右後ろ ⑦左後ろ ⑧左前（二輪は①〜④）。2桁の上の桁が1次衝突点。

const FOUR_WHEEL = new Set(['01', '02', '03', '04', '05', '07', '11', '12', '13', '14', '17']);
const isFourWheel = (code) => FOUR_WHEEL.has(code);

function vehicleGroup(code) {
  if (['03', '05'].includes(code)) return '普通乗用車';
  if (code === '04') return '軽乗用車';
  if (code === '14') return '軽トラック・軽バン';
  if (['13', '17'].includes(code)) return '普通・準中型トラック';
  if (['01', '02', '11', '12'].includes(code)) return '大型・中型車（トラック・バス）';
  if (['31', '32', '33', '34'].includes(code)) return 'バイク（126cc以上）';
  if (['35', '36'].includes(code)) return '原付・原付二種';
  if (['51', '52'].includes(code)) return '自転車';
  if (code === '61') return '歩行者';
  return null;
}

function vehicleGroupFine(code) {
  if (['03', '05'].includes(code)) return '普通乗用車';
  if (code === '04') return '軽乗用車';
  if (code === '14') return '軽トラック・軽バン';
  if (code === '13') return '普通トラック';
  if (code === '17') return '準中型トラック';
  if (code === '12') return '中型トラック';
  if (code === '11') return '大型トラック';
  if (['01', '02', '07'].includes(code)) return 'バス・大型の乗用車';
  if (['31', '32', '33', '34'].includes(code)) return 'バイク（126cc以上）';
  if (code === '35') return '原付二種';
  if (code === '36') return '原付';
  if (['51', '52'].includes(code)) return '自転車';
  if (code === '61') return '歩行者';
  return null;
}
const MOTOR = new Set([...FOUR_WHEEL, '31', '32', '33', '34', '35', '36']);
const isBicycle = (code) => code === '51' || code === '52';
// 自転車と車・バイクの事故なら [自転車の側, 相手の側] の 'A'/'B' を返す
function bicycleVsMotor(row) {
  if (row['事故類型'] !== '21') return null;
  const a = row['当事者種別（当事者A）'];
  const b = row['当事者種別（当事者B）'];
  if (isBicycle(a) && MOTOR.has(b)) return ['A', 'B'];
  if (isBicycle(b) && MOTOR.has(a)) return ['B', 'A'];
  return null;
}
// 自転車と四輪（「車」）の事故なら [自転車の側, 車の側]。原稿で「車とぶつかった」と言う候補はこちらで数える
function bicycleVsCar(row) {
  const side = bicycleVsMotor(row);
  return side && isFourWheel(row[`当事者種別（当事者${side[1]}）`]) ? side : null;
}
const AGE = { '01': '0〜24歳', 25: '25〜34歳', 35: '35〜44歳', 45: '45〜54歳', 55: '55〜64歳', 65: '65〜74歳', 75: '75歳以上' };

const SPEED = {
  '01': '20km/h以下', '02': '30km/h', '03': '40km/h', '04': '50km/h', '05': '60km/h',
  '06': '70km/h', '07': '80km/h', '08': '100km/h', '11': '120km/h', '10': '標識の指定なし',
};
// 車の側の制限速度（当事者Aが原付以上でなければ当事者B）。
function vehicleSpeed(row) {
  const a = row['速度規制（指定のみ）（当事者A）'];
  const b = row['速度規制（指定のみ）（当事者B）'];
  return SPEED[a !== '00' ? a : b] ?? null;
}

const DAY_NIGHT = (row) => (row['昼夜'].startsWith('1') ? '昼' : row['昼夜'].startsWith('2') ? '夜' : null);
const TERRAIN = { 1: '市街地（人口集中）', 2: '市街地（その他）', 3: '市街地の外' };
const WEATHER = { 1: '晴れ', 2: 'くもり', 3: '雨', 4: '霧', 5: '雪' };

function dayType(row) {
  if (row['祝日(発生年月日)'] === '1' || row['曜日(発生年月日)'] === '1') return '日曜・祝日';
  if (row['曜日(発生年月日)'] === '7') return '土曜';
  return '平日';
}
function hourBand(row) {
  const h = Number(row['発生日時_時']);
  if (h <= 3) return '深夜0〜3時';
  if (h <= 6) return '明け方4〜6時';
  if (h <= 9) return '朝7〜9時';
  if (h <= 15) return '昼10〜15時';
  if (h <= 18) return '夕方16〜18時';
  return '夜19〜23時';
}

const PART = { 1: '前', 2: '横', 4: '横', 3: '後ろ', 5: '斜め前', 8: '斜め前', 6: '斜め後ろ', 7: '斜め後ろ', 0: 'なし' };
function collisionPair(row) {
  if (row['事故類型'] !== '21') return null;
  if (!isFourWheel(row['当事者種別（当事者A）']) || !isFourWheel(row['当事者種別（当事者B）'])) return null;
  const a = PART[row['車両の衝突部位（当事者A）'][0]];
  const b = PART[row['車両の衝突部位（当事者B）'][0]];
  if (!a || !b) return null;
  const key = [a, b].sort().join('×');
  const names = {
    '前×前': '正面衝突（前と前）', '前×後ろ': '追突（前と後ろ）', '前×横': '横から突っ込む（前と横）',
    '前×斜め前': '斜めに正面（前と斜め前）', '前×斜め後ろ': '斜め後ろから（前と斜め後ろ）',
    '横×横': 'こすり合い（横と横）',
  };
  return names[key] ?? '（その他の組み合わせ）';
}

function routeType(row) {
  const u = Math.floor(Number(row['路線コード']) / 10);
  if (u >= 1 && u <= 999) return '国道';
  // コード表: 1000〜1499 主要地方道－都道府県道 / 1500〜1999 主要地方道－市道 / 2000〜2999 一般都道府県道 / 3000〜3999 一般市町村道
  if ((u >= 1000 && u <= 1499) || (u >= 2000 && u <= 2999)) return '都道府県道';
  if ((u >= 1500 && u <= 1999) || (u >= 3000 && u <= 3999)) return '市町村道';
  if (u >= 4000 && u <= 5999) return '高速道路・自動車専用道';
  if (u >= 7000 && u <= 8499) return '農道・林道';
  if (u >= 9000 && u <= 9499) return '私道';
  return '（その他の道路）';
}

const OVERLAP_EP01 = 'EP01（事故類型）と結論が重なる: 「物」「相手なし」は車両単独、「歩行者」は人対車両の言い換え';

export const CANDIDATES = [
  {
    id: 'C01', title: '車同士の事故、ぶつかる向き', column: '車両の衝突部位（A・B）', subject: '四輪どうしの車両相互事故',
    ref: '追突（前と後ろ）', notRanked: ['（その他の組み合わせ）'], categorize: collisionPair,
  },
  {
    id: 'C02', title: '歩行者がはねられた道の制限速度', column: '速度規制（指定のみ）', subject: '人対車両（車の側の規制）',
    ref: '30km/h', categorize: (r) => (r['事故類型'] === '01' ? vehicleSpeed(r) : null),
  },
  {
    id: 'C03', title: '道の制限速度（全事故）', column: '速度規制（指定のみ）', subject: '全事故（車の側の規制）',
    ref: '30km/h', categorize: vehicleSpeed,
    caution: '70・80km/h はバイパスや自動車専用道が中心と思われる（場所の違いを含む）。60km/h が 50km/h より低く、単純な「速いほど危ない」にはならない',
  },
  {
    id: 'C04', title: '市街地の外×昼夜', column: '地形×昼夜', subject: '全事故',
    ref: '市街地（人口集中）・昼', categorize: (r) => { const d = DAY_NIGHT(r); return d ? `${TERRAIN[r['地形']]}・${d}` : null; },
    caution: '昼夜は EP02 で使用済み。結論の中心が「市街地の外」になるなら新しい',
  },
  {
    id: 'C05', title: '市街地の外（地形だけ）', column: '地形', subject: '全事故',
    ref: '市街地（人口集中）', categorize: (r) => TERRAIN[r['地形']] ?? null,
  },
  {
    id: 'C06', title: '歩行者×地形', column: '地形', subject: '人対車両',
    ref: '市街地（人口集中）', categorize: (r) => (r['事故類型'] === '01' ? TERRAIN[r['地形']] ?? null : null),
  },
  {
    id: 'C07', title: '曜日×時間帯', column: '曜日・祝日×発生時', subject: '全事故',
    ref: '平日・朝7〜9時', categorize: (r) => `${dayType(r)}・${hourBand(r)}`,
    caution: '曜日（EP06）・祝日（EP17）・時刻（EP04/05/12）・昼夜（EP02）と近い。上位が曜日に関係なく「深夜」なら新しくない',
  },
  {
    id: 'C08', title: '天気×昼夜', column: '天候×昼夜', subject: '全事故',
    ref: '晴れ・昼', categorize: (r) => { const d = DAY_NIGHT(r); return d ? `${WEATHER[r['天候']]}・${d}` : null; },
    caution: '昼夜は EP02 で使用済み',
  },
  {
    id: 'C09', title: '天気だけ', column: '天候', subject: '全事故',
    ref: '晴れ', categorize: (r) => WEATHER[r['天候']] ?? null,
  },
  {
    id: 'C10', title: '歩行者をはねた車の種類', column: '当事者種別（車の側）', subject: '人対車両',
    ref: '普通乗用車',
    categorize: (r) => {
      if (r['事故類型'] !== '01') return null;
      const a = r['当事者種別（当事者A）'];
      const g = vehicleGroupFine(a === '61' ? r['当事者種別（当事者B）'] : a);
      return g && g !== '歩行者' ? g : null;
    },
    caution: '当事者Aの車種は EP07 で使用済み。対象を歩行者に絞った結論として新しいかを確認',
  },
  {
    id: 'C11', title: '自転車がぶつかった相手の車の種類', column: '当事者種別（相手）', subject: '自転車と車・バイクの事故',
    ref: '普通乗用車',
    categorize: (r) => {
      const side = bicycleVsMotor(r);
      return side ? vehicleGroupFine(r[`当事者種別（当事者${side[1]}）`]) : null;
    },
    caution: '当事者Aの車種は EP07 で使用済み。対象を自転車に絞った結論として新しいかを確認',
  },
  {
    id: 'C12', title: 'バイクがぶつかった相手の車の種類', column: '当事者種別（相手）', subject: 'バイク（126cc以上）と四輪の事故',
    ref: '普通乗用車',
    categorize: (r) => {
      if (r['事故類型'] !== '21') return null;
      const a = r['当事者種別（当事者A）'];
      const b = r['当事者種別（当事者B）'];
      const bike = (c) => ['31', '32', '33', '34'].includes(c);
      if (bike(a) && isFourWheel(b)) return vehicleGroupFine(b);
      if (bike(b) && isFourWheel(a)) return vehicleGroupFine(a);
      return null;
    },
    caution: '当事者Aの車種は EP07 で使用済み',
  },
  {
    id: 'C13', title: 'ぶつかった相手（当事者B）', column: '当事者種別（当事者B）', subject: '全事故',
    ref: '普通乗用車',
    categorize: (r) => {
      const b = r['当事者種別（当事者B）'];
      if (b === '75') return '物（電柱・壁など）';
      if (b === '76') return '相手なし（転倒・転落）';
      return vehicleGroup(b);
    },
    reject: OVERLAP_EP01,
  },
  {
    id: 'C14', title: '道路の種類', column: '路線コード（上4桁）', subject: '全事故',
    ref: '市町村道', notRanked: ['（その他の道路）'], categorize: routeType,
  },
  {
    id: 'C15', title: 'ゾーン30', column: 'ゾーン規制', subject: '全事故',
    ref: 'ゾーン30', categorize: (r) => ({ '01': 'ゾーン30', 70: '規制なし' })[r['ゾーン規制']] ?? null,
  },
  {
    id: 'C16', title: '交差点の一時停止（当事者Aの進入路）', column: '一時停止規制_標識（当事者A）', subject: '交差点内の事故',
    ref: '一時停止あり',
    categorize: (r) => {
      const s = r['一時停止規制_標識（当事者A）'];
      if (s === '00') return null;
      return s === '09' ? '一時停止なし' : '一時停止あり';
    },
  },
  {
    id: 'C17', title: 'エアバッグの作動（当事者A）', column: 'エアバッグの装備（当事者A）', subject: '当事者Aが四輪の事故',
    ref: 'その他（作動なし・装備なし・不明）',
    categorize: (r) => ({ 1: '装備あり・作動', 2: 'その他（作動なし・装備なし・不明）' })[r['エアバッグの装備（当事者A）']] ?? null,
    reject: '作動は衝撃が大きかった結果（原因と結果が逆）。「開くと死ぬ」と誤解される',
  },
  {
    id: 'C18', title: 'サポカー（当事者A）', column: 'サポカー（当事者A）', subject: '当事者Aが原付以上の事故',
    ref: 'その他の車', categorize: (r) => ({ '01': 'サポカー', 11: 'その他の車' })[r['サポカー（当事者A）']] ?? null,
    reject: 'サポカーの方が高く出るが、乗る人の年齢など別の違いを含む。「サポカーは危ない」と誤解される',
  },
  {
    id: 'C19', title: '車の用途（当事者A）', column: '用途別（当事者A）', subject: '当事者Aが車・バイクの事故',
    ref: '自家用', categorize: (r) => ({ '01': '事業用（運送・タクシー・バス）', 31: '自家用' })[r['用途別（当事者A）']] ?? null,
  },
  {
    id: 'C20', title: '最初にぶつかった場所', column: '衝突地点', subject: '全事故',
    ref: '交差点内', categorize: (r) => ({ '01': '単路（交差点付近を含む）', 30: '交差点内', 20: 'その他（分離帯・路外へ・転落）' })[r['衝突地点']] ?? null,
  },
  {
    id: 'C21', title: '単路の車道の幅', column: '車道幅員（単路）', subject: '単路の事故',
    ref: '9.0m以上',
    categorize: (r) => ({ '01': '3.5m未満', '02': '3.5m以上', '03': '5.5m以上', '04': '9.0m以上', '05': '13.0m以上', '06': '19.5m以上' })[r['車道幅員']] ?? null,
    caution: '交差点の幅員は EP11 で使用済み',
  },
  {
    id: 'C22', title: '車にはねられた歩行者の年齢', column: '年齢（歩行者の側）', subject: '人対車両（相手が四輪）',
    ref: '0〜24歳',
    categorize: (r) => {
      if (r['事故類型'] !== '01') return null;
      const a = r['当事者種別（当事者A）'];
      const b = r['当事者種別（当事者B）'];
      // 「車にはねられた」と言うので、相手が四輪の事故だけ（自転車・バイク・相手不明は数えない）
      const side = a === '61' && isFourWheel(b) ? 'A' : b === '61' && isFourWheel(a) ? 'B' : null;
      return side ? AGE[r[`年齢（当事者${side}）`]] ?? null : null;
    },
    caution: '年齢は EP08・EP19 で使用済み（どちらも運転する側）。歩行者の側の年齢は新しい。0〜24歳に子どもを含むが「子ども」とは言えない',
  },
  {
    id: 'C23', title: '車とぶつかった自転車の人の年齢', column: '年齢（自転車の側）', subject: '自転車と四輪の事故',
    ref: '0〜24歳',
    categorize: (r) => {
      const side = bicycleVsCar(r);
      return side ? AGE[r[`年齢（当事者${side[0]}）`]] ?? null : null;
    },
    caution: '年齢は EP08・EP19 で使用済み（運転する側）。0〜24歳に子どもを含むが「子ども」とは言えない',
  },
  {
    id: 'C24', title: '自転車がはねられた道の制限速度', column: '速度規制（指定のみ）', subject: '自転車と四輪の事故（車の側の規制）',
    ref: '30km/h', categorize: (r) => (bicycleVsCar(r) ? vehicleSpeed(r) : null),
    caution: '60km/h の道は 50km/h・40km/h より低いが死亡10件未満で並ばない。「速い道ほど危ない」とは言えない',
  },
  {
    id: 'C25', title: '歩行者×市街地の外×昼夜', column: '地形×昼夜', subject: '人対車両',
    ref: '市街地（人口集中）・昼',
    categorize: (r) => { if (r['事故類型'] !== '01') return null; const d = DAY_NIGHT(r); return d ? `${TERRAIN[r['地形']]}・${d}` : null; },
    caution: '歩行者×時刻は EP04 で使用済み',
  },
  {
    id: 'C26', title: '歩行者×道路の種類', column: '路線コード（上4桁）', subject: '人対車両',
    ref: '市町村道', notRanked: ['（その他の道路）'], categorize: (r) => (r['事故類型'] === '01' ? routeType(r) : null),
  },
  {
    id: 'C27', title: '歩行者×天気×昼夜', column: '天候×昼夜', subject: '人対車両',
    ref: '晴れ・昼',
    categorize: (r) => { if (r['事故類型'] !== '01') return null; const d = DAY_NIGHT(r); return d ? `${WEATHER[r['天候']]}・${d}` : null; },
    caution: '歩行者×時刻は EP04 で使用済み',
  },
  {
    id: 'C28', title: '四輪どうしの車の組み合わせ', column: '当事者種別（A・B）', subject: '四輪どうしの車両相互事故',
    ref: '普通乗用車×普通乗用車',
    categorize: (r) => {
      if (r['事故類型'] !== '21') return null;
      const a = r['当事者種別（当事者A）'];
      const b = r['当事者種別（当事者B）'];
      if (!isFourWheel(a) || !isFourWheel(b)) return null;
      const short = (c) => ({ 普通乗用車: '普通乗用車', 軽乗用車: '軽乗用車', '軽トラック・軽バン': '軽トラ', 普通トラック: 'トラック', 準中型トラック: 'トラック', 中型トラック: '大型・中型車', 大型トラック: '大型・中型車', 'バス・大型の乗用車': '大型・中型車' })[vehicleGroupFine(c)];
      const order = ['普通乗用車', '軽乗用車', '軽トラ', 'トラック', '大型・中型車'];
      return [short(a), short(b)].sort((x, y) => order.indexOf(x) - order.indexOf(y)).join('×');
    },
    caution: '当事者Aの車種は EP07 で使用済み。組み合わせ（大きさの差）として新しいかを確認',
  },
  {
    id: 'C29', title: 'バイクと車の事故、ぶつかる向き', column: '車両の衝突部位（A・B）', subject: 'バイク・原付と四輪の事故',
    ref: 'バイクが車に追突（バイクの前×車の後ろ）', notRanked: ['（その他の組み合わせ）'],
    categorize: bikeCarDirection,
    caution: '「前どうし」の7割は交差点内の衝突（右折車とのぶつかりを含むと思われる）。警察庁の「正面衝突」とは呼べない。第1位と第2・3位の差ははっきりしない',
  },
  {
    // 衝突地点: 01 単路（交差点付近を含む）/ 30 交差点内 / 20 その他。「交差点の中を除く」なので 30 だけを外す
    id: 'C30', title: 'バイクと車の事故、ぶつかる向き（交差点の中を除く）', column: '車両の衝突部位（A・B）×衝突地点', subject: 'バイク・原付と四輪の事故（衝突地点が交差点内でない）',
    ref: 'バイクが車に追突（バイクの前×車の後ろ）', notRanked: ['（その他の組み合わせ）'],
    categorize: (r) => (r['衝突地点'] !== '30' ? bikeCarDirection(r) : null),
  },
  {
    id: 'C31', title: '車同士の事故、ぶつかる向き（交差点の中を除く）', column: '車両の衝突部位（A・B）×衝突地点', subject: '四輪どうしの車両相互事故（衝突地点が交差点内でない）',
    ref: '追突（前と後ろ）', notRanked: ['（その他の組み合わせ）'],
    categorize: (r) => (r['衝突地点'] !== '30' ? collisionPair(r) : null),
  },
];

/** バイク・原付と四輪の事故を、両方の1次衝突点の組み合わせで分ける。 */
function bikeCarDirection(r) {
  if (r['事故類型'] !== '21') return null;
  const twoWheel = (c) => ['31', '32', '33', '34', '35', '36'].includes(c);
  const a = r['当事者種別（当事者A）'];
  const b = r['当事者種別（当事者B）'];
  let bikePart; let carPart;
  if (twoWheel(a) && isFourWheel(b)) { bikePart = r['車両の衝突部位（当事者A）'][0]; carPart = r['車両の衝突部位（当事者B）'][0]; }
  else if (twoWheel(b) && isFourWheel(a)) { bikePart = r['車両の衝突部位（当事者B）'][0]; carPart = r['車両の衝突部位（当事者A）'][0]; }
  else return null;
  const bp = { 1: '前', 2: '横', 4: '横', 3: '後ろ' }[bikePart];
  const cp = PART[carPart];
  const names = {
    '前|前': '前どうし（バイクの前×車の前）', '前|横': 'バイクが車の横に突っ込む', '前|斜め前': 'バイクが車の斜め前に突っ込む',
    '前|後ろ': 'バイクが車に追突（バイクの前×車の後ろ）', '横|前': '車がバイクの横に突っ込む', '後ろ|前': '車がバイクに追突',
  };
  return names[`${bp}|${cp}`] ?? '（その他の組み合わせ）';
}
