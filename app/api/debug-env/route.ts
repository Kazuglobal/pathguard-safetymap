import { NextRequest, NextResponse } from "next/server"

// セキュリティ上の理由により、このエンドポイントは無効化されています
// APIキーの部分的な漏洩を防ぐため、本番環境では絶対に有効にしないでください

export async function GET(request: NextRequest) {
  // 本番環境では常に403を返す
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 }
    )
  }

  // 開発環境でも詳細なキー情報は返さない
  return NextResponse.json({
    hasApiKey: !!process.env.OPENAI_API_KEY,
    apiKeyFormat: process.env.OPENAI_API_KEY?.startsWith('sk-') ? 'valid' : 'invalid',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    warning: "Debug endpoint - do not expose API keys"
  })
}