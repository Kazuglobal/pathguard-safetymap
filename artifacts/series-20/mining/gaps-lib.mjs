// 〇倍ギャップの集計・検定・判定（mine_gaps.mjs と build_ep21-30.mjs が使う）。
// 致死率 = 死者数≥1 の行数 ÷ 行数（本票1行＝1事故）。行の中身は返さない（集計値だけ）。
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const RULES = { minRefN: 1000, minWorstN: 200, minWorstFatal: 10, minTopRatio: 2.0, maxP: 0.01, maxP23: 0.05 };

export async function aggregate(path, candidates) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let header = null;
  const counts = new Map(candidates.map((c) => [c.id, new Map()]));
  const check = { n: 0, fatal: 0, byType: {}, curve: [0, 0] };
  for await (const line of rl) {
    if (!header) {
      header = line.replace(/^﻿/, '').split(',');
      if (header.some((h) => h.includes('�'))) throw new Error('見出しに置換文字があるため停止（列の位置を推測しない）');
      continue;
    }
    const cells = line.split(',');
    if (cells.length !== header.length) throw new Error(`列数が見出しと合わない行がある（${cells.length}≠${header.length}）`);
    const row = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    const fatal = Number(row['死者数']) >= 1;
    check.n++;
    if (fatal) check.fatal++;
    const t = (check.byType[row['事故類型']] ??= [0, 0]);
    t[0]++;
    if (fatal) t[1]++;
    if (row['道路形状'] === '13') { check.curve[0]++; if (fatal) check.curve[1]++; }
    for (const cand of candidates) {
      const label = cand.categorize(row);
      if (label == null) continue;
      const m = counts.get(cand.id);
      const e = m.get(label) ?? { n: 0, fatal: 0 };
      e.n++;
      if (fatal) e.fatal++;
      m.set(label, e);
    }
  }
  return { counts, check };
}

/** 既存EPの数字（EP01・EP20）を再現できなければ止める。 */
export function assertDefinition({ n, fatal, byType, curve }) {
  const pct = ([a, b]) => Math.round((10000 * b) / a) / 100;
  const expect = [
    ['全体平均（EP20）', pct([n, fatal]), 0.85],
    ['車同士（EP01）', pct(byType['21']), 0.36],
    ['車両単独（EP01）', pct(byType['41']), 5.78],
    ['人対車両（EP01）', pct(byType['01']), 2.34],
    ['列車（EP01）', pct(byType['61']), 65.08],
    ['カーブ・屈折（EP20）', pct(curve), 4.23],
  ];
  for (const [name, got, want] of expect) {
    if (got !== want) throw new Error(`定義の確認に失敗: ${name} ${got}% ≠ ${want}%`);
  }
  if (n !== 307930) throw new Error(`行数が 307,930 でない: ${n}`);
}

// ---- Fisher の正確確率検定（両側） ----
const logFact = (() => {
  let table = new Float64Array([0]);
  return (k) => {
    if (k >= table.length) {
      const next = new Float64Array(Math.max(k + 1, table.length * 2));
      next.set(table);
      for (let i = table.length; i < next.length; i++) next[i] = next[i - 1] + Math.log(i);
      table = next;
    }
    return table[k];
  };
})();
const logChoose = (n, k) => logFact(n) - logFact(k) - logFact(n - k);

export function fisherTwoSided(a, r1, c, r2) {
  const k = a + c;
  const base = logChoose(r1 + r2, k);
  const logP = (x) => logChoose(r1, x) + logChoose(r2, k - x) - base;
  const observed = logP(a);
  let p = 0;
  for (let x = Math.max(0, k - r2); x <= Math.min(k, r1); x++) {
    const lp = logP(x);
    if (lp <= observed + 1e-9) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

export const rateOf = (e) => (100 * e.fatal) / e.n;

/** 候補1つを採用条件で判定する。worst は条件を満たす区分の致死率上位3つ。cand.rules で回ごとに条件をゆるめられる（理由は cand.rulesNote）。 */
export function evaluate(cand, m, base = RULES) {
  const rules = { ...base, ...(cand.rules ?? {}) };
  const ref = m.get(cand.ref);
  const rows = [...m.entries()].map(([label, e]) => ({ label, ...e, rate: rateOf(e) }));
  const problems = [];
  if (!ref) problems.push(`参考「${cand.ref}」が0件`);
  else if (ref.n < rules.minRefN) problems.push(`参考が${rules.minRefN}件未満（${ref.n}件）`);
  const refRate = ref ? rateOf(ref) : NaN;
  for (const r of rows) {
    r.ratio = r.rate / refRate;
    r.p = ref && r.label !== cand.ref ? fisherTwoSided(r.fatal, r.n, ref.fatal, ref.n) : null;
    r.excluded = (cand.notRanked ?? []).includes(r.label);
    r.small = r.n < rules.minWorstN || r.fatal < rules.minWorstFatal;
  }
  const worst = rows
    .filter((r) => r.label !== cand.ref && !r.excluded && !r.small && r.rate > refRate)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
  worst.forEach((r, i) => { r.role = `第${i + 1}位`; });
  if (worst.length < 3) problems.push(`ワースト3がそろわない（条件を満たす区分が${worst.length}つ）`);
  if (worst[0] && worst[0].ratio < rules.minTopRatio) problems.push(`第1位が${rules.minTopRatio}倍未満（${worst[0].ratio.toFixed(2)}倍）`);
  if (worst[0] && !(worst[0].p < rules.maxP)) problems.push(`第1位の差が有意でない（p=${worst[0].p.toExponential(1)}）`);
  for (const r of worst.slice(1)) if (!(r.p < rules.maxP23)) problems.push(`${r.role}の差がはっきりしない（p=${r.p.toFixed(3)}）`);
  if (ref) rows.find((r) => r.label === cand.ref).role = '参考';
  const verdict = cand.reject || problems.length ? '不採用' : cand.caution ? '条件つき' : '採用候補';
  const reasons = [...problems, cand.reject, cand.caution, cand.rulesNote && `条件をゆるめた: ${cand.rulesNote}`].filter(Boolean);
  return { cand, rows, worst, ref: ref ? rows.find((r) => r.role === '参考') : null, verdict, reasons, problems };
}
