// EP21〜30 の「〇倍ギャップ」候補を本票 CSV から集計する。
// 使い方: node mine_gaps.mjs <honhyo_2023_to-degree.csv> [出力CSV]
// 出力は集計値だけ（行の中身は出さない）。致死率 = 死者数≥1 の行数 ÷ 行数（本票1行＝1事故）。
// コードの意味は警察庁 codebook_2023.xlsx の原本で確認したもの（npa-codebook.json に無い項目を含む）。
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { CANDIDATES } from './candidates.mjs';

const MIN_REF_N = 1000;
const MIN_WORST_N = 200;
const MIN_WORST_FATAL = 10;
const MIN_TOP_RATIO = 2.0;
const MAX_P = 0.01;

const [csvPath, outPath = new URL('./ep21-30_candidates.csv', import.meta.url)] = process.argv.slice(2);
if (!csvPath) {
  console.error('usage: node mine_gaps.mjs <honhyo_2023_to-degree.csv> [out.csv]');
  process.exit(2);
}

// ---- 集計 ----
async function aggregate(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let header = null;
  const counts = new Map(CANDIDATES.map((c) => [c.id, new Map()]));
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
    for (const cand of CANDIDATES) {
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

// 既存EPの数字（EP01・EP20）を再現できなければ止める。
function assertDefinition({ n, fatal, byType, curve }) {
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

// ---- 検定（Fisher の正確確率検定・両側） ----
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

function fisherTwoSided(a, r1, c, r2) {
  const k = a + c;
  const N = r1 + r2;
  const base = logChoose(N, k);
  const logP = (x) => logChoose(r1, x) + logChoose(r2, k - x) - base;
  const observed = logP(a);
  let p = 0;
  for (let x = Math.max(0, k - r2); x <= Math.min(k, r1); x++) {
    const lp = logP(x);
    if (lp <= observed + 1e-9) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

// ---- 判定 ----
const rate = (e) => (100 * e.fatal) / e.n;

function evaluate(cand, m) {
  const ref = m.get(cand.ref);
  const rows = [...m.entries()].map(([label, e]) => ({ label, ...e, rate: rate(e) }));
  const problems = [];
  if (!ref) problems.push(`参考「${cand.ref}」が0件`);
  else if (ref.n < MIN_REF_N) problems.push(`参考が${MIN_REF_N}件未満（${ref.n}件）`);
  const refRate = ref ? rate(ref) : NaN;
  for (const r of rows) {
    r.ratio = r.rate / refRate;
    r.p = ref && r.label !== cand.ref ? fisherTwoSided(r.fatal, r.n, ref.fatal, ref.n) : null;
    r.excluded = (cand.notRanked ?? []).includes(r.label);
    r.small = r.n < MIN_WORST_N || r.fatal < MIN_WORST_FATAL;
  }
  const worst = rows
    .filter((r) => r.label !== cand.ref && !r.excluded && !r.small && r.rate > refRate)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
  worst.forEach((r, i) => { r.role = `第${i + 1}位`; });
  if (worst.length < 3) problems.push(`ワースト3がそろわない（条件を満たす区分が${worst.length}つ）`);
  if (worst[0] && worst[0].ratio < MIN_TOP_RATIO) problems.push(`第1位が${MIN_TOP_RATIO}倍未満（${worst[0].ratio.toFixed(2)}倍）`);
  if (worst[0] && !(worst[0].p < MAX_P)) problems.push(`第1位の差が有意でない（p=${worst[0].p.toExponential(1)}）`);
  for (const r of worst.slice(1)) if (!(r.p < 0.05)) problems.push(`${r.role}の差がはっきりしない（p=${r.p.toFixed(3)}）`);
  if (ref) rows.find((r) => r.label === cand.ref).role = '参考';
  const verdict = cand.reject ? '不採用' : problems.length ? '不採用' : cand.caution ? '条件つき' : '採用候補';
  const reasons = [...problems, cand.reject, cand.caution].filter(Boolean);
  return { cand, rows, worst, ref, verdict, reasons };
}

// ---- 出力 ----
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fmtP = (p) => (p == null ? '' : p < 1e-300 ? '<1e-300' : p.toExponential(2));

function toCsv(results) {
  const head = ['候補ID', '判定', '列', '対象', '区分', '役割', '件数', '死亡', '致死率(%)', '倍率', 'p値', '判定理由'];
  const lines = [head.join(',')];
  for (const { cand, rows, verdict, reasons } of results) {
    const order = { 参考: 0, 第1位: 1, 第2位: 2, 第3位: 3 };
    rows.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || b.rate - a.rate);
    for (const r of rows) {
      const note = r.role ? '' : r.excluded ? '並べない区分' : r.small ? `件数不足（${MIN_WORST_N}件・死亡${MIN_WORST_FATAL}件の条件）` : '';
      lines.push([
        cand.id, verdict, cand.column, cand.subject, r.label, r.role ?? '', r.n, r.fatal,
        r.rate.toFixed(2), Number.isFinite(r.ratio) ? r.ratio.toFixed(2) : '', fmtP(r.p),
        r.role === '参考' ? reasons.join(' / ') : note,
      ].map(csvCell).join(','));
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function printSummary(results) {
  for (const { cand, ref, worst, verdict, reasons } of results) {
    const w = worst.map((r) => `${r.role} ${r.label} ${r.rate.toFixed(2)}%（${r.n}件中${r.fatal}件・${r.ratio.toFixed(1)}倍）`).join(' / ');
    const refText = ref ? `${cand.ref} ${rate(ref).toFixed(2)}%（${ref.n}件中${ref.fatal}件）` : cand.ref;
    console.log(`[${verdict}] ${cand.id} ${cand.title}\n  参考: ${refText}\n  ${w}\n  ${reasons.join(' / ')}`);
  }
}

const { counts, check } = await aggregate(csvPath);
assertDefinition(check);
console.log(`定義の確認: OK（${check.n}件・死亡事故${check.fatal}件・全体${((100 * check.fatal) / check.n).toFixed(2)}%）`);
const results = CANDIDATES.map((c) => evaluate(c, counts.get(c.id)));
writeFileSync(outPath, toCsv(results), 'utf8');
printSummary(results);
console.log(`書き出し: ${outPath instanceof URL ? outPath.pathname : outPath}`);
