import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRoadData, getTrafficData } from '@/lib/api/xroad';
import { createServerClient } from '@/lib/supabase-server';

// 日本の緯度経度範囲バリデーション
const coordSchema = z.object({
  latitude: z.number().min(20.0).max(47.0),
  longitude: z.number().min(122.0).max(154.0),
  radius: z.number().int().min(100).max(50000),
});

/**
 * xROAD API用のプロキシエンドポイント
 * クライアントサイドからAPI呼び出しができるようにするためのサーバーサイドプロキシ
 */
export async function GET(request: NextRequest) {
  // 認証チェック
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method');
    const proxyOrigin = new URL(request.url).origin;

    // メソッドに応じて処理を分岐
    if (method === 'getRoadData') {
      const parsed = coordSchema.safeParse({
        latitude: parseFloat(searchParams.get('latitude') || '0'),
        longitude: parseFloat(searchParams.get('longitude') || '0'),
        radius: parseInt(searchParams.get('radius') || '1000'),
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: '座標または半径のパラメータが無効です', details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { latitude, longitude, radius } = parsed.data;

      // 現在時刻をdateTime形式で作成
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dateTime = `${year}${month}${day}${hours}${minutes}`;
      const roadType = '3'; // 一般国道をデフォルトとする

      const data = await getRoadData(latitude, longitude, radius, dateTime, roadType, { proxyOrigin });
      return NextResponse.json(data);
    }
    else if (method === 'getTrafficData') {
      const parsed = coordSchema.safeParse({
        latitude: parseFloat(searchParams.get('latitude') || '0'),
        longitude: parseFloat(searchParams.get('longitude') || '0'),
        radius: parseInt(searchParams.get('radius') || '2000'),
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: '座標または半径のパラメータが無効です', details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { latitude, longitude, radius } = parsed.data;
      const from = searchParams.get('from') || '';
      const to = searchParams.get('to') || '';

      if (!from || !to) {
        return NextResponse.json(
          { error: '開始時間と終了時間は必須です' },
          { status: 400 }
        );
      }

      const data = await getSchoolAreaTrafficData(latitude, longitude, radius, from, to, proxyOrigin);
      return NextResponse.json(data);
    }
    else {
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
 */
async function getSchoolAreaTrafficData(
  latitude: number,
  longitude: number,
  radius: number,
  from: string,
  to: string,
  proxyOrigin: string
) {
  try {
    const demoObservationPoints = [
      '1010013',
      '1010025',
      '1010037',
    ];

    const observationCodes = demoObservationPoints.join(',');
    return await getTrafficData(observationCodes, from, to, false, { proxyOrigin });
  } catch (error) {
    console.error('交通量データ取得エラー:', error);
    throw error;
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
