// EP04〜20 を EP21〜30 と同じ作りで作り直すための区分の定義（2026-11-18 ユーザーの指示「4から20までもこの方で」）。
// 題材は今の回のまま。コードは警察庁 codebook_2023.xlsx の原本で確認した（道路線形・中央分離帯施設等・オートマチック車・祝日・信号機）。
// original は今の episodes.json の数字（数え直しで再現できるかの比較用。原稿には使わない）。
import { FOUR_WHEEL, isFourWheel } from './candidates.mjs';

const hourLabel = (r) => `${Number(r['発生日時_時'])}時台`;
// 時間帯（1時間ずつだと死亡10件未満の時間が並べられず、それより高い時間が黙って外れる → まとめる。レビューの指摘）
const BAND = (h) => (h <= 3 ? '深夜0〜3時' : h <= 6 ? '明け方4〜6時' : h <= 9 ? '朝7〜9時' : h <= 15 ? '昼10〜15時' : h <= 18 ? '夕方16〜18時' : '夜19〜23時');
const bandLabel = (r) => BAND(Number(r['発生日時_時']));
const isBicycle = (c) => c === '51' || c === '52';
const AGE = { '01': '0〜24歳', 25: '25〜34歳', 35: '35〜44歳', 45: '45〜54歳', 55: '55〜64歳', 65: '65〜74歳', 75: '75歳以上' };
const WEEKDAY = { 1: '日曜日', 2: '月曜日', 3: '火曜日', 4: '水曜日', 5: '木曜日', 6: '金曜日', 7: '土曜日' };
const AGE_BAND = { '01': '0〜24歳', 25: '25〜64歳', 35: '25〜64歳', 45: '25〜64歳', 55: '25〜64歳', 65: '65〜74歳', 75: '75歳以上' };
const SIGNAL = { 1: 'ふつうの信号', 8: 'ふつうの信号', 2: '押ボタン式', 3: '点滅信号', 4: '点滅信号', 7: '信号機なし' };
const CROSS_WIDTH = { 11: '狭い道×狭い道', 14: '中くらい×狭い道', 15: '中くらい×中くらい', 17: '大通り×狭い道', 18: '大通り×中くらい', 19: '大通り×大通り' };
const ALIGNMENT = {
  1: 'カーブ・上り坂', 4: 'カーブ・上り坂', 2: 'カーブ・下り坂', 5: 'カーブ・下り坂', 3: 'カーブ・平坦', 6: 'カーブ・平坦',
  7: '直線・上り坂', 8: '直線・下り坂', 9: '直線・平坦',
};
const MEDIAN = {
  1: '中央分離帯', 2: '中央線（高輝度標示）', 3: '中央線（チャッターバー等）', 6: '中央線（ポストコーン）',
  7: '中央線（ワイヤロープ）', 4: '中央線（ペイント）', 5: '中央分離なし',
};
const SURFACE = { 1: '舗装・乾燥', 2: '舗装・湿潤', 3: '舗装・凍結', 4: '舗装・積雪', 5: '非舗装' };
const SIDEWALK = { 1: 'ガードレール等の柵', 2: '縁石・ブロック', 3: '路側帯（白線）', 4: '区分なし' };
const HOLIDAY = { 1: '祝日当日', 2: '祝日の前日', 3: 'その他の日' };
const AT = { 1: 'AT車', 2: 'AT車以外（MT車など）' };
const ROAD_SHAPE = {
  '01': '交差点', 31: '交差点', '07': '交差点付近', 37: '交差点付近', 11: 'トンネル', 12: '橋', 13: 'カーブ・屈折', 14: 'その他の単路',
  21: '踏切', 22: '踏切', 23: '踏切',
};

function vehicleA(code) {
  if (['03', '05'].includes(code)) return '普通乗用車';
  if (code === '04') return '軽乗用車';
  if (code === '14') return '軽貨物車';
  if (['13', '17'].includes(code)) return '普通・準中型貨物車';
  if (code === '12') return '中型貨物車';
  if (code === '11') return '大型貨物車';
  if (['01', '02', '07'].includes(code)) return 'バス・大型乗用車';
  if (code === '31') return '大型バイク（751cc以上）';
  if (code === '32') return 'バイク（401〜750cc）';
  if (code === '33') return 'バイク（251〜400cc）';
  if (code === '34') return 'バイク（126〜250cc）';
  if (code === '35') return '原付二種（51〜125cc）';
  if (code === '36') return '原付';
  if (isBicycle(code)) return '自転車';
  return null;
}

