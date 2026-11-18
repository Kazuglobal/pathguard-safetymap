// 回のまとまり（--set）を本票 CSV から数え直して episodes.json と scripts_and_captions.md に書く。
// 使い方: node build_ep21-30.mjs <honhyo_2023_to-degree.csv> [--set ep21-30|ep04-20] [--dry-run]
//   ep21-30（既定）: EP21〜30 を末尾に追記・置き換え / ep04-20: EP04〜20 を置き換え（2026-11-18「4から20までもこの方で」）
// 数字はすべて集計結果から差し込む。原稿に手書きの数字があれば止まる。まとまりの外の回は1バイトも変えない。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { aggregate, assertDefinition, evaluate } from './gaps-lib.mjs';
import { UNSPEAKABLE, sayOf } from './speech.mjs';
import { focusRatio } from '../threejs/timeline.mjs';

const YEAR = 2023;
const NARRATION_CHARS = [145, 165];
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SETS = {
  'ep21-30': { content: './ep21-30_content.mjs', candidates: './candidates.mjs', first: 21, last: 30 },
  'ep04-20': { content: './ep04-20_content.mjs', candidates: './candidates_ep04-20.mjs', first: 4, last: 20 },
};
const pad = (n) => String(n).padStart(2, '0');

const args = process.argv.slice(2);
const setIdx = args.indexOf('--set');
const setName = setIdx >= 0 ? args.splice(setIdx, 2)[1] : 'ep21-30';
const SET = SETS[setName];
const csvPath = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!csvPath || !SET) {
  console.error('usage: node build_ep21-30.mjs <honhyo_2023_to-degree.csv> [--set ep21-30|ep04-20] [--dry-run]');
  process.exit(2);
}
const { CANDIDATES } = await import(SET.candidates);
const { EPISODES } = await import(SET.content);
const SET_IDS = Array.from({ length: SET.last - SET.first + 1 }, (_, i) => pad(SET.first + i));
const PATHS = {
  episodes: here('../episodes.json'),
  md: here('../scripts_and_captions.md'),
  facts: here(`./${setName}_facts.json`),
};

