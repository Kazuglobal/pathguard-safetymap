import { NextResponse } from 'next/server';

const XROAD_API_BASE_URL = 'https://api.jartic-open-traffic.org/geoserver';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const externalApiUrl = new URL(XROAD_API_BASE_URL);

    // クエリパラメータをそのまま転送する
    requestUrl.searchParams.forEach((value, key) => {
      externalApiUrl.searchParams.append(key, value);
    });
    console.log(`[XRoad Proxy] Forwarding params. Full query from client to proxy: ${requestUrl.search}`);

    const finalExternalUrlString = externalApiUrl.toString();
    // 外部APIへ送信する最終的なURL全体をログに出力
    console.log(`[XRoad Proxy] Requesting to external API: ${finalExternalUrlString}`);

    const response = await fetch(finalExternalUrlString, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text(); // エラーレスポンスの本文も取得してみる
      console.error(`[XRoad Proxy] Error from external API (${response.status} ${response.statusText}): ${errorText}`);
      return NextResponse.json(
        { error: `External API Error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[XRoad Proxy] Internal proxy error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 