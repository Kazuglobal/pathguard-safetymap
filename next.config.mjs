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

  // Ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Turbopack configuration (Next.js 16 default)
  turbopack: {},

  // Provide fallback environment values for public configuration
  // NOTE: Empty fallbacks will trigger offline/demo mode in supabase-provider.tsx
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: resolveEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', ''),
    NEXT_PUBLIC_SUPABASE_URL: resolveEnv('NEXT_PUBLIC_SUPABASE_URL', ''),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''),
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
    // Prevent fs polyfill from being bundled client-side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }
    
    // Ensure @supabase/ssr is properly resolved
    if (isServer) {
      config.externals = config.externals || []
      // Don't externalize @supabase/ssr - it needs to be bundled
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
}

export default nextConfig