// ---- 数字の書き方（Three.js 版 scene.js の rateDigits / formatRatio と同じ規則） ----
const fmtRate = (rate) => rate.toFixed(rate < 0.1 ? 3 : 2);
const fmtRatio = (x) => {
  if (x >= 100) return String(Math.floor(x));
  const v = Math.floor(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const RATE_DECIMALS = 6; // 画面は JSON の rate どうしで倍率を割り算するので、丸めで倍率がずれない桁数で入れる
const digitsOf = (s) => (s.match(/[0-9０-９]+/g) ?? []).join(',');

// labels の値は表示名の文字列か { label, say }。say を省くと表示名から作る（speech.mjs の sayOf）
const shownOf = (entry, raw) => (entry == null ? raw : typeof entry === 'string' ? entry : entry.label);

function factsFor(content, result) {
  const pack = (row) => {
    const entry = content.labels[row.label];
    const label = shownOf(entry, row.label);
    const say = typeof entry === 'object' && entry.say ? entry.say : sayOf(label);
    return { rawLabel: row.label, label, say, n: row.n, fatal: row.fatal, rate: row.rate, ratio: row.ratio };
  };
  return { ref: pack(result.ref), w1: pack(result.worst[0]), w2: pack(result.worst[1]), w3: pack(result.worst[2]) };
}

function placeholders(f, defs = {}) {
  const out = { year: String(YEAR) };
  // 区分の決めごと（候補の defs。例: def.age＝「24歳以下」）。データの数字ではなく定義なので候補のファイルに書く
  for (const [k, v] of Object.entries(defs)) out[`def.${k}`] = v;
  for (const [role, v] of Object.entries(f)) {
    out[`${role}.label`] = v.label;
    out[`${role}.say`] = v.say;
    out[`${role}.rate`] = fmtRate(v.rate);
    out[`${role}.n`] = v.n.toLocaleString('en-US');
    out[`${role}.f`] = v.fatal.toLocaleString('en-US');
    if (role !== 'ref') {
      out[`${role}.r`] = fmtRatio(v.ratio);
      out[`${role}.ri`] = String(Math.floor(v.ratio));
      out[`${role}.rs`] = String(Math.round(v.ratio));
    }
  }
  // 順位どうしの倍率 {w1w2.r} など（第1位は第2位の何倍か）。画面の致死率（小数2桁）で割っても同じ値になるときだけ使える
  for (const [a, b] of PAIRS) {
    const x = f[a].rate / f[b].rate;
    const shown = Number(fmtRate(f[a].rate)) / Number(fmtRate(f[b].rate));
    const ok = fmtRatio(x) === fmtRatio(shown);
    out[`${a}${b}.r`] = ok ? fmtRatio(x) : UNUSABLE;
    out[`${a}${b}.ri`] = ok ? String(Math.floor(x)) : UNUSABLE;
    out[`${a}${b}.rs`] = ok ? String(Math.round(x)) : UNUSABLE;
  }
  return out;
}
const PAIRS = [['w1', 'w2'], ['w1', 'w3'], ['w2', 'w3']];
const UNUSABLE = Symbol('画面の数字で割ると倍率が変わる');

/** フックと最初の問いに出す倍率（hookRatio: 'w1' は参考との比、'w1w2' などは順位どうしの比）。 */
function hookRatioOf(content, v) {
  const key = content.hookRatio ?? 'w1';
  if (!/^w[1-3](w[1-3])?$/.test(key)) throw new Error(`EP${content.id}: hookRatio「${key}」が不正`);
  if (v[`${key}.r`] === UNUSABLE) throw new Error(`EP${content.id}: hookRatio「${key}」は画面の致死率で割ると倍率が変わるので使えない`);
  return { r: v[`${key}.r`], ri: v[`${key}.ri`] };
}

/** 手書きの数字がないか（第1位〜第3位だけは許す）を確かめてから差し込む。 */
function render(template, values, where) {
  const bare = template.replace(/\{[a-z0-9]+(?:\.[a-z]+)?\}/g, '').replace(/第[1-3]位/g, '');
  if (/[0-9０-９]/.test(bare)) throw new Error(`${where}: 手書きの数字がある → 「${template}」`);
  return template.replace(/\{([a-z0-9]+(?:\.[a-z]+)?)\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`${where}: 不明な差し込み {${key}}`);
    if (values[key] === UNUSABLE) throw new Error(`${where}: {${key}} は画面の致死率で割ると倍率が変わるので使えない`);
    return values[key];
  });
}

function buildCaption(c, f, v, where) {
  const r = (t, k) => render(t, v, `${where}.caption.${k}`);
  return [
    r(c.hook, 'hook'),
    '',
    `警察庁データの${r(c.panel, 'panel')}👇`,
    `・参考：${f.ref.label}（${fmtRate(f.ref.rate)}%）`,
    `・第3位：${f.w3.label}（${fmtRate(f.w3.rate)}%）`,
    `・第2位：${f.w2.label}（${fmtRate(f.w2.rate)}%）`,
    `・第1位：${f.w1.label}（${fmtRate(f.w1.rate)}% ＝ ${r(c.refShort, 'refShort')}の約${fmtRatio(f.w1.ratio)}倍！）`,
    '',
    r(c.explain, 'explain'),
    '',
    r(c.share, 'share'),
    '',
    `出典：警察庁 交通事故統計オープンデータ（${YEAR}年）`,
    c.tags,
  ].join('\n');
}

function buildEpisode(content, f) {
  const v = placeholders(f, content.defs);
  const where = `EP${content.id}`;
  const r = (t, k) => render(t, v, `${where}.${k}`);
  for (const [raw, entry] of Object.entries(content.labels)) {
    for (const shown of [shownOf(entry, raw), typeof entry === 'object' ? entry.say : null].filter(Boolean)) {
      if (digitsOf(shown) && digitsOf(shown) !== digitsOf(raw)) throw new Error(`${where}: 表示名・読み「${shown}」の数字が区分「${raw}」と違う`);
    }
  }
  const ratioNote = (w) => `約${fmtRatio(w.ratio)}倍`;
  return {
    id: content.id,
    slug: r(content.slug, 'slug'),
    badge: r(content.badge, 'badge'),
    caseTitle: r(content.caseTitle, 'caseTitle'),
    hookLine1: r(content.hookLine1, 'hookLine1'),
    hookHighlight: r(content.hookHighlight, 'hookHighlight'),
    hookLine2: r(content.hookLine2, 'hookLine2'),
    panelTitle: r(content.panelTitle, 'panelTitle'),
    ref: { label: `参考：${f.ref.label}`, rate: Number(f.ref.rate.toFixed(RATE_DECIMALS)) },
    worst: [
      { rank: '第1位', label: f.w1.label, rate: Number(f.w1.rate.toFixed(RATE_DECIMALS)), note: `${v['w1.n']}件中${v['w1.f']}件死亡`, isDanger: true },
      { rank: '第2位', label: f.w2.label, rate: Number(f.w2.rate.toFixed(RATE_DECIMALS)), note: ratioNote(f.w2), isGold: true },
      { rank: '第3位', label: f.w3.label, rate: Number(f.w3.rate.toFixed(RATE_DECIMALS)), note: ratioNote(f.w3), isGold: true },
    ],
    barMax: f.w1.rate < 10 ? Math.ceil(f.w1.rate * 1.1 * 10) / 10 : Math.ceil(f.w1.rate * 1.1),
    reasonLeft: { title: r(content.reasonLeft.title, 'reasonLeft.title'), body: r(content.reasonLeft.body, 'reasonLeft.body') },
    reasonRight: { title: r(content.reasonRight.title, 'reasonRight.title'), body: r(content.reasonRight.body, 'reasonRight.body') },
    ctaTitle: r(content.ctaTitle, 'ctaTitle'),
    bgs: content.bgs,
    narration: r(content.narration, 'narration'),
    caption: buildCaption(content.caption, f, v, where),
    _mdSubtitle: r(content.mdSubtitle, 'mdSubtitle'),
  };
}

/** 決めごと（指示書 §1・§3）の検査。違反はまとめて返す。 */
function lint(ep, f, spoilers, hookRatio, hideUntilReveal) {
  const errs = [];
  const len = ep.narration.length;
  if (len < NARRATION_CHARS[0] || len > NARRATION_CHARS[1]) errs.push(`narration ${len}字（${NARRATION_CHARS.join('〜')}字）`);
  const hook = ep.hookLine1 + ep.hookHighlight + ep.hookLine2;
  const r1 = hookRatio.r;
  if (!hook.includes(`${r1}倍`)) errs.push(`フックに倍率「${r1}倍」がない`);
  const core = f.w1.label.replace(/（.*）/, '');
  const first = ep.narration.split('？')[0];
  if (!ep.narration.includes('？')) errs.push('最初の文が問いでない');
  // 第1位を明かす前に画面に出る文字（HUD の caseTitle は0秒から、badge と panelTitle は参考の柱から）と最初の問い
  const early = { caseTitle: ep.caseTitle, badge: ep.badge, hook, panelTitle: ep.panelTitle, 最初の問い: first };
  for (const word of [core, ...spoilers]) {
    for (const [where, text] of Object.entries(early)) {
      if (text.toUpperCase().includes(word.toUpperCase())) errs.push(`${where}に答え「${word}」が出ている`);
    }
  }
  if (!first.includes(`${r1}倍`) && !first.includes(`${hookRatio.ri}倍`)) errs.push('最初の文に倍率がない');
  // 第1位を言う節より前の声と、先に伸びる柱（参考・第3位・第2位）の名前にも、問いの答えそのものを出さない（EP08 で「単独事故」が第3位の文と柱に出ていた・レビューの指摘）。
  // 答えの語は回ごとの hideUntilReveal（なければ第1位の名前）。第3位「深夜1時台」→第1位「深夜3時台」のように同じ仲間が先に出るのは、ランキングの形なので認める
  const w1Text = `${fmtRate(f.w1.rate)}%`;
  const at = ep.narration.indexOf(w1Text);
  let revealStart = at;
  while (revealStart > 0 && !'、。？'.includes(ep.narration[revealStart - 1])) revealStart--;
  const beforeReveal = at >= 0 ? ep.narration.slice(0, revealStart) : '';
  const barsBefore = { 参考の柱: f.ref.label, 第3位の柱: f.w3.label, 第2位の柱: f.w2.label };
  for (const word of hideUntilReveal ?? [core]) {
    if (beforeReveal.toUpperCase().includes(word.toUpperCase())) errs.push(`第1位を言う前の声に答え「${word}」が出ている`);
    for (const [where, text] of Object.entries(barsBefore)) {
      if (text.toUpperCase().includes(word.toUpperCase())) errs.push(`${where}（第1位より先に出る）に答え「${word}」が出ている`);
    }
  }
  // 第1位を明かす場面の大きな倍率は、声が言う「約○倍」と同じでなければならない（scene.js と同じ関数で選ぶ）
  const focus = focusRatio([ep.ref.rate, ep.worst[2].rate, ep.worst[1].rate, ep.worst[0].rate], ep.narration, hook);
  if (!focus.exact) errs.push(`第1位を言う文の「約○倍」が、画面の柱の倍率（参考との比・順位どうしの比）のどれとも同じでない（画面には約${focus.ratio}倍が出る）`);
  const sentences = ep.narration.split('。').filter(Boolean);
  if (!/送ってください$/.test(sentences.at(-1))) errs.push('最後の文が「誰に送るか」でない');
  if (/保存/.test(ep.narration)) errs.push('ナレーションに保存依頼がある');
  // ナレーションは AI Studio の TTS で読むだけの文（画面には出ない）。読み違えやすい記号を残さない
  for (const mark of UNSPEAKABLE) if (ep.narration.includes(mark)) errs.push(`ナレーションに読み上げにくい「${mark}」がある（{x.say} を使う）`);
  if (ep.bgs.length !== 3) errs.push('bgs が3つでない');
  ep.worst.forEach((w, i) => {
    const onScreen = fmtRatio(w.rate / ep.ref.rate);
    const inText = fmtRatio([f.w1, f.w2, f.w3][i].ratio);
    if (onScreen !== inText) errs.push(`${w.rank}: 画面の倍率 ${onScreen} と原稿の倍率 ${inText} が違う`);
  });
  for (const w of [f.w1, f.w2, f.w3]) {
    if (!ep.narration.includes(`${fmtRate(w.rate)}%`)) errs.push(`ナレーションに ${w.label} の ${fmtRate(w.rate)}% がない`);
  }
  if (!ep.narration.includes(`${fmtRate(f.ref.rate)}%`)) errs.push(`ナレーションに参考の ${fmtRate(f.ref.rate)}% がない`);
  return errs;
}

// ---- episodes.json（既存の書式に合わせて末尾に足す） ----
const j = (v) => JSON.stringify(v);
const inline = (o) => `{ ${Object.entries(o).map(([k, v]) => `${j(k)}: ${j(v)}`).join(', ')} }`;
function formatEpisode(ep) {
  return [
    '  {',
    ...['id', 'slug', 'badge', 'caseTitle', 'hookLine1', 'hookHighlight', 'hookLine2', 'panelTitle'].map((k) => `    ${j(k)}: ${j(ep[k])},`),
    `    "ref": ${inline(ep.ref)},`,
    '    "worst": [',
    ep.worst.map((w) => `      ${inline(w)}`).join(',\n'),
    '    ],',
    `    "barMax": ${ep.barMax.toFixed(1)},`,
    `    "reasonLeft": ${inline(ep.reasonLeft)},`,
    `    "reasonRight": ${inline(ep.reasonRight)},`,
    `    "ctaTitle": ${j(ep.ctaTitle)},`,
    '    "bgs": [',
    ep.bgs.map((b) => `      ${j(b)}`).join(',\n'),
    '    ],',
    `    "narration": ${j(ep.narration)},`,
    `    "caption": ${j(ep.caption)}`,
    '  }',
  ].join('\n');
}

/**
 * 原稿のある回だけを1回ずつ差し替える（まだ無い回は末尾に足す）。ほかの回の文字はそのまま。
 * 1回分の範囲は「その回の始まり」から「次の回の始まり（最後の回なら閉じかっこ）」の手前まで。
 */
function spliceEpisodes(text, eps) {
  const marker = (id) => `\n  {\n    "id": "${id}",`;
  let out = text;
  for (const ep of eps) {
    const start = out.indexOf(marker(ep.id));
    if (start < 0) {
      if (!out.endsWith('\n  }\n]\n')) throw new Error('episodes.json の末尾の形が想定と違う');
      out = `${out.slice(0, -3)},\n${formatEpisode(ep)}\n]\n`;
      continue;
    }
    const after = out.indexOf('\n  {\n    "id": "', start + 1);
    if (after >= 0) out = `${out.slice(0, start)}\n${formatEpisode(ep)},${out.slice(after)}`;
    else out = `${out.slice(0, start)}\n${formatEpisode(ep)}${out.slice(out.lastIndexOf('\n]\n'))}`;
  }
  return out;
}

function spliceMd(text, eps) {
  const head = (id) => `---\n## EP${id}：`;
  const section = (ep) => [
    `---\n## EP${ep.id}：${ep.caseTitle}（${ep._mdSubtitle}）\n`,
    '### Gemini TTS 読み上げ原稿（35秒想定）',
    '```text', ep.narration, '```\n',
    '### Instagram キャプション＆ハッシュタグ',
    '```text', ep.caption, '```\n\n',
  ].join('\n');
  let out = text;
  for (const ep of eps) {
    const start = out.indexOf(head(ep.id));
    if (start < 0) {
      if (!out.endsWith('```\n\n')) throw new Error('scripts_and_captions.md の末尾の形が想定と違う');
      out += section(ep);
      continue;
    }
    const after = out.indexOf('---\n## EP', start + 1);
    out = out.slice(0, start) + section(ep) + (after >= 0 ? out.slice(after) : '');
  }
  return out;
}

/** 差し替えた回以外は中身がそのまま・id は 01〜30 の順・項目は既存と同じ。 */
function verifyEpisodesFile(original, next, builtIds) {
  const before = JSON.parse(original);
  const after = JSON.parse(next);
  const ids = after.map((e) => e.id);
  const want = Array.from({ length: 30 }, (_, i) => pad(i + 1));
  if (!isDeepStrictEqual(ids, want)) throw new Error(`id が 01〜30 の順にそろっていない: ${ids.join(',')}`);
  for (const e of before) {
    if (builtIds.includes(e.id)) continue;
    if (!isDeepStrictEqual(after.find((a) => a.id === e.id), e)) throw new Error(`差し替えていない EP${e.id} の内容が変わった`);
  }
  const keys = Object.keys(before[0]);
  for (const e of after) {
    if (!isDeepStrictEqual(Object.keys(e), keys)) throw new Error(`EP${e.id}: 項目が既存と違う`);
    for (const k of keys) if (e[k] == null || e[k] === '') throw new Error(`EP${e.id}: ${k} が空`);
    if (e.worst.length !== 3) throw new Error(`EP${e.id}: worst が3件でない`);
  }
  return after.length;
}

/** md も、差し替えた回の節以外は1文字も変わっていないこと。 */
function verifyMd(original, next, builtIds) {
  const split = (t) => t.split(/(?=---\n## EP\d\d：)/).filter((x) => !builtIds.some((id) => x.startsWith(`---\n## EP${id}：`)));
  if (!isDeepStrictEqual(split(original), split(next).slice(0, split(original).length))) throw new Error('差し替えていない md の節が変わった');
}

// ---- 実行 ----
const outside = EPISODES.filter((e) => !SET_IDS.includes(e.id)).map((e) => e.id);
if (outside.length) throw new Error(`まとまり（EP${SET_IDS[0]}〜${SET_IDS.at(-1)}）の外の回の原稿がある: ${outside.join(',')}`);
const keptIds = SET_IDS.filter((id) => !EPISODES.some((e) => e.id === id));
if (keptIds.length) console.log(`原稿のない回は今のまま残す: EP${keptIds.join('・EP')}`);
const chosen = EPISODES.map((e) => {
  const cand = CANDIDATES.find((c) => c.id === e.cand);
  if (!cand) throw new Error(`候補 ${e.cand} がない`);
  return { content: { ...e, defs: cand.defs ?? {} }, cand };
});
const { counts, check } = await aggregate(csvPath, chosen.map((c) => c.cand));
assertDefinition(check);

const factsOut = [];
const eps = [];
const problems = [];
for (const { content, cand } of chosen) {
  const result = evaluate(cand, counts.get(cand.id));
  if (result.problems.length) throw new Error(`EP${content.id}（${cand.id}）が採用条件を満たさない: ${result.problems.join(' / ')}`);
  const gotWorst = result.worst.map((w) => w.label);
  if (!isDeepStrictEqual(gotWorst, content.expectWorst)) throw new Error(`EP${content.id}: ワースト3が原稿の前提と違う: ${gotWorst.join(' / ')}`);
  const f = factsFor(content, result);
  const ep = buildEpisode(content, f);
  if (!Array.isArray(content.spoilers) || content.spoilers.length === 0) throw new Error(`EP${content.id}: spoilers（伏せる語）がない`);
  const errs = lint(ep, f, content.spoilers, hookRatioOf(content, placeholders(f, content.defs)), content.hideUntilReveal);
  if (errs.length) problems.push(`EP${content.id}: ${errs.join(' / ')}`);
  console.log(`EP${ep.id} ${ep.caseTitle}: narration ${ep.narration.length}字 / 第1位 ${f.w1.label} ${fmtRate(f.w1.rate)}%（${fmtRatio(f.w1.ratio)}倍）`);
  eps.push(ep);
  factsOut.push({ id: content.id, candidate: cand.id, title: cand.title, subject: cand.subject, column: cand.column, ...f });
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

// core.autocrlf=true の作業コピーは CRLF になることがある。中では LF で扱い、書くときは元の改行に戻す。
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);
const readLf = (p) => {
  const raw = readFileSync(p, 'utf8');
  return { text: raw.split(CRLF).join(LF), eol: raw.includes(CRLF) ? CRLF : LF };
};
const writeEol = (p, text, eol) => writeFileSync(p, eol === LF ? text : text.split(LF).join(eol), 'utf8');
const { text: epText, eol: epEol } = readLf(PATHS.episodes);
const { text: mdText, eol: mdEol } = readLf(PATHS.md);
const builtIds = eps.map((e) => e.id);
const epNext = spliceEpisodes(epText, eps);
const mdNext = spliceMd(mdText, eps);
const total = verifyEpisodesFile(epText, epNext, builtIds);
verifyMd(mdText, mdNext, builtIds);
console.log(`検査: OK（${total}件・id 01〜30・差し替えた EP${builtIds[0]}〜${builtIds.at(-1)} 以外は変更なし・必須項目の欠けなし）`);

if (dryRun) {
  console.log(JSON.stringify(eps.map(({ id, hookLine1, hookHighlight, hookLine2, narration }) => ({ id, hook: hookLine1 + '／' + hookHighlight + '／' + hookLine2, narration })), null, 1));
} else {
  writeFileSync(PATHS.facts, `${JSON.stringify({ source: `honhyo_${YEAR}_to-degree.csv`, definition: '致死率 = 死者数≥1 の本票の行数 ÷ 行数（本票1行＝1事故、24時間以内の死者）', rows: check.n, fatalAccidents: check.fatal, episodes: factsOut }, null, 2)}\n`, 'utf8');
  writeEol(PATHS.episodes, epNext, epEol);
  writeEol(PATHS.md, mdNext, mdEol);
  console.log(`書き出し: ${PATHS.episodes} / ${PATHS.md} / ${PATHS.facts}`);
}
