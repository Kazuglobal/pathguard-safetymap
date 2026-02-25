import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiRateLimiter } from '@/lib/rate-limiter';

const XROAD_API_BASE_URL = 'https://api.jartic-open-traffic.org/geoserver';

const ALLOWED_PARAMS = new Set([
  'service',
  'version',
  'request',
  'typeName',
  'typeNames',
  'outputFormat',
  'exceptions',
  'bbox',
  'srsName',
  'maxFeatures',
  'cql_filter',
  'MSTRKCODE',
  'PLACE_NAME',
  'MESHCODE',
  'YYYYMMDDHHMM_FROM',
  'YYYYMMDDHHMM_TO',
  'YYYYMMDDHH_FROM',
  'YYYYMMDDHH_TO',
]);

export async function GET(request: Request) {
  // 認証チェック
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  // レート制限
  const limitResult = await apiRateLimiter.checkLimit(`xroad-proxy:${user.id}`);
  if (!limitResult.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limitResult.resetTime - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらく後にお試しください。' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const externalApiUrl = new URL(XROAD_API_BASE_URL);

    // ホワイトリストのパラメータのみ転送
    requestUrl.searchParams.forEach((value, key) => {
      if (ALLOWED_PARAMS.has(key)) {
        externalApiUrl.searchParams.append(key, value);
      }
    });

    const response = await fetch(externalApiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `External API Error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
