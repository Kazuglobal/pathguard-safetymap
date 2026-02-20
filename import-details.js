/**
 * import-details.js
 * PathGuardian - 交通事故データ詳細インポーター
 * 
 * 2つの機能:
 * 1. 本票の未取込カラムを既存レコードに追加更新（--update-honhyo）
 * 2. 補充票を新テーブルにインポート（--import-hojuhyo）
 * 
 * 使い方:
 *   node import-details.js --update-honhyo honhyo_2023_to-degree.csv
 *   node import-details.js --import-hojuhyo hojuhyo_2023.csv 2023
 *   node import-details.js --import-hojuhyo hojuhyo_2022.csv 2022
 */

const fs = require("fs");
const https = require("https");

// === Supabase設定 ===
const SUPABASE_URL = "https://ykodiivanzutyivkguza.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY または SUPABASE_ANON_KEY を環境変数にセットしてください");
  process.exit(1);
}

const BATCH_SIZE = 500;

// === コード→ラベル変換マップ ===

// 当事者種別
const PARTY_TYPE_MAP = {
  "01": "普通車", "02": "中型車", "03": "大型車", "04": "大型特殊",
  "05": "特殊車", "06": "軽自動車", "07": "普通貨物", "08": "軽貨物",
  "09": "バス", "10": "マイクロバス",
  "11": "原付", "12": "軽車両", "13": "自動二輪",
  "14": "自転車", "15": "歩行者", "16": "電車", "17": "路面電車",
  "20": "不明",
};

// 車両形状
const VEHICLE_SHAPE_MAP = {
  "01": "乗用車(箱型)", "02": "乗用車(幌型)", "03": "乗用車(ステーションワゴン)",
  "04": "貨物車(箱型)", "05": "貨物車(幌型)", "06": "貨物車(ダンプ)",
  "07": "貨物車(タンク)", "08": "特種車(ミキサー)", "09": "特種車(クレーン)",
  "10": "バス", "11": "軽自動車",
  "20": "自動二輪(50-125cc)", "21": "自動二輪(125-250cc)",
  "22": "自動二輪(250cc-400cc)", "23": "自動二輪(400cc超)",
  "30": "原付", "40": "自転車",
  "50": "歩行者", "99": "その他",
};

// 人身損傷程度
const INJURY_LEVEL_MAP = {
  "1": "死亡", "2": "重傷", "3": "軽傷", "4": "無傷",
};

// 路面状態
const ROAD_SURFACE_MAP = {
  "1": "乾燥", "2": "湿潤", "3": "凍結", "4": "積雪", "5": "凹凸", "9": "その他",
};

// 地形
const TERRAIN_MAP = {
  "1": "市街地", "2": "非市街地(DID外)", "9": "その他",
};

// 行動類型（補充票用）
const ACTION_TYPE_MAP = {
  "01": "直進中", "02": "右折中", "03": "左折中", "04": "転回中",
  "05": "後退中", "06": "追い越し中", "07": "進路変更中",
  "08": "駐車中", "09": "停車中", "10": "発進中",
  "11": "横断中", "12": "路上遊戯中", "13": "路上作業中",
  "14": "路上停止中", "15": "通行中(歩行者)",
  "20": "信号待ち", "99": "その他",
};

// 違反種別
const VIOLATION_MAP = {
  "01": "信号無視", "02": "通行区分違反", "03": "速度違反",
  "04": "横断歩道上の歩行者妨害", "05": "追い越し違反", "06": "一時停止無視",
  "07": "酒気帯び", "08": "過労運転", "09": "安全不確認",
  "10": "脇見運転", "11": "動静不注視", "12": "安全速度違反",
  "13": "漫然運転", "14": "運転操作不適", "20": "違反なし", "99": "その他",
};

