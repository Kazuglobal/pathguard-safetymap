// EP21〜30 の「〇倍ギャップ」候補を本票 CSV から集計する。
// 使い方: node mine_gaps.mjs <honhyo_2023_to-degree.csv> [出力CSV]
// 出力は集計値だけ（行の中身は出さない）。致死率 = 死者数≥1 の行数 ÷ 行数（本票1行＝1事故）。
// コードの意味は警察庁 codebook_2023.xlsx の原本で確認したもの（npa-codebook.json に無い項目を含む）。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES, aggregate, assertDefinition, evaluate } from './gaps-lib.mjs';

// --set ep04-20 で EP04〜20 の作り直し用の区分（candidates_ep04-20.mjs）を数える
const argv = process.argv.slice(2);
const setIdx = argv.indexOf('--set');
const set = setIdx >= 0 ? argv.splice(setIdx, 2)[1] : 'ep21-30';
const { CANDIDATES } = await import(set === 'ep04-20' ? './candidates_ep04-20.mjs' : './candidates.mjs');
const [csvPath, outPath = fileURLToPath(new URL(`./${set}_candidates.csv`, import.meta.url))] = argv;
if (!csvPath) {
  console.error('usage: node mine_gaps.mjs <honhyo_2023_to-degree.csv> [out.csv]');
  process.exit(2);
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fmtP = (p) => (p == null ? '' : p < 1e-300 ? '<1e-300' : p.toExponential(2));
const ORDER = { 参考: 0, 第1位: 1, 第2位: 2, 第3位: 3 };

function toCsv(results) {
  const head = ['候補ID', '判定', '列', '対象', '区分', '役割', '件数', '死亡', '致死率(%)', '倍率', 'p値', '判定理由'];
  const lines = [head.join(',')];
  for (const { cand, rows, verdict, reasons } of results) {
    const sorted = [...rows].sort((a, b) => (ORDER[a.role] ?? 9) - (ORDER[b.role] ?? 9) || b.rate - a.rate);
    for (const r of sorted) {
      const note = r.role ? '' : r.excluded ? '並べない区分'
        : r.small ? `件数不足（${RULES.minWorstN}件・死亡${RULES.minWorstFatal}件の条件）` : '';
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
    const refText = ref ? `${cand.ref} ${ref.rate.toFixed(2)}%（${ref.n}件中${ref.fatal}件）` : cand.ref;
    const o = cand.original ? `\n  今の数字: 参考 ${cand.original.ref}% / 第1位 ${cand.original.w1Label} ${cand.original.w1}%` : '';
    console.log(`[${verdict}] ${cand.id} ${cand.title}\n  参考: ${refText}\n  ${w}\n  ${reasons.join(' / ')}${o}`);
  }
}

const { counts, check } = await aggregate(csvPath, CANDIDATES);
assertDefinition(check);
console.log(`定義の確認: OK（${check.n}件・死亡事故${check.fatal}件・全体${((100 * check.fatal) / check.n).toFixed(2)}%）`);
const results = CANDIDATES.map((c) => evaluate(c, counts.get(c.id)));
writeFileSync(outPath, toCsv(results), 'utf8');
printSummary(results);
console.log(`書き出し: ${outPath}`);
