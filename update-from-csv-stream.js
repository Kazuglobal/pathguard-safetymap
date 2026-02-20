/**
 * update-from-csv-stream.js
 * 大容量CSV対応版 - ストリーミング読み込み
 * 
 * 使い方:
 *   node update-from-csv-stream.js honhyo_2019-2021.csv 2021
 *   node update-from-csv-stream.js honhyo_2019-2021.csv 2020
 *   node update-from-csv-stream.js honhyo_2019-2021.csv 2019
 *   node update-from-csv-stream.js honhyo_2019-2021.csv all   ← 全年度
 */

const { Client } = require("pg");
const fs = require("fs");
const readline = require("readline");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCSVLine(line) {
  const r = [];
  let c = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { q = !q; }
    else if (ch === "," && !q) { r.push(c.trim()); c = ""; }
    else { c += ch; }
  }
  r.push(c.trim());
  return r;
}

const PREF_MAP = {
  "北海道（札幌": 10, "北海道（函館": 11, "北海道（旭川": 12, "北海道（釧路": 13, "北海道（北見": 14,
  "青森": 20, "岩手": 21, "宮城": 22, "秋田": 23, "山形": 24, "福島": 25, "東京": 30,
  "茨城": 40, "栃木": 41, "群馬": 42, "埼玉": 43, "千葉": 44, "神奈川": 45,
  "新潟": 46, "山梨": 47, "長野": 48, "静岡": 49,
  "富山": 50, "石川": 51, "福井": 52, "岐阜": 53, "愛知": 54, "三重": 55,
  "大阪": 60, "京都": 61, "兵庫": 62, "奈良": 63, "和歌山": 64, "滋賀": 65,
  "広島": 70, "鳥取": 71, "島根": 72, "岡山": 73, "山口": 74,
  "香川": 80, "徳島": 81, "愛媛": 82, "高知": 83,
  "福岡": 90, "佐賀": 91, "長崎": 92, "熊本": 93, "大分": 94, "宮崎": 95, "鹿児島": 96, "沖縄": 97,
};

function prefNameToCode(name) {
  if (!name) return 0;
  if (/^\d+$/.test(name)) return parseInt(name);
  for (const [key, code] of Object.entries(PREF_MAP)) {
    if (name.includes(key)) return code;
  }
  return 0;
}

const PARTY_TYPE = {
  "01": "普通乗用車", "02": "普通貨物車", "03": "軽自動車",
  "04": "自動二輪車", "05": "原付", "06": "大型車",
  "07": "中型車", "08": "準中型車", "09": "大型特殊",
  "10": "ミニカー", "11": "小型特殊", "14": "自転車",
  "15": "歩行者", "16": "路面電車", "17": "その他",
};
const ROAD_SURFACE = { "1": "乾燥", "2": "湿潤", "3": "凍結", "4": "積雪", "5": "凹凸", "9": "その他" };
const TERRAIN = { "1": "市街地", "2": "非市街地", "3": "その他" };
const INJURY = { "1": "死亡", "2": "重傷", "3": "軽傷", "4": "無傷" };