// === ユーティリティ ===
function supabasePost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const data = JSON.stringify(body);
    const options = {
      method: "POST",
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function supabasePatch(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const data = JSON.stringify(body);
    const options = {
      method: "PATCH",
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function removeBOM(str) {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

// === 本票の未取込カラムを更新 ===
async function updateHonhyo(csvFile) {
  console.log(`\n📋 本票の詳細カラムを更新: ${csvFile}`);
  
  const content = removeBOM(fs.readFileSync(csvFile, "utf-8"));
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);
  
  console.log(`  ヘッダー: ${headers.length}カラム`);
  console.log(`  データ行: ${lines.length - 1}件`);
  
  // ヘッダーのインデックスを取得
  const col = (name) => {
    const idx = headers.findIndex((h) => h.includes(name));
    if (idx === -1) console.warn(`  ⚠ カラム "${name}" が見つかりません`);
    return idx;
  };

  const iPartyTypeA = col("当事者種別（当事者A）");
  const iPartyTypeB = col("当事者種別（当事者B）");
  const iVehicleShapeA = col("車両形状（当事者A）");
  const iVehicleShapeB = col("車両形状（当事者B）");
  const iInjuryA = col("人身損傷程度（当事者A）");
  const iInjuryB = col("人身損傷程度（当事者B）");
  const iSpeedA = col("速度規制（指定のみ）（当事者A）");
  const iSpeedB = col("速度規制（指定のみ）（当事者B）");
  const iCollisionA = col("車両の衝突部位（当事者A）");
  const iCollisionB = col("車両の衝突部位（当事者B）");
  const iDamageA = col("車両の損壊程度（当事者A）");
  const iDamageB = col("車両の損壊程度（当事者B）");
  const iAirbagA = col("エアバッグの装備（当事者A）");
  const iAirbagB = col("エアバッグの装備（当事者B）");
  const iSideAirbagA = col("サイドエアバッグの装備（当事者A）");
  const iSideAirbagB = col("サイドエアバッグの装備（当事者B）");
  const iRoadSurface = col("路面状態");
  const iTerrain = col("地形");
  const iRoadAlignment = col("道路線形");
  const iCollisionPoint = col("衝突地点");
  const iMedian = col("中央分離帯");
  const iRoundabout = col("環状交差点");
  const iStopSignA = col("一時停止規制_標識（当事者A）");
  const iStopSignB = col("一時停止規制_標識（当事者B）");
  const iStopMarkA = col("一時停止規制_表示（当事者A");
  const iStopMarkB = col("一時停止規制_表示（当事者B）");
  const iVehicleUseA = col("用途別（当事者A）");
  const iVehicleUseB = col("用途別（当事者B）");
  const iRouteCode = col("路線コード");
  const iDayOfWeek = col("曜日");
  const iHoliday = col("祝日");
  const iPrefCode = col("都道府県コード");
  const iPoliceCode = col("警察署等コード");
  const iRecordNum = col("本票番号");
  const iYear = col("発生日時_年");

  let updated = 0;
  let errors = 0;
  let batch = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 40) continue;

    const prefCode = parseInt(vals[iPrefCode]) || 0;
    const policeCode = vals[iPoliceCode]?.trim();
    const recordNum = vals[iRecordNum]?.trim();
    const year = parseInt(vals[iYear]) || 0;

    if (!prefCode || !policeCode || !recordNum || !year) continue;

    const g = (idx) => (idx >= 0 && vals[idx]?.trim()) || null;

    const updateData = {
      party_a_type_label: PARTY_TYPE_MAP[g(iPartyTypeA)] || g(iPartyTypeA),
      party_b_type_label: PARTY_TYPE_MAP[g(iPartyTypeB)] || g(iPartyTypeB),
      vehicle_shape_a: VEHICLE_SHAPE_MAP[g(iVehicleShapeA)] || g(iVehicleShapeA),
      vehicle_shape_b: VEHICLE_SHAPE_MAP[g(iVehicleShapeB)] || g(iVehicleShapeB),
      injury_level_a: INJURY_LEVEL_MAP[g(iInjuryA)] || g(iInjuryA),
      injury_level_b: INJURY_LEVEL_MAP[g(iInjuryB)] || g(iInjuryB),
      speed_limit_a: g(iSpeedA),
      speed_limit_b: g(iSpeedB),
      collision_part_a: g(iCollisionA),
      collision_part_b: g(iCollisionB),
      damage_level_a: g(iDamageA),
      damage_level_b: g(iDamageB),
      airbag_a: g(iAirbagA),
      airbag_b: g(iAirbagB),
      side_airbag_a: g(iSideAirbagA),
      side_airbag_b: g(iSideAirbagB),
      road_surface_label: ROAD_SURFACE_MAP[g(iRoadSurface)] || g(iRoadSurface),
      terrain_label: TERRAIN_MAP[g(iTerrain)] || g(iTerrain),
      road_alignment_code: g(iRoadAlignment),
      collision_point_code: g(iCollisionPoint),
      median_code: g(iMedian),
      roundabout_diameter: g(iRoundabout),
      stop_sign_a: g(iStopSignA),
      stop_sign_b: g(iStopSignB),
      stop_marking_a: g(iStopMarkA),
      stop_marking_b: g(iStopMarkB),
      vehicle_use_a: g(iVehicleUseA),
      vehicle_use_b: g(iVehicleUseB),
      route_code: g(iRouteCode),
    };

    // RPC経由でUPDATE（prefCode + policeCode + recordNum + yearで特定）
    batch.push({
      pref: prefCode,
      police: policeCode,
      record: recordNum,
      year: year,
      data: updateData,
    });

    if (batch.length >= BATCH_SIZE) {
      try {
        await updateBatchRPC(batch);
        updated += batch.length;
      } catch (e) {
        errors += batch.length;
        console.error(`  ❌ バッチエラー: ${e.message}`);
      }
      batch = [];
      if (updated % 5000 === 0) {
        process.stdout.write(`\r  📊 ${updated}件更新 / ${errors}件エラー`);
      }
    }
  }

  // 残りのバッチ
  if (batch.length > 0) {
    try {
      await updateBatchRPC(batch);
      updated += batch.length;
    } catch (e) {
      errors += batch.length;
    }
  }

  console.log(`\n  ✅ 完了: ${updated}件更新, ${errors}件エラー`);
}

async function updateBatchRPC(batch) {
  const eq = (value) => encodeURIComponent(String(value));

  return new Promise((resolve, reject) => {
    const promises = batch.map((b) => {
      const vals = Object.entries(b.data).filter(([, v]) => v !== null);
      if (vals.length === 0) return Promise.resolve();
      
      const updateBody = {};
      vals.forEach(([k, v]) => { updateBody[k] = v; });
      
      const filterPath =
        `/rest/v1/traffic_accidents` +
        `?prefecture_code=eq.${eq(b.pref)}` +
        `&police_station_code=eq.${eq(b.police)}` +
        `&record_number=eq.${eq(b.record)}` +
        `&source_year=eq.${eq(b.year)}`;
      return supabasePatch(filterPath, updateBody);
    });
    
    Promise.all(promises).then(resolve).catch(reject);
  });
}

// === 補充票インポート ===
async function importHojuhyo(csvFile, year) {
  console.log(`\n📋 補充票インポート: ${csvFile} (${year}年)`);

  const content = removeBOM(fs.readFileSync(csvFile, "utf-8"));
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);

  console.log(`  ヘッダー: ${headers.length}カラム`);
  console.log(`  ヘッダー内容: ${headers.slice(0, 10).join(", ")}...`);
  console.log(`  データ行: ${lines.length - 1}件`);

  const col = (name) => {
    const idx = headers.findIndex((h) => h.includes(name));
    return idx;
  };

  const iPref = col("都道府県コード");
  const iPolice = col("警察署等コード");
  const iRecord = col("本票番号");
  const iPartyNum = col("当事者番号");
  const iPartyType = col("当事者種別");
  const iAge = col("年齢");
  const iSex = col("性別");
  const iInjury = col("人身損傷程度");
  const iAction = col("行動類型");
  const iVehicleType = col("車両形状");
  const iVehicleUse = col("用途別");
  const iViolation = col("違反");
  const iAlcohol = col("飲酒");
  const iSeatbelt = col("シートベルト");
  const iHelmet = col("ヘルメット");

  console.log(`  カラム位置: 都道府県=${iPref}, 警察署=${iPolice}, 本票番号=${iRecord}`);
  console.log(`  当事者番号=${iPartyNum}, 年齢=${iAge}, 性別=${iSex}`);
  console.log(`  行動類型=${iAction}, 違反=${iViolation}`);

  let imported = 0;
  let errors = 0;
  let batch = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 5) continue;

    const g = (idx) => (idx >= 0 && vals[idx]?.trim()) || null;
    const gInt = (idx) => {
      const v = g(idx);
      return v ? parseInt(v) : null;
    };

    const prefCode = gInt(iPref);
    const policeCode = g(iPolice);
    const recordNum = g(iRecord);
    const partyNum = gInt(iPartyNum);

    if (!prefCode || !policeCode || !recordNum || !partyNum) continue;

    const partyTypeCode = g(iPartyType);
    const ageVal = gInt(iAge);
    const actionCode = g(iAction);
    const injuryCode = g(iInjury);
    const violationCode = g(iViolation);

    batch.push({
      prefecture_code: prefCode,
      police_station_code: policeCode,
      record_number: recordNum,
      source_year: year,
      party_number: partyNum,
      party_type_code: partyTypeCode,
      party_type_label: PARTY_TYPE_MAP[partyTypeCode] || partyTypeCode,
      age: ageVal,
      sex_code: gInt(iSex),
      injury_level_code: injuryCode,
      injury_level_label: INJURY_LEVEL_MAP[injuryCode] || injuryCode,
      action_type_code: actionCode,
      action_type_label: ACTION_TYPE_MAP[actionCode] || actionCode,
      vehicle_type_code: g(iVehicleType),
      vehicle_type_label: VEHICLE_SHAPE_MAP[g(iVehicleType)] || g(iVehicleType),
      vehicle_use_code: g(iVehicleUse),
      violation_code: violationCode,
      violation_label: VIOLATION_MAP[violationCode] || violationCode,
      alcohol_code: g(iAlcohol),
      seatbelt_code: g(iSeatbelt),
      helmet_code: g(iHelmet),
    });

    if (batch.length >= BATCH_SIZE) {
      try {
        await supabasePost("/rest/v1/accident_parties", batch);
        imported += batch.length;
      } catch (e) {
        errors += batch.length;
        if (errors <= 5) console.error(`\n  ❌ エラー: ${e.message.slice(0, 200)}`);
      }
      batch = [];
      if ((imported + errors) % 5000 === 0) {
        process.stdout.write(`\r  📊 ${imported}件インポート / ${errors}件エラー`);
      }
    }
  }

  if (batch.length > 0) {
    try {
      await supabasePost("/rest/v1/accident_parties", batch);
      imported += batch.length;
    } catch (e) {
      errors += batch.length;
    }
  }

  console.log(`\n  ✅ 完了: ${imported}件インポート, ${errors}件エラー`);
}