export const CANDIDATES = [
  {
    id: 'D04', title: '歩行者×時刻', column: '発生時', subject: '人対車両', ref: '7時台',
    categorize: (r) => (r['事故類型'] === '01' ? hourLabel(r) : null),
    original: { ref: 0.63, w1: 13.45, w1Label: '深夜3時台' },
  },
  {
    // 1時間ずつだと 4時台（4.23%）・2時台（3.70%）が死亡10件未満で外れ、第1位の0時台より高いのに黙って消える → 時間帯にまとめる（レビューの指摘）
    id: 'D05', title: '自転車×時間帯（自転車が当事者のどちらか）', column: '発生時（時間帯）', subject: '自転車が当事者A・Bのどちらかの事故', ref: '朝7〜9時',
    categorize: (r) => (isBicycle(r['当事者種別（当事者A）']) || isBicycle(r['当事者種別（当事者B）']) ? bandLabel(r) : null),
    original: { ref: 0.16, w1: 4.48, w1Label: '早朝4時台' },
  },
  {
    id: 'D06', title: '曜日', column: '曜日', subject: '全事故', ref: '金曜日',
    categorize: (r) => WEEKDAY[r['曜日(発生年月日)']] ?? null,
    rules: { minTopRatio: 1 }, rulesNote: '第1位が2倍未満（題材はユーザーの指定。倍率を正直に言う）',
    original: { ref: 0.70, w1: 1.03, w1Label: '土曜日' },
  },
  {
    id: 'D07', title: '当事者Aの乗り物', column: '当事者種別（当事者A）', subject: '全事故', ref: '普通乗用車',
    categorize: (r) => vehicleA(r['当事者種別（当事者A）']),
    original: { ref: 0.50, w1: 10.53, w1Label: '大型バイク（751cc超）' },
  },
  {
    // 当事者Aを四輪に絞る（絞らないと75歳以上の単独事故の59%が自転車・レビューの指摘）。車同士＝四輪どうしの車両相互。
    // 第3位・第2位の柱に「単独事故」と出るので、問いは事故の形ではなく年代にする（参考は全年代の車同士＝答えの年代を出さない）
    id: 'D08', title: '車（四輪）の単独事故×運転者の年代（参考は全年代の車同士）', column: '事故類型×年齢（当事者A・四輪）', subject: '当事者Aが四輪の単独事故と、四輪どうしの事故', ref: '車同士（全年代）',
    categorize: (r) => {
      if (!isFourWheel(r['当事者種別（当事者A）'])) return null;
      if (r['事故類型'] === '21') return isFourWheel(r['当事者種別（当事者B）']) ? '車同士（全年代）' : null;
      if (r['事故類型'] !== '41') return null;
      const age = AGE_BAND[r['年齢（当事者A）']];
      return age ? `${age}・単独事故` : null;
    },
    original: { ref: 0.31, w1: 8.14, w1Label: '車両単独事故' },
  },
  {
    id: 'D09', title: '月', column: '発生月', subject: '全事故', ref: '6月',
    categorize: (r) => `${Number(r['発生日時_月'])}月`,
    rules: { minTopRatio: 1 }, rulesNote: '第1位が2倍未満（題材はユーザーの指定。倍率を正直に言う）',
    original: { ref: 0.71, w1: 0.97, w1Label: '8月' },
  },
  {
    // ふつうの信号＝3灯式の点灯（歩車分離式を含む）。点滅は3灯式・1灯式をまとめた
    id: 'D10', title: '信号機', column: '信号機', subject: '全事故（当事者の対面する信号機）', ref: 'ふつうの信号',
    rules: { maxP23: 1 }, rulesNote: '第3位（点滅信号）は参考とほぼ同じ（原稿で「ほぼ同じ」と言う）',
    categorize: (r) => SIGNAL[r['信号機']] ?? null,
    original: { ref: 0.65, w1: 1.43, w1Label: '押ボタン式信号' },
  },
  {
    id: 'D11', title: '交差点の道幅の組み合わせ', column: '車道幅員（交差点）', subject: '交差点の事故', ref: '狭い道×狭い道',
    defs: { big: '13m以上', mid: '5.5m以上13m未満', small: '5.5m未満' }, // codebook の車道幅員（交差点）: 小＝5.5m未満・中＝5.5m以上・大＝13.0m以上
    categorize: (r) => CROSS_WIDTH[r['車道幅員']] ?? null,
    original: { ref: 0.25, w1: 1.34, w1Label: '大通り × 中通り' },
  },
  {
    // 運転者（当事者Aが四輪）に絞る（絞らないと7時台に自転車・歩行者が入り倍率が大きく出る）。時間帯にまとめる（3時台などが死亡10件未満で外れるため）。
    // 参考はいちばん低い昼10〜15時（レビューの指摘）
    // 参考は昼間（7〜18時をまとめる）。昼10〜15時だけだと死亡18件でぶれやすく、いちばん低い値を選ぶぶん倍率が大きく出る（3回目のレビュー）
    id: 'D12', title: '24歳以下の車の運転者（当事者A・四輪）×時間帯', column: '発生時（時間帯）', subject: '当事者Aが0〜24歳で四輪の事故', ref: '昼間7〜18時',
    defs: { age: '24歳以下' }, // 年齢の区分は 0〜24歳（運転者なので実際は免許を取れる年齢から）
    categorize: (r) => {
      if (r['年齢（当事者A）'] !== '01' || !isFourWheel(r['当事者種別（当事者A）'])) return null;
      const h = Number(r['発生日時_時']);
      return h >= 7 && h <= 18 ? '昼間7〜18時' : BAND(h);
    },
    original: { ref: 0.13, w1: 3.66, w1Label: '深夜3時台' },
  },
  {
    id: 'D13', title: '道路線形（カーブ・坂）', column: '道路線形', subject: '全事故', ref: '直線・平坦',
    categorize: (r) => ALIGNMENT[r['道路線形']] ?? null,
    original: { ref: 0.74, w1: 4.67, w1Label: '下り坂＋カーブ' },
  },
  {
    id: 'D14', title: '中央分離帯施設等', column: '中央分離帯施設等', subject: '全事故', ref: '中央分離帯',
    categorize: (r) => MEDIAN[r['中央分離帯施設等']] ?? null,
    original: { ref: 0.59, w1: 2.50, w1Label: '分離帯（中分）高規格等' },
  },
  {
    // 参考は凍結（今の回の考え方「凍結より乾いた路面が危ない」）。非舗装（砂利道など）は316件と少なく別の話なので並べない（キャプションで触れる）
    id: 'D15', title: '路面状態（参考は凍結）', column: '路面状態', subject: '全事故（非舗装は並べない）', ref: '舗装・凍結', notRanked: ['非舗装'],
    categorize: (r) => SURFACE[r['路面状態']] ?? null,
    original: { ref: 0.45, w1: 6.33, w1Label: '非舗装（砂利等）' },
  },
  {
    id: 'D16', title: '歩道と車道の区分', column: '歩車道区分', subject: '全事故', ref: '縁石・ブロック',
    categorize: (r) => SIDEWALK[r['歩車道区分']] ?? null,
    rules: { minTopRatio: 1 }, rulesNote: '第1位が2倍未満（題材はユーザーの指定。倍率を正直に言う）',
    original: { ref: 0.72, w1: 1.15, w1Label: '防護柵（ガードレール等）' },
  },
  {
    // 祝日当日は1.2倍・p≈0.04、並べられる区分も2つだけ。大型連休（お盆1.5倍・p≈0.01）でも弱い → 保留してユーザーに聞く
    id: 'D17', title: '祝日', column: '祝日', subject: '全事故', ref: 'その他の日',
    categorize: (r) => HOLIDAY[r['祝日(発生年月日)']] ?? null,
    original: { ref: 0.84, w1: 1.03, w1Label: '祝日当日' },
  },
  {
    // AT とそれ以外だけだと並べる区分が1つ → 乗用車・貨物車に分ける（今の回の「MT車は4.2倍」は貨物車が中心だった）
    id: 'D18', title: 'AT車とそれ以外×車の種類（当事者A・四輪）', column: 'オートマチック車×当事者種別（当事者A）', subject: '当事者Aが四輪（乗用車・貨物車）の事故', ref: 'AT・乗用車',
    original: { ref: 0.68, w1: 2.88, w1Label: 'MT車（マニュアル）' },
    categorize: (r) => {
      const at = ({ 1: 'AT', 2: 'MT' })[r['オートマチック車（当事者A）']];
      const c = r['当事者種別（当事者A）'];
      if (!at || !isFourWheel(c)) return null;
      return `${at}・${['11', '12', '13', '14', '17'].includes(c) ? '貨物車' : '乗用車'}`;
    },
  },
  {
    // 運転者（当事者Aが四輪）に絞る（絞らないと0〜24歳に自転車・歩行者が入る・レビューの指摘）。第1位は1.9倍（2倍未満）なので正直に言う
    id: 'D19', title: '車の運転者（当事者A・四輪）の年齢', column: '年齢（当事者A・四輪）', subject: '当事者Aが四輪の事故', ref: '0〜24歳',
    defs: { young: '24歳以下' }, // 運転者なので 0〜24歳の区分は実際には免許を取れる年齢から
    rules: { minTopRatio: 1 }, rulesNote: '第1位が2倍未満（題材はユーザーの指定。倍率を正直に言う）',
    categorize: (r) => (isFourWheel(r['当事者種別（当事者A）']) ? AGE[r['年齢（当事者A）']] ?? null : null),
    original: { ref: 0.63, w1: 1.28, w1Label: '75歳以上' },
  },
  {
    // 踏切は第一種122件・第三種2件・第四種8件をまとめて132件。少ないので件数の条件を100件にする
    id: 'D20', title: '道路形状（踏切）', column: '道路形状', subject: '全事故', ref: '交差点',
    rules: { minWorstN: 100 }, rulesNote: '踏切は132件と少ない（件数の条件を100件に。死亡10件の条件は満たす）',
    categorize: (r) => ROAD_SHAPE[r['道路形状']] ?? null,
    original: { ref: 0.85, w1: 65.08, w1Label: '列車との衝突（踏切等）' },
  },
];
