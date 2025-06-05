/** @type {import('next').NextConfig} */
const nextConfig = {
   // Next.js の Image コンポーネントで外部ホストを許可
   images: {
     domains: ["ykodiivanzutyivkguza.supabase.co"],
  },
  transpilePackages: ['mapbox-gl', 'react-map-gl'],
  env: {
    // ── Supabase（サーバー側で使う） ─────────────────────
    SUPABASE_URL: 'REDACTED_SUPABASE_URL',
    SUPABASE_ANON_KEY:
      'REDACTED_SUPABASE_KEY',

    // ── Supabase（ブラウザ側で使う） ──────────────────
    NEXT_PUBLIC_SUPABASE_URL: 'REDACTED_SUPABASE_URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      'REDACTED_SUPABASE_KEY',

    // ── Mapbox（ブラウザで使う） ──────────────────────
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
      'REDACTED_MAPBOX_TOKEN',
  },
}

export default nextConfig