async function executeBatch(batch, year) {
  let client;
  try {
    client = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
    await client.connect();

    const values = batch.map((b) => {
      const esc = (v) => v === null ? "NULL" : `'${(v + "").replace(/'/g, "''")}'`;
      return `(${b.prefCode}, ${esc(b.recordNum)}, ${b.year}, ${esc(b.ptA)}, ${esc(PARTY_TYPE[b.ptA] || b.ptA)}, ${esc(b.ptB)}, ${esc(PARTY_TYPE[b.ptB] || b.ptB)}, ${esc(ROAD_SURFACE[b.surf] || b.surf)}, ${esc(TERRAIN[b.terr] || b.terr)}, ${esc(INJURY[b.injA] || b.injA)}, ${esc(INJURY[b.injB] || b.injB)}, ${esc(b.vsA)}, ${esc(b.vsB)}, ${esc(b.spA)}, ${esc(b.spB)})`;
    }).join(",\n");

    const sql = `
      UPDATE traffic_accidents ta SET
        party_a_type_code = COALESCE(v.pta_code, ta.party_a_type_code),
        party_a_type_label = COALESCE(v.pta_label, ta.party_a_type_label),
        party_b_type_code = COALESCE(v.ptb_code, ta.party_b_type_code),
        party_b_type_label = COALESCE(v.ptb_label, ta.party_b_type_label),
        road_surface_label = COALESCE(v.surf_label, ta.road_surface_label),
        terrain_label = COALESCE(v.terr_label, ta.terrain_label),
        injury_level_a = COALESCE(v.inj_a, ta.injury_level_a),
        injury_level_b = COALESCE(v.inj_b, ta.injury_level_b),
        vehicle_shape_a = COALESCE(v.vs_a, ta.vehicle_shape_a),
        vehicle_shape_b = COALESCE(v.vs_b, ta.vehicle_shape_b),
        speed_limit_a = COALESCE(v.sp_a, ta.speed_limit_a),
        speed_limit_b = COALESCE(v.sp_b, ta.speed_limit_b)
      FROM (VALUES ${values})
        AS v(pref, rec, yr, pta_code, pta_label, ptb_code, ptb_label, surf_label, terr_label, inj_a, inj_b, vs_a, vs_b, sp_a, sp_b)
      WHERE ta.source_year = v.yr::smallint
        AND ta.prefecture_code = v.pref::smallint
        AND ta.record_number = v.rec
    `;

    const r = await client.query(sql);
    return { ok: r.rowCount || 0, err: 0 };
  } catch (err) {
    if (err.message.includes("Circuit breaker")) {
      await sleep(10000);
    }
    return { ok: 0, err: batch.length };
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function main() {
  const csvFile = process.argv[2];
  const yearArg = process.argv[3];
  if (!csvFile || !yearArg) {
    console.log("使い方: node update-from-csv-stream.js honhyo_2019-2021.csv 2021");
    console.log("        node update-from-csv-stream.js honhyo_2019-2021.csv all");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL をセットしてください");
    process.exit(1);
  }

  const filterYear = yearArg === "all" ? null : parseInt(yearArg);
  console.log(`\n📋 本票CSVから追加カラム更新: ${csvFile}`);
  console.log(`  対象年度: ${filterYear || "全年度"}\n`);

  // 接続テスト
  let test = new Client({ connectionString: process.env.DATABASE_URL });
  await test.connect();
  console.log("  ✅ DB接続OK\n");
  await test.end();

  const rl = readline.createInterface({
    input: fs.createReadStream(csvFile, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let colIdx = {};
  const BATCH_SIZE = 200;
  let batch = [];
  let updated = 0, errors = 0, skipped = 0, lineNum = 0;

  for await (const rawLine of rl) {
    const line = lineNum === 0 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
    lineNum++;

    if (lineNum === 1) {
      headers = parseCSVLine(line);
      const col = (name) => headers.findIndex(h => h.includes(name));
      colIdx = {
        pref: col("都道府県"), record: col("本票番号"), year: col("発生日時_年"),
        ptA: col("当事者種別（当事者A）"), ptB: col("当事者種別（当事者B）"),
        surf: col("路面状態"), terr: col("地形"),
        injA: col("人身損傷程度（当事者A）"), injB: col("人身損傷程度（当事者B）"),
        vsA: col("車両形状（当事者A）"), vsB: col("車両形状（当事者B）"),
        spA: col("速度規制（指定のみ）（当事者A）"), spB: col("速度規制（指定のみ）（当事者B）"),
      };
      console.log(`  ヘッダー: ${headers.length}カラム`);
      console.log(`  当事者種別A: col ${colIdx.ptA}, B: col ${colIdx.ptB}`);
      console.log(`  年: col ${colIdx.year}\n`);
      continue;
    }

    const vals = parseCSVLine(line);
    if (vals.length < 30) continue;

    const g = (idx) => (idx >= 0 && vals[idx]?.trim()) || null;
    const rowYear = parseInt(g(colIdx.year)) || 0;

    if (filterYear && rowYear !== filterYear) { skipped++; continue; }

    const prefCode = prefNameToCode(g(colIdx.pref));
    const recordNum = g(colIdx.record);
    if (!prefCode || !recordNum) { skipped++; continue; }

    batch.push({
      prefCode, recordNum, year: rowYear,
      ptA: g(colIdx.ptA), ptB: g(colIdx.ptB),
      surf: g(colIdx.surf), terr: g(colIdx.terr),
      injA: g(colIdx.injA), injB: g(colIdx.injB),
      vsA: g(colIdx.vsA), vsB: g(colIdx.vsB),
      spA: g(colIdx.spA), spB: g(colIdx.spB),
    });

    if (batch.length >= BATCH_SIZE) {
      const result = await executeBatch(batch);
      updated += result.ok;
      errors += result.err;
      batch = [];
      if ((updated + errors) % 5000 < BATCH_SIZE) {
        process.stdout.write(`\r  📊 ${updated}件更新 / ${errors}件エラー / ${skipped}件スキップ    `);
      }
      await sleep(100);
    }
  }

  if (batch.length > 0) {
    const result = await executeBatch(batch);
    updated += result.ok;
    errors += result.err;
  }

  console.log(`\n\n  ✅ 完了: ${updated}件更新, ${errors}件エラー, ${skipped}件スキップ`);
}

main().catch((e) => {
  console.error("❌ 致命的エラー:", e.message);
  process.exit(1);
});
