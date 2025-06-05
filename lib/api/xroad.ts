/**
 * xROAD API クライアントライブラリ
 * 国土交通省道路データプラットフォーム（xROAD）のAPIを呼び出すための関数を提供します
 */

// APIの設定値
const XROAD_API_KEY = process.env.XROAD_API_KEY || '';
const XROAD_API_BASE_URL = 'https://api.jartic-open-traffic.org/geoserver'; //復活させる
const PROXY_API_BASE_URL = '/api/xroad-proxy'; // Next.jsのAPIルート

/**
 * xROAD API呼び出し時に発生するエラー
 */
export class XRoadAPIError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'XRoadAPIError';
    this.status = status;
  }
}

/**
 * xROAD APIを呼び出す基本関数
 * すべてのAPI呼び出しはこの関数を通して行われます
 * 
 * @param url API呼び出し先のURL（クエリパラメータを含む）
 * @returns APIレスポンス
 */
export async function fetchFromXRoad(url: string) {
  // URLオブジェクトを作成。元々のurlにはクエリパラメータが含まれている想定
  // そのクエリパラメータをプロキシAPIのURLに付加する
  const originalUrl = new URL(url); // url は `https://api.jartic-open-traffic.org/geoserver?service=WFS&...` のような形式
  const proxyUrl = new URL(PROXY_API_BASE_URL, window.location.origin); // 第2引数で絶対URLを生成

  originalUrl.searchParams.forEach((value, key) => {
    proxyUrl.searchParams.append(key, value);
  });
  
  // APIキーの処理はプロキシ側で行うか、あるいはここで元のURLに付与していたものを削除（今回はコメントアウト済み）
  
  // APIを呼び出す
  const response = await fetch(proxyUrl.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // エラーハンドリング
  if (!response.ok) {
    throw new XRoadAPIError(
      `xROAD API エラー: ${response.statusText}`, 
      response.status
    );
  }
  
  // レスポンスデータを返す
  return await response.json();
}

/**
 * 指定した位置の周辺道路の交通量データを取得する (新しいAPI仕様に基づく)
 * 様式1（常設トラカン_5分間交通量）を取得する想定
 *
 * @param latitude 緯度
 * @param longitude 経度
 * @param radius 検索半径（メートル） - この半径からBBOXを計算
 * @param dateTime 対象日時 (YYYYMMDDHHMM形式、HHMMは5分単位に補正される)
 * @param roadType 道路種別 (1:高速自動車国道, 3:一般国道など。API仕様書参照)
 * @returns 交通量データ
 */
export async function getRoadData(
  latitude: number,
  longitude: number,
  radius: number = 1000,
  dateTime: string,
  roadType: string = '3'
) {
  // --- パラメータバリデーション追加 ---
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    const errMsg = "緯度または経度が不正な値です。数値を指定してください。";
    console.error("[Validation Error]", errMsg, { latitude, longitude });
    throw new Error(errMsg); // UI側でキャッチして表示することを想定
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    const errMsg = "緯度または経度の値が範囲外です。正しい値を指定してください。";
    console.error("[Validation Error]", errMsg, { latitude, longitude });
    throw new Error(errMsg);
  }
  if (typeof dateTime !== 'string' || !/^\d{12}$/.test(dateTime)) {
    // YYYYMMDDHHMM形式 (12桁の数字) かどうかをチェック
    const errMsg = "日時パラメータが不正な形式です。YYYYMMDDHHMM形式で指定してください。";
    console.error("[Validation Error]", errMsg, { dateTime });
    throw new Error(errMsg);
  }
  // --- ここまで ---
  try {
    const url = new URL(XROAD_API_BASE_URL);
    url.searchParams.append('service', 'WFS');
    url.searchParams.append('version', '2.0.0');
    url.searchParams.append('request', 'GetFeature');
    url.searchParams.append('typeNames', 't_travospublic_measure_5m');
    url.searchParams.append('srsName', 'EPSG:4326');
    url.searchParams.append('outputFormat', 'application/json');
    url.searchParams.append('exceptions', 'application/json');

    const latOffset = radius / 111000;
    const lonOffset = radius / (111000 * Math.cos(latitude * Math.PI / 180));

    const minLon = longitude - lonOffset;
    const minLat = latitude - latOffset;
    const maxLon = longitude + lonOffset;
    const maxLat = latitude + latOffset;

    const year = dateTime.substring(0, 4);
    const month = dateTime.substring(4, 6);
    const day = dateTime.substring(6, 8);
    const hour = dateTime.substring(8, 10);
    let minute = parseInt(dateTime.substring(10, 12), 10);
    minute = Math.floor(minute / 5) * 5;
    const timeCode = `${year}${month}${day}${hour}${String(minute).padStart(2, '0')}`;

    // --- デバッグログ追加 ---
    console.log("[getRoadData] Input params:", { latitude, longitude, radius, dateTime, roadType });
    console.log("[getRoadData] Calculated BBOX:", { minLon, minLat, maxLon, maxLat });
    console.log("[getRoadData] Calculated timeCode:", timeCode);
    // --- ここまで ---

    const cqlFilterRoadType = `"道路種別"=${roadType}`;
    const cqlFilterTimeCode = `"時間コード"=${timeCode}`;
    const cqlFilterBbox = `BBOX("ジオメトリ",${minLon},${minLat},${maxLon},${maxLat},'EPSG:4326')`;

    let cqlFilter = `${cqlFilterRoadType} AND ${cqlFilterTimeCode} AND ${cqlFilterBbox}`;

    // --- デバッグログ追加 ---
    console.log("[getRoadData] CQL RoadType part (raw):", cqlFilterRoadType);
    console.log("[getRoadData] CQL TimeCode part (raw):", cqlFilterTimeCode);
    console.log("[getRoadData] CQL BBOX part (raw):", cqlFilterBbox);
    console.log("[getRoadData] Full CQL filter (raw):", cqlFilter);
    // --- ここまで ---

    // cql_filter の値をエンコードする
    // url.searchParams.append は自動的にエンコードするが、ここでは明示的にエンコード状況を確認するため
    // また、特定の文字（日本語など）がプロキシやAPI側で問題を起こす可能性を考慮
    // ただし、通常 searchParams.append で十分なはず。問題が解決しない場合の詳細調査用。
    // url.searchParams.append('cql_filter', cqlFilter); // 既存の行

    // URLオブジェクトを生成し、cql_filterを手動でエンコードせずにセットしてみる（URLSearchParamsが処理するはず）
    const finalUrl = new URL(XROAD_API_BASE_URL);
    finalUrl.searchParams.append('service', 'WFS');
    finalUrl.searchParams.append('version', '2.0.0');
    finalUrl.searchParams.append('request', 'GetFeature');
    finalUrl.searchParams.append('typeNames', 't_travospublic_measure_5m');
    finalUrl.searchParams.append('srsName', 'EPSG:4326');
    finalUrl.searchParams.append('outputFormat', 'application/json');
    finalUrl.searchParams.append('exceptions', 'application/json');
    finalUrl.searchParams.append('cql_filter', cqlFilter); // ここでセット

    console.log("[getRoadData] Request URL for getRoadData (generated by URLSearchParams):");
    console.log(finalUrl.toString());

    const data = await fetchFromXRoad(finalUrl.toString());
    return data;
  } catch (error: any) { // errorの型をanyに指定
    let errorMessage = '道路データ取得中に予期せぬエラーが発生しました。';
    let errorDetails = {};

    console.error('[XRoad API Error] Raw error object:', error); // 元のエラーオブジェクトをログに出力

    if (error instanceof XRoadAPIError) {
      errorMessage = `xROAD APIエラー (ステータス: ${error.status}): ${error.message}`;
      errorDetails = { 
        status: error.status,
        message: error.message,
        name: error.name,
        stack: error.stack
      };
      console.error(`[XRoad API Error] API responded with status ${error.status}: ${error.message}`);
      
      // APIからのレスポンスボディを試みる (fetchFromXRoadでエラーが投げられる前にレスポンスを処理するべきだが、念のため)
      // しかし、XRoadAPIErrorのコンストラクタではresponseボディを保持していないので、ここでは難しい。
      // fetchFromXRoad側でレスポンスボディをXRoadAPIErrorに含めるように変更するのがより良い。
      // 現状では、`error.message` に `response.statusText` が入っているはず。

      if (error.message.includes('Internal Server Error') || error.status === 500) {
        errorMessage = 'xROAD API側で内部エラーが発生しました。時間をおいて再度お試しください。';
        console.error('[XRoad API Error] Detected Internal Server Error from xROAD API.');
      } else if (error.status === 400) {
        errorMessage = 'xROAD APIへのリクエストが無効です。パラメータを確認してください。';
        console.error('[XRoad API Error] Detected Bad Request to xROAD API. Check parameters.');
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = 'xROAD APIへのアクセスが許可されていません。APIキーを確認してください。';
        console.error('[XRoad API Error] Detected Unauthorized/Forbidden access to xROAD API. Check API Key.');
      } else if (error.status >= 500) {
        errorMessage = `xROAD API側でサーバーエラーが発生しました (ステータス: ${error.status})。時間をおいて再度お試しください。`;
        console.error(`[XRoad API Error] Detected Server Error (${error.status}) from xROAD API.`);
      }

    } else if (error instanceof Error) { //一般的なJavaScriptエラー
      errorMessage = `クライアント側エラー: ${error.message}`;
      errorDetails = { 
        message: error.message,
        name: error.name,
        stack: error.stack
      };
      console.error('[Client-Side Error] Error during road data fetching:', error.message, error.stack);
      if (error.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = 'xROAD APIへの接続に失敗しました。ネットワーク接続を確認するか、APIサーバーがダウンしている可能性があります。';
        console.error('[Network Error] Failed to fetch from xROAD API. Check network or API server status.');
      }
    } else {
      // 文字列やその他の型の例外の場合
      errorMessage = `予期せぬエラー型: ${String(error)}`;
      errorDetails = { errorObject: String(error) }; 
      console.error('[Unknown Error] An unexpected error type was caught:', error);
    }
    
    // 最終的なエラー情報をログに出力
    console.error("[getRoadData Error Summary] Message:", errorMessage, "Details:", JSON.stringify(errorDetails, null, 2));

    // エラーを再スローするか、あるいはカスタムエラーオブジェクトを返す
    // ここでは元のエラーを再スローする代わりに、詳細情報を含むカスタムエラーをスローすることも検討できる
    // 例: throw new Error(errorMessage, { cause: errorDetails });
    throw error; // 元のスタックトレースを保持するために、元のエラーを再スローすることが多い
  }
}

