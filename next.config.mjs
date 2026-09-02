import { withSentryConfig } from '@sentry/nextjs'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
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

  // Keep the build output configurable for local development and OpenNext.
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

  // Images are served unoptimized on Workers Free, so sharp and its native
  // libvips packages are unreachable at runtime. Excluding them keeps the
  // Cloudflare bundle portable without downgrading to a vulnerable sharp.
  outputFileTracingExcludes: {
    '/*': [
      './node_modules/sharp/**/*',
      './node_modules/@img/sharp-*/**/*',
      './node_modules/@img/sharp-libvips-*/**/*',
      './node_modules/.pnpm/sharp@*/**/*',
      './node_modules/.pnpm/@img+sharp-*/**/*',
      // Build-time native binaries are never loaded by the deployed Worker.
      // Excluding every platform variant prevents standalone tracing from
      // copying multi-platform toolchains and exhausting the build disk.
      './node_modules/@esbuild/**/*',
      './node_modules/.pnpm/@esbuild+*/**/*',
      './node_modules/@next/swc-*/**/*',
      './node_modules/.pnpm/@next+swc-*/**/*',
      './node_modules/lightningcss-*/**/*',
      './node_modules/.pnpm/lightningcss-*/**/*',
    ],
  },

  // Provide fallback environment values for public configuration
  // NOTE: Empty fallbacks will trigger offline/demo mode in supabase-provider.tsx
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: resolveEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', ''),
    NEXT_PUBLIC_SUPABASE_URL: resolveEnv('NEXT_PUBLIC_SUPABASE_URL', ''),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''),
    NEXT_PUBLIC_MEDIA_BASE_URL: resolveEnv('NEXT_PUBLIC_MEDIA_BASE_URL', ''),
    NEXT_PUBLIC_SENTRY_DSN: resolveEnv('NEXT_PUBLIC_SENTRY_DSN', resolveEnv('SENTRY_DSN', '')),
    // 3D Route PoC
    NEXT_PUBLIC_CESIUM_ION_TOKEN: resolveEnv('NEXT_PUBLIC_CESIUM_ION_TOKEN', ''),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: resolveEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', ''),
  },
  
  // Allow the public R2 media origin and editorial Unsplash assets.
  images: {
    // Keep Workers Free spend deterministic: serve originals instead of using
    // a native sharp bundle or the separately billed Cloudflare Images API.
    unoptimized: true,
    remotePatterns: (() => {
      try {
        const patterns = [
          { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
        ]
        const mediaUrl = resolveEnv('NEXT_PUBLIC_MEDIA_BASE_URL')
        if (mediaUrl) {
          const media = new URL(mediaUrl)
          if (media.protocol === 'https:') {
            patterns.push({ protocol: 'https', hostname: media.hostname, port: media.port, pathname: '/**' })
          }
        }
        return patterns
      } catch {
        return [
          { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
        ]
      }
    })(),
  },
  
  transpilePackages: ['mapbox-gl', 'react-map-gl', '@supabase/ssr'],
  
  // Custom webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Production bundles run in ephemeral CI/Cloudflare build environments.
    // Avoid multi-gigabyte filesystem caches that provide no reuse there.
    if (!dev) {
      config.cache = false
    }

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

      // PDF/canvas generation is loaded only after a browser interaction.
      // Excluding these browser-only packages from SSR prevents their large
      // implementations from being copied into the Cloudflare Worker while
      // keeping the real modules in the client build.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        jspdf: false,
        html2canvas: false,
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
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(resolveEnv('NEXT_PUBLIC_MEDIA_BASE_URL')),
          },
        ],
      },
    ]
  },
}

const sentryNextConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/monitoring',
  sourcemaps: process.env.SENTRY_AUTH_TOKEN
    ? { deleteSourcemapsAfterUpload: true }
    : { disable: true },
  silent: !process.env.CI,
  webpack: {
    reactComponentAnnotation: { enabled: true },
    automaticVercelMonitors: false,
  },
})

// The Workers build uses Cloudflare's native invocation observability for
// server errors. Keep Sentry's browser SDK, but do not inject the much larger
// server SDK into every split Worker.
export default process.env.OPENNEXT_TARGET ? nextConfig : sentryNextConfig

initOpenNextCloudflareForDev()