// === involves_childを補充票の実年齢から更新 ===
async function updateChildFlag() {
  console.log("\n🔄 involves_child フラグを補充票の実年齢から更新...");
  
  // Edge FunctionかSQL直接実行が必要
  // ここではSupabase RPCが必要なので、手動SQLとして出力
  console.log(`
以下のSQLをSupabase SQL Editorで実行してください:

UPDATE traffic_accidents ta
SET involves_child = true
WHERE EXISTS (
  SELECT 1 FROM accident_parties ap
  WHERE ap.prefecture_code = ta.prefecture_code
    AND ap.police_station_code = ta.police_station_code
    AND ap.record_number = ta.record_number
    AND ap.source_year = ta.source_year
    AND ap.age BETWEEN 6 AND 12
);
  `);
}

// === メイン ===
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes("--update-honhyo")) {
    const csvFile = args[args.indexOf("--update-honhyo") + 1];
    if (!csvFile) {
      console.error("使い方: node import-details.js --update-honhyo honhyo_2023_to-degree.csv");
      process.exit(1);
    }
    await updateHonhyo(csvFile);
  } else if (args.includes("--import-hojuhyo")) {
    const csvFile = args[args.indexOf("--import-hojuhyo") + 1];
    const year = parseInt(args[args.indexOf("--import-hojuhyo") + 2]);
    if (!csvFile || !year) {
      console.error("使い方: node import-details.js --import-hojuhyo hojuhyo_2023.csv 2023");
      process.exit(1);
    }
    await importHojuhyo(csvFile, year);
  } else if (args.includes("--update-child-flag")) {
    await updateChildFlag();
  } else {
    console.log(`
交通事故データ詳細インポーター
=============================

使い方:
  1. 本票の追加カラムを更新:
     node import-details.js --update-honhyo honhyo_2023_to-degree.csv

  2. 補充票をインポート:
     node import-details.js --import-hojuhyo hojuhyo_2023.csv 2023

  3. involves_childフラグを更新:
     node import-details.js --update-child-flag

環境変数:
  SUPABASE_SERVICE_KEY  Supabaseサービスキー（必須）
    `);
  }
}

main().catch((e) => {
  console.error("❌ 致命的エラー:", e);
  process.exit(1);
});
