const { Client } = require("pg");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runUpdate(name, sql) {
  let client;
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      statement_timeout: 60000,
    });
    await client.connect();
    const start = Date.now();
    const r = await client.query(sql);
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    if (r.rowCount > 0) {
      process.stdout.write(`  ✅ ${name}: ${r.rowCount}件 (${sec}s)  `);
    }
    return r.rowCount || 0;
  } catch (err) {
    process.stdout.write(`  ❌ ${name}: ${err.message.slice(0, 60)}  `);
    return -1;
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL をセットしてください");
    process.exit(1);
  }

  let test = new Client({ connectionString: process.env.DATABASE_URL });
  await test.connect();
  console.log("✅ DB接続OK\n");
  await test.end();

  const years = [2023, 2022, 2021, 2020, 2019];
  const prefs = [10,11,12,13,14,20,21,22,23,24,25,30,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,60,61,62,63,64,65,70,71,72,73,74,80,81,82,83,90,91,92,93,94,95,96,97];

  let totalUpdated = 0;

  for (const y of years) {
    console.log(`\n📅 ${y}年`);
    for (const p of prefs) {
      let cnt = await runUpdate(`${y}-${p} A`, `
        UPDATE traffic_accidents SET party_a_type_label = CASE party_a_type_code
          WHEN '01' THEN '普通乗用車' WHEN '02' THEN '普通貨物車' WHEN '03' THEN '軽自動車'
          WHEN '04' THEN '自動二輪車' WHEN '05' THEN '原付' WHEN '06' THEN '大型車'
          WHEN '07' THEN '中型車' WHEN '08' THEN '準中型車' WHEN '09' THEN '大型特殊'
          WHEN '10' THEN 'ミニカー' WHEN '11' THEN '小型特殊' WHEN '14' THEN '自転車'
          WHEN '15' THEN '歩行者' WHEN '16' THEN '路面電車' WHEN '17' THEN 'その他'
          ELSE party_a_type_code END
        WHERE source_year = ${y} AND prefecture_code = ${p} AND party_a_type_label IS NULL
      `);
      if (cnt < 0) { await sleep(5000); continue; }
      totalUpdated += cnt;
      await sleep(200);

      cnt = await runUpdate(`B`, `
        UPDATE traffic_accidents SET party_b_type_label = CASE party_b_type_code
          WHEN '01' THEN '普通乗用車' WHEN '02' THEN '普通貨物車' WHEN '03' THEN '軽自動車'
          WHEN '04' THEN '自動二輪車' WHEN '05' THEN '原付' WHEN '06' THEN '大型車'
          WHEN '07' THEN '中型車' WHEN '08' THEN '準中型車' WHEN '09' THEN '大型特殊'
          WHEN '10' THEN 'ミニカー' WHEN '11' THEN '小型特殊' WHEN '14' THEN '自転車'
          WHEN '15' THEN '歩行者' WHEN '16' THEN '路面電車' WHEN '17' THEN 'その他'
          ELSE party_b_type_code END
        WHERE source_year = ${y} AND prefecture_code = ${p} AND party_b_type_label IS NULL
      `);
      if (cnt > 0) totalUpdated += cnt;
      await sleep(200);

      cnt = await runUpdate(`面`, `
        UPDATE traffic_accidents SET road_surface_label = CASE road_surface_code
          WHEN 1 THEN '乾燥' WHEN 2 THEN '湿潤' WHEN 3 THEN '凍結'
          WHEN 4 THEN '積雪' WHEN 5 THEN '凹凸' WHEN 9 THEN 'その他' ELSE NULL END
        WHERE source_year = ${y} AND prefecture_code = ${p} AND road_surface_label IS NULL AND road_surface_code IS NOT NULL
      `);
      if (cnt > 0) totalUpdated += cnt;
      await sleep(200);

      cnt = await runUpdate(`地`, `
        UPDATE traffic_accidents SET terrain_label = CASE terrain_code
          WHEN 1 THEN '市街地' WHEN 2 THEN '非市街地' WHEN 3 THEN 'その他' ELSE NULL END
        WHERE source_year = ${y} AND prefecture_code = ${p} AND terrain_label IS NULL AND terrain_code IS NOT NULL
      `);
      if (cnt > 0) totalUpdated += cnt;
      await sleep(300);

      process.stdout.write("\n");
    }
  }

  console.log(`\n🎉 完了! 合計 ${totalUpdated} フィールド更新`);
}

run().catch((e) => {
  console.error("❌ 致命的エラー:", e.message);
  process.exit(1);
});
