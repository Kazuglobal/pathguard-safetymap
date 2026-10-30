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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com https://maps.googleapis.com https://maps.gstatic.com https://www.google.com",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://disaportaldata.gsi.go.jp https://*.mapbox.com https://images.unsplash.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com${mediaSource ? ` ${mediaSource}` : ''}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://disaportaldata.gsi.go.jp https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.jartic-open-traffic.org https://*.googleapis.com https://*.gstatic.com https://www.google.com${mediaSource ? ` ${mediaSource}` : ''}`,
    "frame-src 'self' https://www.google.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
  ].join('; ')
}