/**
 * 指定した観測所の交通量データを取得する
 * 
 * @param observationCodes 観測所コード（カンマ区切りで複数指定可能）
 * @param from データ取得開始日時（YYYYMMDDHHMM形式）
 * @param to データ取得終了日時（YYYYMMDDHHMM形式）
 * @param isHourly 1時間値データを取得するかどうか（デフォルトはfalseで5分値）
 * @returns 交通量データ
 */
export async function getTrafficData(
  observationCodes: string,
  from: string,
  to: string,
  isHourly: boolean = false
) {
  try {
    // APIパラメータを構築
    const url = new URL(XROAD_API_BASE_URL);
    url.searchParams.append('service', 'WFS');
    url.searchParams.append('version', '2.0.0');
    url.searchParams.append('request', 'GetFeature');
    
    // 5分値または1時間値を指定
    if (isHourly) {
      url.searchParams.append('typeName', 'jartic:traffic_60min_fix');
      url.searchParams.append('YYYYMMDDHH_FROM', from.substring(0, 10));
      url.searchParams.append('YYYYMMDDHH_TO', to.substring(0, 10));
    } else {
      url.searchParams.append('typeName', 'jartic:traffic_5min_fix');
      url.searchParams.append('YYYYMMDDHHMM_FROM', from);
      url.searchParams.append('YYYYMMDDHHMM_TO', to);
    }
    
    url.searchParams.append('outputFormat', 'application/json');
    url.searchParams.append('MSTRKCODE', observationCodes);
    
    // APIリクエストを実行
    const data = await fetchFromXRoad(url.toString());
    return data;
  } catch (error) {
    console.error('交通量データ取得エラー:', error);
    throw error;
  }
}

