import OpenAI from "openai"

// OpenAI クライアントを初期化して再利用できるようにエクスポートします。
// 環境変数に OPENAI_API_KEY と（必要なら）OPENAI_ORG_ID を設定してください。
// 例: .env.local
//      OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
//      OPENAI_ORG_ID=org_xxxxxxxxxxxxx

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
}) 