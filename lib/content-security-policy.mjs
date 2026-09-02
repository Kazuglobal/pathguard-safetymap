function mediaOrigin(mediaBaseUrl) {
  if (!mediaBaseUrl) return ''
  try {
    const url = new URL(mediaBaseUrl)
    return url.protocol === 'https:' ? url.origin : ''
  } catch {
    return ''
  }
}

export function buildContentSecurityPolicy(mediaBaseUrl = '') {
  const mediaSource = mediaOrigin(mediaBaseUrl)
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://disaportaldata.gsi.go.jp https://*.mapbox.com https://images.unsplash.com${mediaSource ? ` ${mediaSource}` : ''}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://disaportaldata.gsi.go.jp https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.jartic-open-traffic.org https://tile.googleapis.com https://maps.googleapis.com${mediaSource ? ` ${mediaSource}` : ''}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
  ].join('; ')
}
