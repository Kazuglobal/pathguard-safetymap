const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://disaportaldata.gsi.go.jp https://*.supabase.co https://*.mapbox.com https://images.unsplash.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://disaportaldata.gsi.go.jp https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.jartic-open-traffic.org https://tile.googleapis.com https://maps.googleapis.com https://vercel.live wss://*.vercel.live",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
]

export function buildContentSecurityPolicy() {
  return CSP_DIRECTIVES.join("; ")
}
