import { withSentryConfig } from '@sentry/nextjs'
import fs from 'fs'
import path from 'path'
import { buildContentSecurityPolicy } from './lib/content-security-policy.mjs'

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

const distDir = process.env.NEXT_DIST_DIR || '.next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 19 strict mode
  reactStrictMode: true,

  // Keep Next.js build output in the default location Vercel expects.
  distDir,

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
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  silent: !process.env.CI,
  webpack: {
    reactComponentAnnotation: { enabled: true },
    automaticVercelMonitors: false,
  },
})