/**
 * 指定した地域名から交通量データを取得する
 * 
 * @param placeName 地域名（路線名、区間名、都道府県名など）
 * @param from データ取得開始日時（YYYYMMDDHHMM形式）
 * @param to データ取得終了日時（YYYYMMDDHHMM形式）
 * @param isHourly 1時間値データを取得するかどうか（デフォルトはfalseで5分値）
 * @returns 交通量データ
 */
export async function getTrafficDataByPlace(
  placeName: string,
  from: string,
  to: string,
  isHourly: boolean = false
) {
  try {
    // APIパラメータを構築
    const url = new URL(XROAD_API_BASE_URL);
    url.searchParams.append('service', 'WFS');
    url.searchParams.append('version', '2.0.0');
    url.searchParams.append('request', 'GetFeature');
    
    // 5分値または1時間値を指定
    if (isHourly) {
      url.searchParams.append('typeName', 'jartic:traffic_60min_fix');
      url.searchParams.append('YYYYMMDDHH_FROM', from.substring(0, 10));
      url.searchParams.append('YYYYMMDDHH_TO', to.substring(0, 10));
    } else {
      url.searchParams.append('typeName', 'jartic:traffic_5min_fix');
      url.searchParams.append('YYYYMMDDHHMM_FROM', from);
      url.searchParams.append('YYYYMMDDHHMM_TO', to);
    }
    
    url.searchParams.append('outputFormat', 'application/json');
    url.searchParams.append('PLACE_NAME', placeName);
    
    // APIリクエストを実行
    const data = await fetchFromXRoad(url.toString());
    return data;
  } catch (error) {
    console.error('地域名による交通量データ取得エラー:', error);
    throw error;
  }
}

