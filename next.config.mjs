import fs from 'fs'
import path from 'path'

const defaultsPath = path.join(process.cwd(), 'env.defaults.json')
let envDefaults = {}

try {
  if (fs.existsSync(defaultsPath)) {
    const rawDefaults = fs.readFileSync(defaultsPath, 'utf8')
    envDefaults = JSON.parse(rawDefaults)
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.warn('[next.config] Failed to read env.defaults.json:', reason)
  envDefaults = {}
}

const resolveEnv = (key, fallback = '') => {
  const value = process.env[key]
  if (value && value.length > 0) {
    return value
  }
  const defaultValue = envDefaults[key]
  if (defaultValue && defaultValue.length > 0) {
    return defaultValue
  }
  return fallback
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 19 strict mode
  reactStrictMode: true,

  // Keep Next.js build output in the default location Vercel expects.
  distDir: '.next',

  // Enforce TypeScript type-checking during build
  typescript: {
    ignoreBuildErrors: false,
  },

  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    // Force project-local root to avoid picking parent lockfiles/workspaces.
    root: process.cwd(),
    // Some environments ship three without build/* artifacts.
    // Resolve to source entry explicitly to keep Spark/Three revision checks stable.
    resolveAlias: {
      'three$': 'three/src/Three.js',
    },
  },

  // Keep tracing root pinned to this repository when multiple lockfiles exist above cwd.
  outputFileTracingRoot: process.cwd(),

  // Provide fallback environment values for public configuration
  // NOTE: Empty fallbacks will trigger offline/demo mode in supabase-provider.tsx
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: resolveEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', ''),
    NEXT_PUBLIC_SUPABASE_URL: resolveEnv('NEXT_PUBLIC_SUPABASE_URL', ''),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''),
    // 3D Route PoC
    NEXT_PUBLIC_CESIUM_ION_TOKEN: resolveEnv('NEXT_PUBLIC_CESIUM_ION_TOKEN', ''),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: resolveEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', ''),
  },
  
  // Allow remote images (Supabase storage + Unsplash)
  images: {
    remotePatterns: (() => {
      try {
        const envUrl = resolveEnv('NEXT_PUBLIC_SUPABASE_URL')
        const host = envUrl ? new URL(envUrl).hostname : 'ykodiivanzutyivkguza.supabase.co'
        return [
          { protocol: 'https', hostname: host, port: '', pathname: '/**' },
          { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
        ]
      } catch {
        return [
          { protocol: 'https', hostname: 'ykodiivanzutyivkguza.supabase.co', port: '', pathname: '/**' },
          { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
        ]
      }
    })(),
  },
  
  transpilePackages: ['mapbox-gl', 'react-map-gl', '@supabase/ssr'],
  
  // Custom webpack configuration
  webpack: (config, { isServer }) => {
    // Keep webpack and Turbopack behavior aligned for three resolution.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'three$': path.resolve(process.cwd(), 'node_modules/three/src/Three.js'),
    }

    // Prevent fs polyfill from being bundled client-side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }
    
    // Ensure @supabase/ssr is properly resolved
    if (isServer) {
      config.externals = config.externals || []
      // Don't externalize @supabase/ssr - it needs to be bundled
      // cesiumはブラウザ専用 - SSRバンドルから除外
      if (Array.isArray(config.externals)) {
        config.externals.push('cesium')
      }
    }
    
    // React 19 - JSX runtime aliases removed to prevent webpack conflicts
    
    return config
  },
  
  // React 19 experimental options
  experimental: {
    // Server action request size limit
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // CSP は Report-Only モードで動作確認中。問題がなければ Content-Security-Policy に切り替える。
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://events.mapbox.com",
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://images.unsplash.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.jartic-open-traffic.org https://tile.googleapis.com https://maps.googleapis.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
