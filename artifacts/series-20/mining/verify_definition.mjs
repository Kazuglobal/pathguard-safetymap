// 致死率の定義を確かめる: EP01（車同士・車両単独・人対車両・列車）と EP20（全体平均・カーブ）を再現する。
// 使い方: node verify_definition.mjs <honhyo_2023_to-degree.csv>
// 行の中身は出力しない（集計値だけ）。
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const path = process.argv[2];
if (!path) { console.error('usage: node verify_definition.mjs <csv>'); process.exit(2); }

const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
let header = null; let idx = {};
const total = { n: 0, fatal: 0, deaths: 0 };
const byType = {}; const byShape = {}; const byContent = {};
let badCols = 0;

const bump = (m, k, fatal) => { const e = (m[k] ??= { n: 0, fatal: 0 }); e.n++; if (fatal) e.fatal++; };

for await (const line of rl) {
  if (!header) {
    header = line.replace(/^﻿/, '').split(',');
    if (header.some((h) => h.includes('�'))) { console.error('見出しに置換文字あり: 列の位置を推測せず停止'); process.exit(3); }
    header.forEach((h, i) => { idx[h] = i; });
    for (const need of ['死者数', '事故類型', '道路形状', '事故内容']) if (!(need in idx)) { console.error('列がない: ' + need); process.exit(3); }
    console.log('列数', header.length);
    continue;
  }
  const c = line.split(',');
  if (c.length !== header.length) { badCols++; continue; }
  const deaths = Number(c[idx['死者数']]);
  const fatal = deaths >= 1;
  total.n++; if (fatal) total.fatal++; total.deaths += deaths;
  bump(byType, c[idx['事故類型']], fatal);
  bump(byShape, c[idx['道路形状']], fatal);
  bump(byContent, c[idx['事故内容']], fatal);
}

const pct = (e) => (100 * e.fatal / e.n);
console.log('行数', total.n, '列数の合わない行', badCols);
console.log('全体: 人身事故', total.n, '死亡事故', total.fatal, '死者数', total.deaths, '致死率', pct(total).toFixed(4) + '%');
console.log('事故内容(1=死亡,2=負傷):', JSON.stringify(byContent));
const typeName = { '01': '人対車両', '21': '車両相互', '41': '車両単独', '61': '列車' };
for (const [k, e] of Object.entries(byType).sort()) console.log('事故類型', k, typeName[k] ?? '?', e.n, '件', e.fatal, '死亡', pct(e).toFixed(4) + '%', '構成比', (100 * e.n / total.n).toFixed(2) + '%');
for (const k of ['13']) { const e = byShape[k]; console.log('道路形状', k, '単路－カーブ・屈折', e.n, '件', e.fatal, '死亡', pct(e).toFixed(4) + '%'); }
const car = byType['21'], solo = byType['41'], ped = byType['01'];
console.log('倍率 単独/車同士', (pct(solo) / pct(car)).toFixed(3), ' 人対車両/車同士', (pct(ped) / pct(car)).toFixed(3));
