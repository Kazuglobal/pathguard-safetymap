const{createClient}=require("@supabase/supabase-js");const fs=require("fs");const path=require("path");
const CONFIG={SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL||"https://ykodiivanzutyivkguza.supabase.co",SUPABASE_SERVICE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY||"",BATCH_SIZE:500};
const args=process.argv.slice(2);const csvPath=args.find(a=>!a.startsWith("--"));const yearArg=args.find((a,i)=>i>0&&!a.startsWith("--")&&/^\d{4}$/.test(a));const prefArg=args.find((a,i)=>args[i-1]==="--pref");const isUtf8=args.includes("--utf8");const isDryRun=args.includes("--dry-run");const isConverted=args.includes("--converted");
if(!csvPath||!yearArg){console.log("使い方: node import.js <CSV> <年度> [--converted] [--utf8] [--pref XX] [--dry-run]");process.exit(1)}
const SOURCE_YEAR=parseInt(yearArg);const PREF_FILTER=prefArg?parseInt(prefArg):null;
function parseCSVLine(l){const r=[];let c="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'&&l[i+1]==='"'){c+='"';i++}else if(ch==='"')q=false;else c+=ch}else{if(ch==='"')q=true;else if(ch===','){r.push(c.trim());c=""}else c+=ch}}r.push(c.trim());return r}
function norm(h){return h.replace(/\s+/g,"_").replace(/（/g,"(").replace(/）/g,")").replace(/＿/g,"_").replace(/　+/g,"_").trim()}
function findCol(hi,...cs){for(const n of cs){const k=norm(n);if(hi[k]!==undefined)return hi[k]}return -1}
function convertNpaCoord(raw){if(!raw||raw==="0"||raw.length<7)return null;const len=raw.length;const ss=parseInt(raw.substring(len-5,len-3));const ms=parseInt(raw.substring(len-3));const mm=parseInt(raw.substring(len-7,len-5));const dd=parseInt(raw.substring(0,len-7));const r=dd+mm/60+(ss+ms/1000)/3600;return isFinite(r)?r:null}
const PN={"北海道（札幌方面）":10,"北海道（函館方面）":11,"北海道（旭川方面）":12,"北海道（釧路方面）":13,"北海道（北見方面）":14,"青森":20,"岩手":21,"宮城":22,"秋田":23,"山形":24,"福島":25,"東京":30,"茨城":40,"栃木":41,"群馬":42,"埼玉":43,"千葉":44,"神奈川":45,"新潟":46,"山梨":47,"長野":48,"静岡":49,"富山":50,"石川":51,"福井":52,"岐阜":53,"愛知":54,"三重":55,"大阪":60,"京都":61,"兵庫":62,"奈良":63,"和歌山":64,"滋賀":65,"広島":70,"鳥取":71,"島根":72,"岡山":73,"山口":74,"香川":80,"徳島":81,"愛媛":82,"高知":83,"福岡":90,"佐賀":91,"長崎":92,"熊本":93,"大分":94,"宮崎":95,"鹿児島":96,"沖縄":97};
function prefName2Code(n){if(!n)return 0;if(PN[n]!==undefined)return PN[n];for(const[k,v]of Object.entries(PN)){if(n.includes(k)||k.includes(n))return v}const s=n.replace(/[県府都]$/,"");if(PN[s]!==undefined)return PN[s];return 0}
const WC={"晴":1,"曇":2,"雨":3,"霧":4,"雪":5};const WL={"1":"晴","2":"曇","3":"雨","4":"霧","5":"雪"};
function pW(v){if(!v)return{c:null,l:null};if(/^\d+$/.test(v))return{c:parseInt(v),l:WL[v]||null};if(WC[v])return{c:WC[v],l:v};for(const[l,c]of Object.entries(WC)){if(v.includes(l))return{c,l}}return{c:null,l:v}}
function pAT(v){if(!v)return{c:null,l:null};if(/^\d+$/.test(v)){const m={"01":"人対車両_横断中","02":"人対車両_横断中","03":"人対車両_背面通行中","04":"人対車両_対面通行中","05":"人対車両_路上遊戯","21":"車両相互_正面衝突","22":"車両相互_追突","23":"車両相互_出会い頭","24":"車両相互_左折時","25":"車両相互_右折時","26":"車両相互_その他","33":"車両単独_転倒","41":"事故類型_その他"};return{c:v,l:m[v]||null}}if(v.includes("横断"))return{c:"01",l:"人対車両_横断中"};if(v.includes("背面"))return{c:"03",l:"人対車両_背面通行中"};if(v.includes("対面"))return{c:"04",l:"人対車両_対面通行中"};if(v.includes("路上遊戯"))return{c:"05",l:"人対車両_路上遊戯"};if(v.includes("正面衝突"))return{c:"21",l:"車両相互_正面衝突"};if(v.includes("追突"))return{c:"22",l:"車両相互_追突"};if(v.includes("出会い頭"))return{c:"23",l:"車両相互_出会い頭"};if(v.includes("左折"))return{c:"24",l:"車両相互_左折時"};if(v.includes("右折"))return{c:"25",l:"車両相互_右折時"};if(v.includes("人対車両"))return{c:"08",l:"人対車両_その他"};if(v.includes("車両相互"))return{c:"26",l:"車両相互_その他"};if(v.includes("車両単独"))return{c:"33",l:"車両単独"};return{c:null,l:v.substring(0,50)}}
function pSev(v){if(!v)return 2;if(/^\d+$/.test(v))return parseInt(v);if(v.includes("死亡"))return 1;return 2}
function pAge(v){if(!v)return null;if(/^\d+$/.test(v))return parseInt(v)||null;const m=v.match(/(\d+)/);return m?parseInt(m[1]):null}
function pCnt(v){if(!v)return 0;return parseInt(v.replace(/^0+/,""))||0}
function hPol(n){if(!n)return"000";let h=0;for(let i=0;i<n.length;i++){h=((h<<5)-h+n.charCodeAt(i))&0x7FFFFFFF}return String(h%1000).padStart(3,"0")}
async function main(){
console.log("PathGuardian 交通事故データ インポーター v2");console.log("CSV: "+path.resolve(csvPath));console.log("年度: "+SOURCE_YEAR);if(PREF_FILTER)console.log("都道府県フィルター: コード"+PREF_FILTER);if(isConverted)console.log("座標変換済みモード");if(isDryRun)console.log("ドライラン");
if(!CONFIG.SUPABASE_SERVICE_KEY&&!isDryRun){console.error("SUPABASE_SERVICE_ROLE_KEY未設定");process.exit(1)}
const raw=fs.readFileSync(path.resolve(csvPath));let csvText;
if(isUtf8){csvText=raw.toString("utf-8")}else{try{const ic=require("iconv-lite");csvText=ic.decode(raw,"Shift_JIS")}catch{csvText=raw.toString("utf-8")}}
if(csvText.charCodeAt(0)===0xFEFF)csvText=csvText.substring(1);
const lines=csvText.split("\n").filter(l=>l.trim());console.log((lines.length-1).toLocaleString()+" 行");
const hdr=parseCSVLine(lines[0]);const hi={};hdr.forEach((h,i)=>{hi[norm(h)]=i});
const isLabel=findCol(hi,"都道府県コード")<0&&findCol(hi,"都道府県名")>=0;
console.log("CSV形式: "+(isLabel?"ラベル(2019-2022版)":"コード(2023版)"));
const C={pref:isLabel?findCol(hi,"都道府県名"):findCol(hi,"都道府県コード"),pol:isLabel?findCol(hi,"警察署等名"):findCol(hi,"警察署等コード"),rec:findCol(hi,"本票番号"),lat:isConverted?findCol(hi,"地点_緯度_(北緯)_10進数","地点_緯度(北緯)_10進数","地点_緯度（北緯）_10進数"):findCol(hi,"地点_緯度(北緯)","地点_緯度（北緯）"),lon:isConverted?findCol(hi,"地点_経度(東経)_10進数","地点_経度_(東経)_10進数","地点_経度（東経）_10進数"):findCol(hi,"地点_経度(東経)","地点_経度（東経）"),yr:findCol(hi,"発生日時_年"),mo:findCol(hi,"発生日時_月"),dy:findCol(hi,"発生日時_日"),hr:findCol(hi,"発生日時_時"),mn:findCol(hi,"発生日時_分"),dn:findCol(hi,"昼夜"),we:findCol(hi,"天候"),rsh:findCol(hi,"道路形状"),sig:findCol(hi,"信号機"),rw:findCol(hi,"車道幅員"),sw:findCol(hi,"歩車道区分"),zn:findCol(hi,"ゾーン規制"),at:findCol(hi,"事故類型"),sv:findCol(hi,"事故内容"),ft:findCol(hi,"死者数"),inj:findCol(hi,"負傷者数"),paT:findCol(hi,"当事者種別(当事者A)","当事者種別（当事者A）"),paA:findCol(hi,"年齢(当事者A)","年齢（当事者A）"),pbT:findCol(hi,"当事者種別(当事者B)","当事者種別（当事者B）"),pbA:findCol(hi,"年齢(当事者B)","年齢（当事者B）"),mc:findCol(hi,"市区町村コード"),ter:findCol(hi,"地形"),rsu:findCol(hi,"路面状態")};
console.log("緯度: "+(C.lat>=0?"col "+C.lat:"未検出"));console.log("経度: "+(C.lon>=0?"col "+C.lon:"未検出"));
if(C.lat===-1||C.lon===-1){console.error("緯度経度カラム未検出");Object.keys(hi).forEach(k=>console.log("  ["+k+"]="+hi[k]));process.exit(1)}
const supabase=isDryRun?null:createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_SERVICE_KEY);
let imported=0,skipped=0,errors=0,batch=[];const g=(r,i)=>i>=0?r[i]:undefined;const t=Date.now();
for(let i=1;i<lines.length;i++){const row=parseCSVLine(lines[i]);if(row.length<10){skipped++;continue}
try{const prefRaw=g(row,C.pref)||"";let prefCode=isLabel?prefName2Code(prefRaw):parseInt(prefRaw)||0;
if(PREF_FILTER&&prefCode!==PREF_FILTER){skipped++;continue}
let lat,lon;if(isConverted){lat=parseFloat(g(row,C.lat));lon=parseFloat(g(row,C.lon))}else{lat=convertNpaCoord(g(row,C.lat));lon=convertNpaCoord(g(row,C.lon))}
if(!lat||!lon||isNaN(lat)||isNaN(lon)||lat<20||lat>46||lon<122||lon>154){skipped++;continue}
const yr=parseInt(g(row,C.yr)||"")||SOURCE_YEAR;const mo=parseInt(g(row,C.mo)||"")||1;const dy=parseInt(g(row,C.dy)||"")||1;const hr=parseInt(g(row,C.hr)||"")||0;const mn=parseInt(g(row,C.mn)||"")||0;
const actualYear=yr>=2018&&yr<=2030?yr:SOURCE_YEAR;
const w=pW(g(row,C.we));const at=pAT(g(row,C.at));const sv=pSev(g(row,C.sv));const polCode=isLabel?hPol(g(row,C.pol)||""):(g(row,C.pol)||"000");
batch.push({source_year:actualYear,prefecture_code:prefCode,police_station_code:polCode,record_number:g(row,C.rec)||String(i),latitude:lat,longitude:lon,location:"SRID=4326;POINT("+lon+" "+lat+")",occurred_at:yr+"-"+String(mo).padStart(2,"0")+"-"+String(dy).padStart(2,"0")+"T"+String(hr).padStart(2,"0")+":"+String(mn).padStart(2,"0")+":00+09:00",day_night_code:parseInt(g(row,C.dn)||"")||null,severity_code:sv,fatalities:pCnt(g(row,C.ft)),injuries:pCnt(g(row,C.inj)),road_shape_code:null,road_shape_label:isLabel?(g(row,C.rsh)||"").substring(0,50)||null:null,road_width_code:null,sidewalk_code:null,sidewalk_label:isLabel?(g(row,C.sw)||"").substring(0,50)||null:null,signal_code:null,zone_regulation_code:null,weather_code:w.c,weather_label:w.l,road_surface_code:null,terrain_code:null,accident_type_code:at.c,accident_type_label:at.l,party_a_type_code:null,party_a_age:pAge(g(row,C.paA)),party_b_type_code:null,party_b_age:pAge(g(row,C.pbA)),municipality_code:g(row,C.mc)||null});
if(batch.length>=CONFIG.BATCH_SIZE){if(!isDryRun){const{error:e}=await supabase.from("traffic_accidents").upsert(batch,{onConflict:"source_year,prefecture_code,police_station_code,record_number"});if(e){console.error("バッチエラー(row "+i+"): "+e.message);errors+=batch.length}else{imported+=batch.length}}else{imported+=batch.length}batch=[];
if(imported%10000<CONFIG.BATCH_SIZE){const pct=((i/(lines.length-1))*100).toFixed(1);const el=((Date.now()-t)/1000).toFixed(0);const rate=(imported/((Date.now()-t)/1000)).toFixed(0);console.log(imported.toLocaleString()+" 件 ("+pct+"%) "+el+"s "+rate+"件/秒")}}}catch(ex){errors++;if(errors<=3)console.error("行"+i+"エラー:"+ex.message)}}
if(batch.length>0){if(!isDryRun){const{error:e}=await supabase.from("traffic_accidents").upsert(batch,{onConflict:"source_year,prefecture_code,police_station_code,record_number"});if(e)errors+=batch.length;else imported+=batch.length}else{imported+=batch.length}}
const el=((Date.now()-t)/1000).toFixed(1);console.log("\n完了! ("+el+"秒)");console.log("インポート: "+imported.toLocaleString()+" 件");console.log("スキップ: "+skipped.toLocaleString()+" 件");console.log("エラー: "+errors.toLocaleString()+" 件");
if(isDryRun)console.log("(ドライラン)");
if(!isDryRun&&imported>0){const{count}=await supabase.from("traffic_accidents").select("*",{count:"exact",head:true});console.log("\nDB全体: "+(count||0).toLocaleString()+" 件")}}
main().catch(e=>{console.error("エラー:",e);process.exit(1)});