/**
 * 指定したメッシュコードから交通量データを取得する
 * 
 * @param meshCodes メッシュコード（カンマ区切りで複数指定可能）
 * @param from データ取得開始日時（YYYYMMDDHHMM形式）
 * @param to データ取得終了日時（YYYYMMDDHHMM形式）
 * @param isHourly 1時間値データを取得するかどうか（デフォルトはfalseで5分値）
 * @returns 交通量データ
 */
export async function getTrafficDataByMeshCode(
  meshCodes: string,
  from: string,
  to: string,
  isHourly: boolean = false
) {
  try {
    // APIパラメータを構築
    const url = new URL(XROAD_API_BASE_URL);
    url.searchParams.append('service', 'WFS');
    url.searchParams.append('version', '2.0.0');
    url.searchParams.append('request', 'GetFeature');
    
    // 5分値または1時間値を指定
    if (isHourly) {
      url.searchParams.append('typeName', 'jartic:traffic_60min_fix');
      url.searchParams.append('YYYYMMDDHH_FROM', from.substring(0, 10));
      url.searchParams.append('YYYYMMDDHH_TO', to.substring(0, 10));
    } else {
      url.searchParams.append('typeName', 'jartic:traffic_5min_fix');
      url.searchParams.append('YYYYMMDDHHMM_FROM', from);
      url.searchParams.append('YYYYMMDDHHMM_TO', to);
    }
    
    url.searchParams.append('outputFormat', 'application/json');
    url.searchParams.append('MESHCODE', meshCodes);
    
    // APIリクエストを実行
    const data = await fetchFromXRoad(url.toString());
    return data;
  } catch (error) {
    console.error('メッシュコードによる交通量データ取得エラー:', error);
    throw error;
  }
} 