import { NextRequest, NextResponse } from 'next/server';
import { fetchFromXRoad, getRoadData, getTrafficData } from '@/lib/api/xroad';

// xROAD APIのベースURL
const XROAD_API_BASE_URL = 'https://www.xroad.mlit.go.jp/api';

// APIキー（サーバーサイドで使用）
const XROAD_API_KEY = process.env.NEXT_PUBLIC_XROAD_API_KEY || '';

/**
 * xROAD API用のプロキシエンドポイント
 * クライアントサイドからAPI呼び出しができるようにするためのサーバーサイドプロキシ
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method');

    // メソッドに応じて処理を分岐
    if (method === 'getRoadData') {
      const latitude = parseFloat(searchParams.get('latitude') || '0');
      const longitude = parseFloat(searchParams.get('longitude') || '0');
      const radius = parseInt(searchParams.get('radius') || '1000');
      
      // 現在時刻をdateTime形式で作成
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dateTime = `${year}${month}${day}${hours}${minutes}`;
      const roadType = '3'; // 一般国道をデフォルトとする
      
      const data = await getRoadData(latitude, longitude, radius, dateTime, roadType);
      return NextResponse.json(data);
    } 
    else if (method === 'getTrafficData') {
      const latitude = parseFloat(searchParams.get('latitude') || '0');
      const longitude = parseFloat(searchParams.get('longitude') || '0');
      const radius = parseInt(searchParams.get('radius') || '2000');
      const from = searchParams.get('from') || '';
      const to = searchParams.get('to') || '';
      
      if (!from || !to) {
        return NextResponse.json(
          { error: '開始時間と終了時間は必須です' }, 
          { status: 400 }
        );
      }
      
      // 小学校周辺の交通量データを取得
      // 実際にはメッシュコードや観測所コードを指定する必要があるが、
      // ここでは位置情報から最寄りの観測所のデータを取得すると仮定
      const data = await getSchoolAreaTrafficData(latitude, longitude, radius, from, to);
      return NextResponse.json(data);
    }
    else {
      // 指定されたメソッドがない場合
      return NextResponse.json(
        { error: '無効なメソッドです' }, 
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('xROAD API エラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'xROAD APIでエラーが発生しました' }, 
      { status: 500 }
    );
  }
}

/**
 * 小学校周辺の交通量データを取得する関数
 * 
 * @param latitude 緯度
 * @param longitude 経度
 * @param radius 検索半径（メートル）
 * @param from データ取得開始日時（YYYYMMDDHHMM形式）
 * @param to データ取得終了日時（YYYYMMDDHHMM形式）
 * @returns 交通量データ
 */
async function getSchoolAreaTrafficData(
  latitude: number,
  longitude: number,
  radius: number,
  from: string,
  to: string
) {
  try {
    // 位置情報から最寄りの観測所を特定する処理
    // 実際のAPIでは別の方法で観測所を特定するかもしれないが、
    // ここでは簡略化のため東京23区内の主要観測所をハードコードで指定する
    
    // 実際の実装では最寄りの観測所コードや周辺のメッシュコードを検索する処理が必要
    // ここではデモ用に東京都内の主要観測所コードを指定
    const demoObservationPoints = [
      '1010013', // サンプル観測所1
      '1010025', // サンプル観測所2
      '1010037', // サンプル観測所3
    ];
    
    // 観測所コードをカンマ区切りの文字列に変換
    const observationCodes = demoObservationPoints.join(',');
    
    // APIを呼び出す
    return await getTrafficData(observationCodes, from, to, false);
  } catch (error) {
    console.error('交通量データ取得エラー:', error);
    throw error;
  }
}

export async function POST() {
  // POSTメソッドは許可しない
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 